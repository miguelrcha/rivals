-- Lets either side of a friend request remove it: the addressee declining,
-- the requester canceling a pending request, or either party unfriending
-- an accepted one. Safe to re-run, standalone from schema.sql.

drop policy if exists "Users can delete requests involving them" on public.friend_requests;
create policy "Users can delete requests involving them"
  on public.friend_requests for delete
  using (auth.uid() = requester_id or auth.uid() = addressee_id);
