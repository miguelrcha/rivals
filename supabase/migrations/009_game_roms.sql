-- Lets a user attach a ROM file to a game, so we can eventually read
-- live stats/progress out of it. One ROM per (user, game) — re-uploading
-- for the same game replaces the row. Safe to re-run, standalone from
-- schema.sql.

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

-- Private bucket — ROM files are personal, never publicly readable.
-- Stored under `{user_id}/{game_slug}-...` so the policies below can check
-- the folder name against auth.uid().
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
