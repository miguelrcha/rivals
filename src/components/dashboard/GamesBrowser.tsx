"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { GAMES } from "@/lib/games";
import { SupporterBanner } from "./SupporterBanner";

const PLATFORMS = Array.from(new Set(GAMES.map((game) => game.platform)));

type SortKey = "players" | "name" | "year";

export function GamesBrowser() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [platform, setPlatform] = useState("all");
  const [sort, setSort] = useState<SortKey>("players");
  const [covers, setCovers] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;

    fetch("/api/game-covers")
      .then((res) => res.json())
      .then((data: Record<string, string>) => {
        if (!cancelled) setCovers(data);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  const games = useMemo(() => {
    const search = query.trim().toLowerCase();

    let list = platform === "all"
      ? GAMES
      : GAMES.filter((game) => game.platform === platform);

    if (search) {
      list = list.filter((game) => game.name.toLowerCase().includes(search));
    }

    list = list.slice();

    if (sort === "players") {
      list.sort((a, b) => b.stats.racers - a.stats.racers);
    } else if (sort === "name") {
      list.sort((a, b) => a.name.localeCompare(b.name));
    } else {
      list.sort((a, b) => a.releaseYear - b.releaseYear);
    }

    return list;
  }, [query, platform, sort]);

  const gamesByGeneration = useMemo(() => {
    const byGeneration = new Map<number, typeof games>();

    for (const game of games) {
      const list = byGeneration.get(game.generation) ?? [];
      list.push(game);
      byGeneration.set(game.generation, list);
    }

    return Array.from(byGeneration.entries()).sort((a, b) => a[0] - b[0]);
  }, [games]);

  const popular = useMemo(
    () =>
      GAMES.filter((game) => game.stats.racers > 0).sort(
        (a, b) => b.stats.racers - a.stats.racers,
      ),
    [],
  );

  function handleRandom() {
    const pool = games.length > 0 ? games : GAMES;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    router.push(`/games/${pick.slug}`);
  }

  return (
    <>
      <SupporterBanner />

      <div className="games-toolbar">
        <div className="games-tabs">
          <span className="games-tabs__item games-tabs__item--active">
            Games
          </span>
          <span className="games-tabs__item">Series</span>
        </div>

        <button type="button" className="games-random" onClick={handleRandom}>
          Random Game
        </button>
      </div>

      <div className="games-search">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="7" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="search"
          placeholder="Search games..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label="Search games"
        />
      </div>

      <div className="games-filters">
        <div className="games-filter">
          <label htmlFor="platform-filter">Platform</label>
          <select
            id="platform-filter"
            value={platform}
            onChange={(event) => setPlatform(event.target.value)}
          >
            <option value="all">Any platform</option>
            {PLATFORMS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>

        <div className="games-filter">
          <label htmlFor="sort-filter">Sort by</label>
          <select
            id="sort-filter"
            value={sort}
            onChange={(event) => setSort(event.target.value as SortKey)}
          >
            <option value="players">Most active racers</option>
            <option value="name">Name (A–Z)</option>
            <option value="year">Release date</option>
          </select>
        </div>
      </div>

      <div className="dashboard-columns">
        {games.length === 0 ? (
          <div className="dashboard-panel">
            <div className="profile-empty">
              <p className="profile-empty__title">NO GAMES FOUND</p>
              <p className="profile-empty__body">
                Nothing matches &quot;{query}&quot; — try a different search.
              </p>
            </div>
          </div>
        ) : (
          <div className="games-generations">
            {gamesByGeneration.map(([generation, genGames]) => (
              <section className="games-generation" key={generation}>
                <h3 className="games-generation__title">
                  Generation {generation}
                  <span className="games-generation__count">
                    {genGames.length} game{genGames.length === 1 ? "" : "s"}
                  </span>
                </h3>

                <div className="games-grid">
                  {genGames.map((game) => (
                    <Link
                      href={`/games/${game.slug}`}
                      className="game-tile"
                      key={game.slug}
                    >
                      <div
                        className="game-tile__cover"
                        style={{ background: game.color }}
                      >
                        {covers[game.slug] ? (
                          <Image
                            src={covers[game.slug]}
                            alt={`${game.name} box art`}
                            fill
                            sizes="(max-width: 640px) 45vw, 220px"
                            className="game-tile__art"
                          />
                        ) : (
                          game.shortName
                        )}
                        <span className="game-tile__year">
                          {game.releaseYear}
                        </span>
                      </div>
                      <div className="game-tile__body">
                        <div className="game-tile__title">{game.name}</div>
                        <div className="game-tile__meta">
                          {game.stats.racers > 0
                            ? `${game.stats.racers} active racers`
                            : "No runs yet"}
                        </div>
                        <div className="game-tile__tags">
                          <span className="game-tile__tag">
                            {game.platform}
                          </span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        <div className="dashboard-panel">
          <div className="dashboard-panel__header">
            <span className="dashboard-panel__title">MOST ACTIVE</span>
          </div>

          {popular.length === 0 ? (
            <div className="profile-empty">
              <p className="profile-empty__body">
                No races logged yet — check back after race night.
              </p>
            </div>
          ) : (
            <div className="games-popular">
              {popular.map((game) => (
                <Link
                  href={`/games/${game.slug}`}
                  className="games-popular__item"
                  key={game.slug}
                >
                  <span
                    className="games-popular__swatch"
                    style={{ background: game.color }}
                    aria-hidden="true"
                  >
                    {covers[game.slug] ? (
                      <Image
                        src={covers[game.slug]}
                        alt=""
                        fill
                        sizes="28px"
                        className="games-popular__art"
                      />
                    ) : (
                      game.shortName
                    )}
                  </span>
                  <span className="games-popular__name">{game.name}</span>
                  <span className="games-popular__count">
                    {game.stats.racers}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
