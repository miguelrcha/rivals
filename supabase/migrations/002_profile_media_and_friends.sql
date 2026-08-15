-- Adds profile photo/banner uploads and a basic friend-request system.
-- Safe to re-run. Doesn't touch auth.users, so it won't deadlock like DDL
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
