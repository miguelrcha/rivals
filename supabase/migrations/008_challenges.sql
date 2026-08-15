-- Replaces the wishlist feature with Challenges: shared game queues that a
-- crew races through together — "FireRed first, then X, then Y" — joined by
-- direct friend invite or by sharing a short code. Safe to re-run, standalone
-- from schema.sql.

-- ============ drop the wishlist tables it replaces ============

drop table if exists public.wishlist_items;
drop table if exists public.wishlist_groups;

-- ============ challenge groups ============

create table if not exists public.challenge_groups (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  invite_code text not null unique
    default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6)),
  created_at timestamptz not null default now()
);

-- ============ challenge group members ============
-- Created here, ahead of the challenge_groups policies below, because those
-- policies reference this table — CREATE POLICY resolves table references
-- immediately, so it must already exist.

create table if not exists public.challenge_group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.challenge_groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  unique (group_id, user_id)
);

alter table public.challenge_groups enable row level security;

drop policy if exists "Members can view their challenge groups" on public.challenge_groups;
create policy "Members can view their challenge groups"
  on public.challenge_groups for select
  using (
    auth.uid() = owner_id
    or exists (
      select 1 from public.challenge_group_members m
      where m.group_id = challenge_groups.id and m.user_id = auth.uid()
    )
  );

drop policy if exists "Users can create challenge groups" on public.challenge_groups;
create policy "Users can create challenge groups"
  on public.challenge_groups for insert
  with check (auth.uid() = owner_id);

drop policy if exists "Owners can rename their challenge groups" on public.challenge_groups;
create policy "Owners can rename their challenge groups"
  on public.challenge_groups for update
  using (auth.uid() = owner_id);

drop policy if exists "Owners can delete their challenge groups" on public.challenge_groups;
create policy "Owners can delete their challenge groups"
  on public.challenge_groups for delete
  using (auth.uid() = owner_id);

-- ============ challenge group members policies ============
-- (table itself created earlier, ahead of the challenge_groups policies)

alter table public.challenge_group_members enable row level security;

drop policy if exists "Members can view their group roster" on public.challenge_group_members;
create policy "Members can view their group roster"
  on public.challenge_group_members for select
  using (
    exists (
      select 1 from public.challenge_group_members m
      where m.group_id = challenge_group_members.group_id and m.user_id = auth.uid()
    )
  );

-- Direct inserts only cover an owner adding themselves right after creating
-- a group. Inviting someone else or joining by code goes through the
-- security-definer functions below, which run their own checks.
drop policy if exists "Owners can add themselves to their groups" on public.challenge_group_members;
create policy "Owners can add themselves to their groups"
  on public.challenge_group_members for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.challenge_groups g
      where g.id = group_id and g.owner_id = auth.uid()
    )
  );

drop policy if exists "Members can leave or be removed by the owner" on public.challenge_group_members;
create policy "Members can leave or be removed by the owner"
  on public.challenge_group_members for delete
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.challenge_groups g
      where g.id = group_id and g.owner_id = auth.uid()
    )
  );

-- ============ challenge items (the queue of games) ============
-- game_slug matches src/lib/games.ts, not a foreign key — same reasoning as
-- the wishlist it replaces.

create table if not exists public.challenge_items (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.challenge_groups (id) on delete cascade,
  game_slug text not null,
  position integer not null default 0,
  status text not null default 'queued' check (status in ('queued', 'current', 'done')),
  added_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (group_id, game_slug)
);

alter table public.challenge_items enable row level security;

drop policy if exists "Members can view their group's queue" on public.challenge_items;
create policy "Members can view their group's queue"
  on public.challenge_items for select
  using (
    exists (
      select 1 from public.challenge_group_members m
      where m.group_id = challenge_items.group_id and m.user_id = auth.uid()
    )
  );

drop policy if exists "Members can add games to the queue" on public.challenge_items;
create policy "Members can add games to the queue"
  on public.challenge_items for insert
  with check (
    added_by = auth.uid()
    and exists (
      select 1 from public.challenge_group_members m
      where m.group_id = challenge_items.group_id and m.user_id = auth.uid()
    )
  );

drop policy if exists "Members can update their group's queue" on public.challenge_items;
create policy "Members can update their group's queue"
  on public.challenge_items for update
  using (
    exists (
      select 1 from public.challenge_group_members m
      where m.group_id = challenge_items.group_id and m.user_id = auth.uid()
    )
  );

drop policy if exists "Members can remove games from the queue" on public.challenge_items;
create policy "Members can remove games from the queue"
  on public.challenge_items for delete
  using (
    exists (
      select 1 from public.challenge_group_members m
      where m.group_id = challenge_items.group_id and m.user_id = auth.uid()
    )
  );

-- ============ functions ============

-- Joining by code needs to look up a group the caller isn't a member of yet
-- (RLS above would hide it), so it runs as security definer instead.
create or replace function public.join_challenge_group(p_invite_code text)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_group_id uuid;
begin
  select id into v_group_id
  from public.challenge_groups
  where invite_code = upper(trim(p_invite_code));

  if v_group_id is null then
    raise exception 'Invalid invite code';
  end if;

  insert into public.challenge_group_members (group_id, user_id)
  values (v_group_id, auth.uid())
  on conflict (group_id, user_id) do nothing;

  return v_group_id;
end;
$$;

grant execute on function public.join_challenge_group(text) to authenticated;

-- Lets any member invite one of their accepted friends straight into the
-- group, without the friend needing to accept a separate invite.
create or replace function public.invite_challenge_group_member(p_group_id uuid, p_friend_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not exists (
    select 1 from public.challenge_group_members
    where group_id = p_group_id and user_id = auth.uid()
  ) then
    raise exception 'Not a member of this group';
  end if;

  if not exists (
    select 1 from public.friend_requests
    where status = 'accepted'
      and ((requester_id = auth.uid() and addressee_id = p_friend_id)
        or (requester_id = p_friend_id and addressee_id = auth.uid()))
  ) then
    raise exception 'Not friends with that user';
  end if;

  insert into public.challenge_group_members (group_id, user_id)
  values (p_group_id, p_friend_id)
  on conflict (group_id, user_id) do nothing;
end;
$$;

grant execute on function public.invite_challenge_group_member(uuid, uuid) to authenticated;

-- Atomically moves the group's "now playing" marker to a different item, so
-- there's never more than one current game in a queue.
create or replace function public.set_current_challenge_item(p_group_id uuid, p_item_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not exists (
    select 1 from public.challenge_group_members
    where group_id = p_group_id and user_id = auth.uid()
  ) then
    raise exception 'Not a member of this group';
  end if;

  update public.challenge_items
    set status = 'queued'
    where group_id = p_group_id and status = 'current';

  update public.challenge_items
    set status = 'current'
    where id = p_item_id and group_id = p_group_id;
end;
$$;

grant execute on function public.set_current_challenge_item(uuid, uuid) to authenticated;
