-- Lets "Add a run" log a runs row the moment someone starts racing a game,
-- before they've finished (or even synced a save). time_seconds was
-- previously required at insert time, which only makes sense for a
-- completed run — so it's now optional, and gets filled in later once the
-- run is done. started_at records the date the player says they began,
-- taken from the "Run started on" field. Safe to re-run, standalone from
-- schema.sql.

alter table public.runs alter column time_seconds drop not null;

alter table public.runs add column if not exists started_at timestamptz not null default now();
