-- Challenge invites now require the invited friend to accept before they
-- count as a member — previously invite_challenge_group_member added them
-- immediately. Joining by invite code is unaffected (that's an explicit
-- self-service action, no approval needed).
--
-- The "accepted" default backfills existing rows (created under the old
-- instant-join model) as already-accepted, and covers the owner
-- self-join and join-by-code paths without needing code changes there.
-- Only invite_challenge_group_member overrides to 'pending'. Safe to
-- re-run, standalone from schema.sql.

alter table public.challenge_group_members add column if not exists status text not null default 'accepted';

alter table public.challenge_group_members drop constraint if exists challenge_group_members_status_check;
alter table public.challenge_group_members add constraint challenge_group_members_status_check
  check (status in ('pending', 'accepted'));

-- Strict membership check (accepted only) — used to gate the queue,
-- roster, and other member-only data.
create or replace function public.is_challenge_group_member(p_group_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.challenge_group_members
    where group_id = p_group_id and user_id = p_user_id and status = 'accepted'
  );
$$;

-- Loose access check (any status) — lets a pending invitee see just
-- enough about the group (name, invite code) to render their invite card
-- and decide whether to accept.
create or replace function public.has_challenge_group_access(p_group_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.challenge_group_members
    where group_id = p_group_id and user_id = p_user_id
  );
$$;

grant execute on function public.has_challenge_group_access(uuid, uuid) to authenticated;

drop policy if exists "Members can view their challenge groups" on public.challenge_groups;
create policy "Members can view their challenge groups"
  on public.challenge_groups for select
  using (
    auth.uid() = owner_id
    or public.has_challenge_group_access(challenge_groups.id, auth.uid())
  );

drop policy if exists "Members can view their group roster" on public.challenge_group_members;
create policy "Members can view their group roster"
  on public.challenge_group_members for select
  using (
    auth.uid() = user_id
    or public.is_challenge_group_member(challenge_group_members.group_id, auth.uid())
  );

drop policy if exists "Users can accept their own invite" on public.challenge_group_members;
create policy "Users can accept their own invite"
  on public.challenge_group_members for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Invites now sit as 'pending' until the invited friend accepts.
create or replace function public.invite_challenge_group_member(p_group_id uuid, p_friend_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not exists (
    select 1 from public.challenge_group_members
    where group_id = p_group_id and user_id = auth.uid() and status = 'accepted'
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

  insert into public.challenge_group_members (group_id, user_id, status)
  values (p_group_id, p_friend_id, 'pending')
  on conflict (group_id, user_id) do nothing;
end;
$$;
