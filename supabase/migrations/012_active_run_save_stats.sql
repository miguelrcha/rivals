-- Persists the real stats pulled from a synced .sav (badges, Pokédex caught,
-- play time) so they show up for everyone on the game's Active Runs panel,
-- not just locally for the person who synced. Resets alongside the other
-- active_game_* columns when a run starts/stops. No new policy needed — the
-- existing "Profiles are viewable by everyone" / "Users can update their own
-- profile" policies already cover these columns. Safe to re-run, standalone
-- from schema.sql.

alter table public.profiles add column if not exists active_game_badges smallint not null default 0;

alter table public.profiles add column if not exists active_game_pokedex_caught smallint not null default 0;

alter table public.profiles add column if not exists active_game_playtime_seconds integer not null default 0;
