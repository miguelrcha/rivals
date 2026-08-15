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
