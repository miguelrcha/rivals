-- Fixes "infinite recursion detected in policy for relation
-- challenge_group_members" (Postgres error 42P17), which broke creating a
-- challenge group. The "Members can view their group roster" policy
-- queried challenge_group_members from within its own policy, and RLS
-- re-evaluates the same policy for that inner query, recursing forever.
--
-- Fix: move the membership check into a security-definer function. Since
-- the function runs with the privileges of its owner, its internal query
-- bypasses RLS entirely instead of re-triggering the policy. Safe to
-- re-run, standalone from schema.sql.

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
