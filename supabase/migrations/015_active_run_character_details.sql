-- Persists the player's in-game character name and which specific badges
-- they hold (not just the count), pulled from the synced .sav, so the
-- profile card's details popup can show them. No new policy needed — the
-- existing "Profiles are viewable by everyone" / "Users can update their
-- own profile" policies already cover these columns. Safe to re-run,
-- standalone from schema.sql.

alter table public.profiles add column if not exists active_game_player_name text;

alter table public.profiles add column if not exists active_game_badge_names text[] not null default '{}';
