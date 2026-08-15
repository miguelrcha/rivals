"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type GameResult = {
  slug: string;
  name: string;
  color: string;
  cover: string | null;
};

type UserResult = {
  username: string;
  displayName: string;
  avatarColor: string;
  avatarInitial: string;
  avatarUrl: string | null;
};

export function SiteSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [games, setGames] = useState<GameResult[]>([]);
  const [users, setUsers] = useState<UserResult[]>([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const trimmed = query.trim();
    let cancelled = false;

    const timeout = setTimeout(() => {
      if (!trimmed) {
        if (!cancelled) {
          setGames([]);
          setUsers([]);
        }
        return;
      }

      fetch(`/api/search?q=${encodeURIComponent(trimmed)}`)
        .then((res) => res.json())
        .then((data: { games: GameResult[]; users: UserResult[] }) => {
          if (cancelled) return;
          setGames(data.games);
          setUsers(data.users);
          setOpen(true);
        })
        .catch(() => {});
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [query]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (games.length > 0) {
      router.push(`/games/${games[0].slug}`);
    } else if (users.length > 0) {
      router.push(`/users/${users[0].username}`);
    } else if (query.trim()) {
      router.push(`/users/${query.trim()}`);
    }

    setOpen(false);
  }

  const hasResults = games.length > 0 || users.length > 0;

  return (
    <div className="site-search" ref={containerRef}>
      <form className="games-search" onSubmit={handleSubmit}>
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
          placeholder="Search games or usernames..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => {
            if (hasResults) setOpen(true);
          }}
          aria-label="Search games or usernames"
        />
      </form>

      {open && query.trim() && hasResults && (
        <div className="site-search__results">
          {games.length > 0 && (
            <div className="site-search__group">
              <span className="site-search__group-label">Games</span>
              {games.map((game) => (
                <Link
                  key={game.slug}
                  href={`/games/${game.slug}`}
                  className="site-search__item"
                  onClick={() => setOpen(false)}
                >
                  <span
                    className="site-search__cover"
                    style={{ background: game.color }}
                  >
                    {game.cover && (
                      <Image
                        src={game.cover}
                        alt=""
                        fill
                        sizes="40px"
                        className="site-search__cover-art"
                      />
                    )}
                  </span>
                  {game.name}
                </Link>
              ))}
            </div>
          )}

          {users.length > 0 && (
            <div className="site-search__group">
              <span className="site-search__group-label">Users</span>
              {users.map((user) => (
                <Link
                  key={user.username}
                  href={`/users/${user.username}`}
                  className="site-search__item"
                  onClick={() => setOpen(false)}
                >
                  <span
                    className="site-search__avatar"
                    style={{ background: user.avatarColor }}
                  >
                    {user.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={user.avatarUrl} alt="" />
                    ) : (
                      user.avatarInitial
                    )}
                  </span>
                  {user.displayName}
                  <span className="site-search__item-meta">
                    @{user.username}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
