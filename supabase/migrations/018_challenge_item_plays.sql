-- Per-user "currently playing" marks for challenge queue items. Previously
-- "Play now" wrote challenge_items.status = 'current', a single global flag
-- any member could flip for the whole group (only one game, one player
-- implied). That's replaced by this table, mirroring
-- challenge_item_completions: each member marks an item as playing for
-- themselves, independent of the others. The UI shows every member
-- currently playing an item by name ("guelzn, miguelrcha Now playing").
-- Safe to re-run, standalone from schema.sql.

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
