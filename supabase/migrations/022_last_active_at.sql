-- Tracks roughly when a user was last seen, so the "Friends online" panel
-- on the dashboard home can show who's around right now. Updated on every
-- authenticated page load (see AppShell) — not real-time presence, just a
-- "last seen in the last few minutes" heuristic. Safe to re-run, standalone
-- from schema.sql.

alter table public.profiles add column if not exists last_active_at timestamptz;
