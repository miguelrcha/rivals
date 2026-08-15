-- Adds the wishlist feature: users can create named groups and add games
-- they want to beat into them. Safe to re-run, standalone from schema.sql.

-- ============ wishlist groups ============

create table if not exists public.wishlist_groups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

alter table public.wishlist_groups enable row level security;

drop policy if exists "Users can view their own wishlist groups" on public.wishlist_groups;
create policy "Users can view their own wishlist groups"
  on public.wishlist_groups for select
  using (auth.uid() = user_id);

drop policy if exists "Users can create their own wishlist groups" on public.wishlist_groups;
create policy "Users can create their own wishlist groups"
  on public.wishlist_groups for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can rename their own wishlist groups" on public.wishlist_groups;
create policy "Users can rename their own wishlist groups"
  on public.wishlist_groups for update
  using (auth.uid() = user_id);

drop policy if exists "Users can delete their own wishlist groups" on public.wishlist_groups;
create policy "Users can delete their own wishlist groups"
  on public.wishlist_groups for delete
  using (auth.uid() = user_id);

-- ============ wishlist items ============
-- game_slug matches src/lib/games.ts, not a foreign key — the games table
-- isn't fully seeded with the mock catalog yet.

create table if not exists public.wishlist_items (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.wishlist_groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  game_slug text not null,
  created_at timestamptz not null default now(),
  unique (group_id, game_slug)
);

alter table public.wishlist_items enable row level security;

drop policy if exists "Users can view their own wishlist items" on public.wishlist_items;
create policy "Users can view their own wishlist items"
  on public.wishlist_items for select
  using (auth.uid() = user_id);

drop policy if exists "Users can add their own wishlist items" on public.wishlist_items;
create policy "Users can add their own wishlist items"
  on public.wishlist_items for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can remove their own wishlist items" on public.wishlist_items;
create policy "Users can remove their own wishlist items"
  on public.wishlist_items for delete
  using (auth.uid() = user_id);
