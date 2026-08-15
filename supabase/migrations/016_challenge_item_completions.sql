-- Per-user completion marks for challenge queue items. Previously "Mark
-- done" wrote challenge_items.status = 'done', a single global flag any
-- member could flip for the whole group. That's replaced by this table:
-- each member marks the item done for themselves, independent of the
-- item's queued/current status (which stays driven only by Play now /
-- Stop playing). The UI shows a stacked row of avatars for everyone who's
-- marked an item done. Safe to re-run, standalone from schema.sql.

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
