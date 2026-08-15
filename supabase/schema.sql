-- Run this once in the Supabase SQL editor (Project > SQL Editor > New query).
-- Safe to re-run: every statement is idempotent.

-- ============ profiles ============
-- One row per auth.users row, created automatically on sign up.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text unique not null,
  display_name text not null,
  gender text,
  avatar_color text not null default '#f5de1b',
  avatar_initial text not null default 'R',
  flag text,
  tagline text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "Profiles are viewable by everyone" on public.profiles;
create policy "Profiles are viewable by everyone"
  on public.profiles for select
  using (true);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Auto-create a profile row whenever someone signs up.
-- Reads username/display_name/gender from the metadata passed to
-- supabase.auth.signUp({ options: { data: { username, ... } } }).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username, display_name, gender, flag, avatar_initial)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'gender',
    nullif(new.raw_user_meta_data ->> 'flag', ''),
    upper(left(coalesce(new.raw_user_meta_data ->> 'username', new.email), 1))
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Lets the sign-in form accept a username instead of an email, without
-- exposing the profiles table's underlying emails to anyone.
create or replace function public.email_for_username(lookup_username text)
returns text
language sql
security definer set search_path = public
stable
as $$
  select u.email
  from auth.users u
  join public.profiles p on p.id = u.id
  where p.username = lookup_username
  limit 1;
$$;

grant execute on function public.email_for_username(text) to anon, authenticated;

-- ============ games ============

create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  short_name text not null,
  color text not null,
  platform text not null,
  description text,
  created_at timestamptz not null default now()
);

alter table public.games enable row level security;

drop policy if exists "Games are viewable by everyone" on public.games;
create policy "Games are viewable by everyone"
  on public.games for select
  using (true);

-- ============ categories ============

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (game_id, name)
);

alter table public.categories enable row level security;

drop policy if exists "Categories are viewable by everyone" on public.categories;
create policy "Categories are viewable by everyone"
  on public.categories for select
  using (true);

-- ============ runs ============

create table if not exists public.runs (
  id uuid primary key default gen_random_uuid(),
  runner_id uuid not null references public.profiles (id) on delete cascade,
  game_id uuid not null references public.games (id) on delete cascade,
  category_id uuid references public.categories (id) on delete set null,
  time_seconds numeric not null,
  place integer,
  tag text,
  video_url text,
  verified boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.runs enable row level security;

drop policy if exists "Runs are viewable by everyone" on public.runs;
create policy "Runs are viewable by everyone"
  on public.runs for select
  using (true);

drop policy if exists "Users can log their own runs" on public.runs;
create policy "Users can log their own runs"
  on public.runs for insert
  with check (auth.uid() = runner_id);

drop policy if exists "Users can edit their own runs" on public.runs;
create policy "Users can edit their own runs"
  on public.runs for update
  using (auth.uid() = runner_id);

drop policy if exists "Users can delete their own runs" on public.runs;
create policy "Users can delete their own runs"
  on public.runs for delete
  using (auth.uid() = runner_id);

-- ============ seed games ============
-- Matches src/lib/games.ts so real data lines up with the mock UI.

insert into public.games (slug, name, short_name, color, platform, description)
values
  ('pokemon-red', 'Pokémon Red', 'RED', '#c0392b', 'Game Boy', 'The one that started the crew''s rivalry.'),
  ('pokemon-crystal', 'Pokémon Crystal', 'CRY', '#3b8fc4', 'Game Boy Color', 'Johto''s night-and-day gimmick, speedran to death.'),
  ('pokemon-emerald', 'Pokémon Emerald', 'EMR', '#2e9e5b', 'Game Boy Advance', 'Hoenn''s hardest category, glitchless only.'),
  ('pokemon-fire-red', 'Pokémon FireRed', 'FR', '#e0703f', 'Game Boy Advance', 'Kanto remake — same route, faster shoes.')
on conflict (slug) do nothing;

insert into public.categories (game_id, name)
select id, category
from public.games
cross join (values ('Any%'), ('Glitchless')) as c(category)
on conflict (game_id, name) do nothing;

-- ============================================================
-- migrations/002_profile_media_and_friends.sql
-- Also runnable on its own — see that file for notes.
-- ============================================================
-- on auth.users can — run this on its own, separate from schema.sql.

-- ============ profile photo + banner ============

alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists banner_url text;

-- Public bucket for avatar/banner uploads. Files are stored under
-- `{user_id}/avatar-...` and `{user_id}/banner-...` so the policies below
-- can check the folder name against auth.uid().
insert into storage.buckets (id, name, public)
values ('profile-media', 'profile-media', true)
on conflict (id) do nothing;

drop policy if exists "Profile media is publicly readable" on storage.objects;
create policy "Profile media is publicly readable"
  on storage.objects for select
  using (bucket_id = 'profile-media');

drop policy if exists "Users can upload their own profile media" on storage.objects;
create policy "Users can upload their own profile media"
  on storage.objects for insert
  with check (
    bucket_id = 'profile-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can update their own profile media" on storage.objects;
create policy "Users can update their own profile media"
  on storage.objects for update
  using (
    bucket_id = 'profile-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can delete their own profile media" on storage.objects;
create policy "Users can delete their own profile media"
  on storage.objects for delete
  using (
    bucket_id = 'profile-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ============ friend requests ============
-- No accept/decline UI yet — this just lets "Add Friend" send a request
-- and remembers it so the button doesn't re-send on every visit.

create table if not exists public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles (id) on delete cascade,
  addressee_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  unique (requester_id, addressee_id)
);

alter table public.friend_requests enable row level security;

drop policy if exists "Users can view requests involving them" on public.friend_requests;
create policy "Users can view requests involving them"
  on public.friend_requests for select
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

drop policy if exists "Users can send friend requests" on public.friend_requests;
create policy "Users can send friend requests"
  on public.friend_requests for insert
  with check (auth.uid() = requester_id and requester_id <> addressee_id);

drop policy if exists "Addressee can update request status" on public.friend_requests;
create policy "Addressee can update request status"
  on public.friend_requests for update
  using (auth.uid() = addressee_id);

-- (migrations/003_wishlist.sql created wishlist_groups/wishlist_items here.
-- Superseded and dropped by migrations/008_challenges.sql, below.)

-- ============================================================
-- migrations/004_friend_requests_delete.sql
-- Also runnable on its own — see that file for notes.
-- ============================================================

drop policy if exists "Users can delete requests involving them" on public.friend_requests;
create policy "Users can delete requests involving them"
  on public.friend_requests for delete
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

-- ============================================================
-- migrations/007_active_game.sql
-- Also runnable on its own — see that file for notes.
-- ============================================================

-- Lets a user mark which game they're currently playing/racing. Shown next
-- to their name in the sidebar. No new policy needed — the existing
-- "Users can update their own profile" policy already covers this column.

alter table public.profiles add column if not exists active_game_slug text;

-- ============================================================
-- migrations/008_challenges.sql
-- Also runnable on its own — see that file for notes.
-- ============================================================

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

-- ============================================================
-- migrations/009_game_roms.sql
-- Also runnable on its own — see that file for notes.
-- ============================================================

create table if not exists public.game_roms (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  game_slug text not null,
  rom_path text not null,
  rom_filename text not null,
  created_at timestamptz not null default now(),
  unique (user_id, game_slug)
);

alter table public.game_roms enable row level security;

drop policy if exists "Users can view their own ROMs" on public.game_roms;
create policy "Users can view their own ROMs"
  on public.game_roms for select
  using (auth.uid() = user_id);

drop policy if exists "Users can add their own ROMs" on public.game_roms;
create policy "Users can add their own ROMs"
  on public.game_roms for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own ROMs" on public.game_roms;
create policy "Users can update their own ROMs"
  on public.game_roms for update
  using (auth.uid() = user_id);

drop policy if exists "Users can delete their own ROMs" on public.game_roms;
create policy "Users can delete their own ROMs"
  on public.game_roms for delete
  using (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('game-roms', 'game-roms', false)
on conflict (id) do nothing;

drop policy if exists "Users can access their own ROM files" on storage.objects;
create policy "Users can access their own ROM files"
  on storage.objects for select
  using (
    bucket_id = 'game-roms'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can upload their own ROM files" on storage.objects;
create policy "Users can upload their own ROM files"
  on storage.objects for insert
  with check (
    bucket_id = 'game-roms'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can update their own ROM files" on storage.objects;
create policy "Users can update their own ROM files"
  on storage.objects for update
  using (
    bucket_id = 'game-roms'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can delete their own ROM files" on storage.objects;
create policy "Users can delete their own ROM files"
  on storage.objects for delete
  using (
    bucket_id = 'game-roms'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ============================================================
-- migrations/010_active_runs.sql
-- Also runnable on its own — see that file for notes.
-- ============================================================

alter table public.profiles add column if not exists active_game_started_at timestamptz;

alter table public.profiles add column if not exists active_game_progress smallint not null default 0;

alter table public.profiles drop constraint if exists profiles_active_game_progress_check;
alter table public.profiles add constraint profiles_active_game_progress_check
  check (active_game_progress between 0 and 100);

-- ============================================================
-- migrations/011_active_run_sync_count.sql
-- Also runnable on its own — see that file for notes.
-- ============================================================

alter table public.profiles add column if not exists active_game_sync_count smallint not null default 0;

-- ============================================================
-- migrations/012_active_run_save_stats.sql
-- Also runnable on its own — see that file for notes.
-- ============================================================

alter table public.profiles add column if not exists active_game_badges smallint not null default 0;

alter table public.profiles add column if not exists active_game_pokedex_caught smallint not null default 0;

alter table public.profiles add column if not exists active_game_playtime_seconds integer not null default 0;

-- ============================================================
-- migrations/013_fix_challenge_rls_recursion.sql
-- Also runnable on its own — see that file for notes.
-- ============================================================

create or replace function public.is_challenge_group_member(p_group_id uuid, p_user_id uuid)
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

grant execute on function public.is_challenge_group_member(uuid, uuid) to authenticated;

drop policy if exists "Members can view their challenge groups" on public.challenge_groups;
create policy "Members can view their challenge groups"
  on public.challenge_groups for select
  using (
    auth.uid() = owner_id
    or public.is_challenge_group_member(challenge_groups.id, auth.uid())
  );

drop policy if exists "Members can view their group roster" on public.challenge_group_members;
create policy "Members can view their group roster"
  on public.challenge_group_members for select
  using (public.is_challenge_group_member(challenge_group_members.group_id, auth.uid()));

drop policy if exists "Members can view their group's queue" on public.challenge_items;
create policy "Members can view their group's queue"
  on public.challenge_items for select
  using (public.is_challenge_group_member(challenge_items.group_id, auth.uid()));

drop policy if exists "Members can add games to the queue" on public.challenge_items;
create policy "Members can add games to the queue"
  on public.challenge_items for insert
  with check (
    added_by = auth.uid()
    and public.is_challenge_group_member(challenge_items.group_id, auth.uid())
  );

drop policy if exists "Members can update their group's queue" on public.challenge_items;
create policy "Members can update their group's queue"
  on public.challenge_items for update
  using (public.is_challenge_group_member(challenge_items.group_id, auth.uid()));

drop policy if exists "Members can remove games from the queue" on public.challenge_items;
create policy "Members can remove games from the queue"
  on public.challenge_items for delete
  using (public.is_challenge_group_member(challenge_items.group_id, auth.uid()));

-- ============================================================
-- migrations/014_challenge_invite_accept.sql
-- Also runnable on its own — see that file for notes.
-- ============================================================

alter table public.challenge_group_members add column if not exists status text not null default 'accepted';

alter table public.challenge_group_members drop constraint if exists challenge_group_members_status_check;
alter table public.challenge_group_members add constraint challenge_group_members_status_check
  check (status in ('pending', 'accepted'));

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

-- ============================================================
-- migrations/015_active_run_character_details.sql
-- Also runnable on its own — see that file for notes.
-- ============================================================

alter table public.profiles add column if not exists active_game_player_name text;

alter table public.profiles add column if not exists active_game_badge_names text[] not null default '{}';

-- ============================================================
-- migrations/016_challenge_item_completions.sql
-- Also runnable on its own — see that file for notes.
-- ============================================================

create table if not exists public.challenge_item_completions (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.challenge_items (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  completed_at timestamptz not null default now(),
  unique (item_id, user_id)
);

alter table public.challenge_item_completions enable row level security;

drop policy if exists "Members can view completions in their group's queue" on public.challenge_item_completions;
create policy "Members can view completions in their group's queue"
  on public.challenge_item_completions for select
  using (
    exists (
      select 1 from public.challenge_items ci
      where ci.id = challenge_item_completions.item_id
        and public.is_challenge_group_member(ci.group_id, auth.uid())
    )
  );

drop policy if exists "Members can mark their own completion" on public.challenge_item_completions;
create policy "Members can mark their own completion"
  on public.challenge_item_completions for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.challenge_items ci
      where ci.id = challenge_item_completions.item_id
        and public.is_challenge_group_member(ci.group_id, auth.uid())
    )
  );

drop policy if exists "Members can unmark their own completion" on public.challenge_item_completions;
create policy "Members can unmark their own completion"
  on public.challenge_item_completions for delete
  using (user_id = auth.uid());

-- ============================================================
-- migrations/017_runs_in_progress.sql
-- Also runnable on its own — see that file for notes.
-- ============================================================

alter table public.runs alter column time_seconds drop not null;

alter table public.runs add column if not exists started_at timestamptz not null default now();

-- ============================================================
-- migrations/018_challenge_item_plays.sql
-- Also runnable on its own — see that file for notes.
-- ============================================================

create table if not exists public.challenge_item_plays (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.challenge_items (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  started_at timestamptz not null default now(),
  unique (item_id, user_id)
);

alter table public.challenge_item_plays enable row level security;

drop policy if exists "Members can view plays in their group's queue" on public.challenge_item_plays;
create policy "Members can view plays in their group's queue"
  on public.challenge_item_plays for select
  using (
    exists (
      select 1 from public.challenge_items ci
      where ci.id = challenge_item_plays.item_id
        and public.is_challenge_group_member(ci.group_id, auth.uid())
    )
  );

drop policy if exists "Members can mark themselves playing" on public.challenge_item_plays;
create policy "Members can mark themselves playing"
  on public.challenge_item_plays for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.challenge_items ci
      where ci.id = challenge_item_plays.item_id
        and public.is_challenge_group_member(ci.group_id, auth.uid())
    )
  );

drop policy if exists "Members can unmark themselves playing" on public.challenge_item_plays;
create policy "Members can unmark themselves playing"
  on public.challenge_item_plays for delete
  using (user_id = auth.uid());

-- ============================================================
-- migrations/019_active_game_party.sql
-- Also runnable on its own — see that file for notes.
-- ============================================================

alter table public.profiles add column if not exists active_game_party jsonb not null default '[]';

-- ============================================================
-- migrations/020_seed_all_games.sql
-- Also runnable on its own — see that file for notes.
-- ============================================================

-- The initial seed (see the `insert into public.games` block near the top
-- of schema.sql) only covered 4 of the ~38 games listed in
-- src/lib/games.ts. Any other game had no row here, so `games.id` was null
-- for it — which meant registering a run for it silently skipped the
-- `runs` insert in SetActiveGameButton (see gameId check there), making
-- the "Runs" stat on that game's page stay stuck at 0 forever. This backfills
-- the rest of the catalog so every game can log runs. Safe to re-run,
-- standalone from schema.sql — generated from src/lib/games.ts to keep the
-- data in sync (no manual transcription).

insert into public.games (slug, name, short_name, color, platform, description)
values
  ('pokemon-red', 'Pokémon Red', 'RED', '#c0392b', 'Game Boy', 'The one that started the crew''s rivalry.'),
  ('pokemon-crystal', 'Pokémon Crystal', 'CRY', '#3b8fc4', 'Game Boy Color', 'Johto''s night-and-day gimmick, speedran to death.'),
  ('pokemon-emerald', 'Pokémon Emerald', 'EMR', '#2e9e5b', 'Game Boy Advance', 'Hoenn''s hardest category, glitchless only.'),
  ('pokemon-fire-red', 'Pokémon FireRed', 'FR', '#e0703f', 'Game Boy Advance', 'Kanto remake — same route, faster shoes.'),
  ('pokemon-blue', 'Pokémon Blue', 'BLU', '#2f6fb0', 'Game Boy', 'Same Kanto, mirrored sprites, eternal debate over which starter is faster.'),
  ('pokemon-green', 'Pokémon Green', 'GRN', '#3f9d5c', 'Game Boy', 'The original Japan-only release, before Red and Blue went west.'),
  ('pokemon-yellow', 'Pokémon Yellow', 'YEL', '#e8c800', 'Game Boy', 'Pikachu follows you around. The route barely changes.'),
  ('pokemon-gold', 'Pokémon Gold', 'GLD', '#c9a227', 'Game Boy Color', 'Two regions in one cartridge, and twice the route to learn.'),
  ('pokemon-silver', 'Pokémon Silver', 'SLV', '#9aa0a6', 'Game Boy Color', 'Gold''s twin, minus the Celebi event, plus the same grind.'),
  ('pokemon-ruby', 'Pokémon Ruby', 'RUB', '#a4243b', 'Game Boy Advance', 'Hoenn''s team-based storyline, raced without a Wallace Cup.'),
  ('pokemon-sapphire', 'Pokémon Sapphire', 'SAP', '#2467a8', 'Game Boy Advance', 'Ruby''s mirror, Team Aqua edition.'),
  ('pokemon-leaf-green', 'Pokémon LeafGreen', 'LG', '#4a9c5d', 'Game Boy Advance', 'FireRed''s twin — same Kanto remake, green box this time.'),
  ('pokemon-diamond', 'Pokémon Diamond', 'DIA', '#5c7cba', 'Nintendo DS', 'Sinnoh''s slow menus make every second count double.'),
  ('pokemon-pearl', 'Pokémon Pearl', 'PRL', '#d97a9c', 'Nintendo DS', 'Diamond''s counterpart, same Sinnoh slog.'),
  ('pokemon-platinum', 'Pokémon Platinum', 'PLT', '#7d8b99', 'Nintendo DS', 'The Distortion World adds a whole extra dungeon to route.'),
  ('pokemon-heartgold', 'Pokémon HeartGold', 'HG', '#d4a017', 'Nintendo DS', 'Gold remade with a Pokéwalker nobody speedruns with.'),
  ('pokemon-soulsilver', 'Pokémon SoulSilver', 'SS', '#b6bcc4', 'Nintendo DS', 'Silver remade, Lyra''s hairstyle unchanged.'),
  ('pokemon-black', 'Pokémon Black', 'BLK', '#2b2b30', 'Nintendo DS', 'All-new Pokémon, all-new Unova, all-new route to learn from scratch.'),
  ('pokemon-white', 'Pokémon White', 'WHT', '#e6e6ea', 'Nintendo DS', 'Black''s counterpart — different version-exclusive route tweaks.'),
  ('pokemon-black-2', 'Pokémon Black 2', 'B2', '#3a3a90', 'Nintendo DS', 'A true sequel — new gyms, new route, same region.'),
  ('pokemon-white-2', 'Pokémon White 2', 'W2', '#c99a3f', 'Nintendo DS', 'Black 2''s twin, with its own gym leader shuffle.'),
  ('pokemon-x', 'Pokémon X', 'X', '#2a6fbd', 'Nintendo 3DS', 'The jump to 3D — Kalos routing is all about the bike.'),
  ('pokemon-y', 'Pokémon Y', 'Y', '#c0334d', 'Nintendo 3DS', 'X''s mirror, same Kalos, same bike-heavy route.'),
  ('pokemon-omega-ruby', 'Pokémon Omega Ruby', 'OR', '#c62840', 'Nintendo 3DS', 'Hoenn remade in 3D, DexNav grinding optional for a race.'),
  ('pokemon-alpha-sapphire', 'Pokémon Alpha Sapphire', 'AS', '#2874b5', 'Nintendo 3DS', 'Omega Ruby''s counterpart, same remade Hoenn.'),
  ('pokemon-sun', 'Pokémon Sun', 'SUN', '#e08a2e', 'Nintendo 3DS', 'Trials instead of gyms — Alola resets the whole route metagame.'),
  ('pokemon-moon', 'Pokémon Moon', 'MOON', '#5b4b9e', 'Nintendo 3DS', 'Sun''s nighttime counterpart, same island trials.'),
  ('pokemon-ultra-sun', 'Pokémon Ultra Sun', 'USUN', '#d9622b', 'Nintendo 3DS', 'Alola again, with Ultra Wormholes and extra cutscenes to skip.'),
  ('pokemon-ultra-moon', 'Pokémon Ultra Moon', 'UMOON', '#4b3a8f', 'Nintendo 3DS', 'Ultra Sun''s counterpart, same expanded Alola.'),
  ('pokemon-lets-go-pikachu', 'Pokémon Let''s Go, Pikachu!', 'LGP', '#e8c800', 'Nintendo Switch', 'Kanto again, catch-''em-all controls, no random encounters to route around.'),
  ('pokemon-lets-go-eevee', 'Pokémon Let''s Go, Eevee!', 'LGE', '#a9754f', 'Nintendo Switch', 'Let''s Go Pikachu''s counterpart, Eevee riding shotgun instead.'),
  ('pokemon-sword', 'Pokémon Sword', 'SWD', '#00a3ad', 'Nintendo Switch', 'Galar''s stadiums and Dynamax fights, routed for speed.'),
  ('pokemon-shield', 'Pokémon Shield', 'SHD', '#a13a8f', 'Nintendo Switch', 'Sword''s counterpart, same Galar, different exclusives.'),
  ('pokemon-brilliant-diamond', 'Pokémon Brilliant Diamond', 'BD', '#6f93c9', 'Nintendo Switch', 'Diamond remade chibi-style, Underground digging skipped entirely.'),
  ('pokemon-shining-pearl', 'Pokémon Shining Pearl', 'SP', '#e08fae', 'Nintendo Switch', 'Brilliant Diamond''s counterpart, same remade Sinnoh.'),
  ('pokemon-legends-arceus', 'Pokémon Legends: Arceus', 'PLA', '#c9b28a', 'Nintendo Switch', 'Open-zone Hisui with no trainer battles slowing the route down.'),
  ('pokemon-scarlet', 'Pokémon Scarlet', 'SCR', '#c0392b', 'Nintendo Switch', 'Fully open-world Paldea — three storylines, one race clock.'),
  ('pokemon-violet', 'Pokémon Violet', 'VIO', '#6a4c9c', 'Nintendo Switch', 'Scarlet''s counterpart, same open Paldea.')
on conflict (slug) do nothing;

insert into public.categories (game_id, name)
select g.id, c.name
from (values
  ('pokemon-red', 'Any%'),
  ('pokemon-red', 'Glitchless'),
  ('pokemon-crystal', 'Any%'),
  ('pokemon-crystal', '100%'),
  ('pokemon-emerald', 'Any%'),
  ('pokemon-emerald', 'Glitchless'),
  ('pokemon-fire-red', 'Any%'),
  ('pokemon-fire-red', 'Randomizer'),
  ('pokemon-blue', 'Any%'),
  ('pokemon-blue', 'Glitchless'),
  ('pokemon-green', 'Any%'),
  ('pokemon-yellow', 'Any%'),
  ('pokemon-yellow', 'Glitchless'),
  ('pokemon-gold', 'Any%'),
  ('pokemon-gold', 'Glitchless'),
  ('pokemon-silver', 'Any%'),
  ('pokemon-silver', 'Glitchless'),
  ('pokemon-ruby', 'Any%'),
  ('pokemon-ruby', 'Glitchless'),
  ('pokemon-sapphire', 'Any%'),
  ('pokemon-sapphire', 'Glitchless'),
  ('pokemon-leaf-green', 'Any%'),
  ('pokemon-leaf-green', 'Randomizer'),
  ('pokemon-diamond', 'Any%'),
  ('pokemon-diamond', 'Glitchless'),
  ('pokemon-pearl', 'Any%'),
  ('pokemon-pearl', 'Glitchless'),
  ('pokemon-platinum', 'Any%'),
  ('pokemon-platinum', 'Glitchless'),
  ('pokemon-heartgold', 'Any%'),
  ('pokemon-heartgold', 'Glitchless'),
  ('pokemon-soulsilver', 'Any%'),
  ('pokemon-soulsilver', 'Glitchless'),
  ('pokemon-black', 'Any%'),
  ('pokemon-black', 'Glitchless'),
  ('pokemon-white', 'Any%'),
  ('pokemon-white', 'Glitchless'),
  ('pokemon-black-2', 'Any%'),
  ('pokemon-black-2', 'Glitchless'),
  ('pokemon-white-2', 'Any%'),
  ('pokemon-white-2', 'Glitchless'),
  ('pokemon-x', 'Any%'),
  ('pokemon-x', 'Glitchless'),
  ('pokemon-y', 'Any%'),
  ('pokemon-y', 'Glitchless'),
  ('pokemon-omega-ruby', 'Any%'),
  ('pokemon-omega-ruby', 'Glitchless'),
  ('pokemon-alpha-sapphire', 'Any%'),
  ('pokemon-alpha-sapphire', 'Glitchless'),
  ('pokemon-sun', 'Any%'),
  ('pokemon-sun', 'Glitchless'),
  ('pokemon-moon', 'Any%'),
  ('pokemon-moon', 'Glitchless'),
  ('pokemon-ultra-sun', 'Any%'),
  ('pokemon-ultra-sun', 'Glitchless'),
  ('pokemon-ultra-moon', 'Any%'),
  ('pokemon-ultra-moon', 'Glitchless'),
  ('pokemon-lets-go-pikachu', 'Any%'),
  ('pokemon-lets-go-eevee', 'Any%'),
  ('pokemon-sword', 'Any%'),
  ('pokemon-sword', 'Glitchless'),
  ('pokemon-shield', 'Any%'),
  ('pokemon-shield', 'Glitchless'),
  ('pokemon-brilliant-diamond', 'Any%'),
  ('pokemon-brilliant-diamond', 'Glitchless'),
  ('pokemon-shining-pearl', 'Any%'),
  ('pokemon-shining-pearl', 'Glitchless'),
  ('pokemon-legends-arceus', 'Any%'),
  ('pokemon-scarlet', 'Any%'),
  ('pokemon-scarlet', 'Glitchless'),
  ('pokemon-violet', 'Any%'),
  ('pokemon-violet', 'Glitchless')
) as c(slug, name)
join public.games g on g.slug = c.slug
on conflict (game_id, name) do nothing;

-- ============================================================
-- migrations/021_game_comments_and_screenshots.sql
-- Also runnable on its own — see that file for notes.
-- ============================================================

-- Comments and screenshots tabs on the game page. game_slug is a plain
-- text column (not a FK into public.games) — same reasoning as
-- challenge_items: it matches src/lib/games.ts, and not every catalog game
-- necessarily has a public.games row (see migrations/020_seed_all_games.sql
-- for what happens when that assumption breaks).

-- ============ game comments (one level of replies) ============

create table if not exists public.game_comments (
  id uuid primary key default gen_random_uuid(),
  game_slug text not null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  parent_id uuid references public.game_comments (id) on delete cascade,
  body text not null check (char_length(trim(body)) > 0 and char_length(body) <= 2000),
  created_at timestamptz not null default now()
);

create index if not exists game_comments_game_slug_idx on public.game_comments (game_slug);

alter table public.game_comments enable row level security;

drop policy if exists "Comments are viewable by everyone" on public.game_comments;
create policy "Comments are viewable by everyone"
  on public.game_comments for select
  using (true);

drop policy if exists "Users can post comments" on public.game_comments;
create policy "Users can post comments"
  on public.game_comments for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own comments" on public.game_comments;
create policy "Users can delete their own comments"
  on public.game_comments for delete
  using (auth.uid() = user_id);

-- ============ game comment likes ============

create table if not exists public.game_comment_likes (
  comment_id uuid not null references public.game_comments (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);

alter table public.game_comment_likes enable row level security;

drop policy if exists "Comment likes are viewable by everyone" on public.game_comment_likes;
create policy "Comment likes are viewable by everyone"
  on public.game_comment_likes for select
  using (true);

drop policy if exists "Users can like comments" on public.game_comment_likes;
create policy "Users can like comments"
  on public.game_comment_likes for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can unlike their own comment likes" on public.game_comment_likes;
create policy "Users can unlike their own comment likes"
  on public.game_comment_likes for delete
  using (auth.uid() = user_id);

-- ============ game screenshots ============

create table if not exists public.game_screenshots (
  id uuid primary key default gen_random_uuid(),
  game_slug text not null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  image_path text not null,
  caption text check (char_length(caption) <= 500),
  created_at timestamptz not null default now()
);

create index if not exists game_screenshots_game_slug_idx on public.game_screenshots (game_slug);

alter table public.game_screenshots enable row level security;

drop policy if exists "Screenshots are viewable by everyone" on public.game_screenshots;
create policy "Screenshots are viewable by everyone"
  on public.game_screenshots for select
  using (true);

drop policy if exists "Users can post screenshots" on public.game_screenshots;
create policy "Users can post screenshots"
  on public.game_screenshots for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own screenshots" on public.game_screenshots;
create policy "Users can delete their own screenshots"
  on public.game_screenshots for delete
  using (auth.uid() = user_id);

-- ============ game screenshot likes ============

create table if not exists public.game_screenshot_likes (
  screenshot_id uuid not null references public.game_screenshots (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (screenshot_id, user_id)
);

alter table public.game_screenshot_likes enable row level security;

drop policy if exists "Screenshot likes are viewable by everyone" on public.game_screenshot_likes;
create policy "Screenshot likes are viewable by everyone"
  on public.game_screenshot_likes for select
  using (true);

drop policy if exists "Users can like screenshots" on public.game_screenshot_likes;
create policy "Users can like screenshots"
  on public.game_screenshot_likes for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can unlike their own screenshot likes" on public.game_screenshot_likes;
create policy "Users can unlike their own screenshot likes"
  on public.game_screenshot_likes for delete
  using (auth.uid() = user_id);

-- ============ storage bucket for screenshot images ============
-- Files are stored under `{user_id}/{game_slug}-...` so the policies below
-- can check the folder name against auth.uid(), same pattern as
-- profile-media.

insert into storage.buckets (id, name, public)
values ('game-screenshots', 'game-screenshots', true)
on conflict (id) do nothing;

drop policy if exists "Screenshot images are publicly readable" on storage.objects;
create policy "Screenshot images are publicly readable"
  on storage.objects for select
  using (bucket_id = 'game-screenshots');

drop policy if exists "Users can upload their own screenshot images" on storage.objects;
create policy "Users can upload their own screenshot images"
  on storage.objects for insert
  with check (
    bucket_id = 'game-screenshots'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can delete their own screenshot images" on storage.objects;
create policy "Users can delete their own screenshot images"
  on storage.objects for delete
  using (
    bucket_id = 'game-screenshots'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ============================================================
-- migrations/022_last_active_at.sql
-- Also runnable on its own — see that file for notes.
-- ============================================================

alter table public.profiles add column if not exists last_active_at timestamptz;

-- ============================================================
-- migrations/023_seed_legends_za.sql
-- Also runnable on its own — see that file for notes.
-- ============================================================

-- Adds Pokémon Legends: Z-A to the games catalog (was missing from
-- migrations/020_seed_all_games.sql because it wasn't in src/lib/games.ts
-- yet at the time). Safe to re-run, standalone from schema.sql.

insert into public.games (slug, name, short_name, color, platform, description)
values
  ('pokemon-legends-za', 'Pokémon Legends: Z-A', 'Z-A', '#1c1c2e', 'Nintendo Switch', 'Lumiose City reimagined — Mega Evolution takes center stage in real time.')
on conflict (slug) do nothing;

insert into public.categories (game_id, name)
select g.id, c.name
from (values
  ('pokemon-legends-za', 'Any%')
) as c(slug, name)
join public.games g on g.slug = c.slug
on conflict (game_id, name) do nothing;

-- ============================================================
-- migrations/024_run_completion.sql
-- Also runnable on its own — see that file for notes.
-- ============================================================

alter table public.runs add column if not exists cleared boolean;
alter table public.runs add column if not exists completed_at timestamptz;

alter table public.profiles
  add column if not exists active_game_run_id uuid references public.runs (id) on delete set null;
