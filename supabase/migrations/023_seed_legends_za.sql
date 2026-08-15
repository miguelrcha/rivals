-- Adds Pokémon Legends: Z-A to the games catalog (was missing from
-- migrations/020_seed_all_games.sql because it wasn't in src/lib/games.ts
-- yet at the time). Safe to re-run, standalone from schema.sql.

insert into public.games (slug, name, short_name, color, platform, description)
values
  ('pokemon-legends-za', 'Pokémon Legends: Z-A', 'Z-A', '#1c1c2e', 'Nintendo Switch', 'Lumiose City reimagined — Mega Evolution takes center stage in real time.')
on conflict (slug) do nothing;

insert into public.categories (game_id, name)
select g.id, c.name
from (values
  ('pokemon-legends-za', 'Any%')
) as c(slug, name)
join public.games g on g.slug = c.slug
on conflict (game_id, name) do nothing;
