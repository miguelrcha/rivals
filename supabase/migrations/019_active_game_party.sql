-- Persists the player's current party (species, nickname, level, HP)
-- decoded from the synced .sav, so the Trainer Card and game hero can show
-- who's actually on the team. No new policy needed — the existing
-- "Profiles are viewable by everyone" / "Users can update their own
-- profile" policies already cover this column. Safe to re-run, standalone
-- from schema.sql.

alter table public.profiles add column if not exists active_game_party jsonb not null default '[]';
