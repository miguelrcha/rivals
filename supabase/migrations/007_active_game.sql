-- Lets a user mark which game they're currently playing/racing. Shown next
-- to their name in the sidebar. No new policy needed — the existing
-- "Users can update their own profile" policy already covers this column.
-- Safe to re-run, standalone from schema.sql.

alter table public.profiles add column if not exists active_game_slug text;
