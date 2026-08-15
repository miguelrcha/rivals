import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PixelArt } from "@/components/PixelArt";
import { STATIC_CLUSTER_A, STATIC_CLUSTER_B } from "@/components/pixel-patterns";
import { SetActiveGameButton } from "@/components/dashboard/SetActiveGameButton";
import { getGameBySlug } from "@/lib/games";
import { GAME_BOXART } from "@/lib/game-boxart";
import { createClient } from "@/lib/supabase/server";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const game = getGameBySlug(slug);

  return {
    title: game ? `${game.name} / Rivals` : "Game not found / Rivals",
  };
}

export default async function GamePage({ params }: Props) {
  const { slug } = await params;
  const game = getGameBySlug(slug);

  if (!game) {
    notFound();
  }

  const coverUrl = GAME_BOXART[game.slug];

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let activeGameSlug: string | null = null;
  let existingRomFilename: string | null = null;
  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("active_game_slug")
      .eq("id", user.id)
      .single();
    activeGameSlug = data?.active_game_slug ?? null;

    const { data: rom } = await supabase
      .from("game_roms")
      .select("rom_filename")
      .eq("user_id", user.id)
      .eq("game_slug", game.slug)
      .maybeSingle();
    existingRomFilename = rom?.rom_filename ?? null;
  }

  return (
    <>
      <div
        className="game-hero"
        style={{
          background: `linear-gradient(160deg, ${game.color}66, var(--charcoal) 78%)`,
        }}
      >
        {coverUrl && (
          <>
            <div
              className="game-hero__backdrop"
              style={{ backgroundImage: `url(${coverUrl})` }}
              aria-hidden="true"
            />
            <div
              className="game-hero__scrim"
              style={{
                background: `linear-gradient(160deg, ${game.color}33, #1c1c1e99 90%)`,
              }}
              aria-hidden="true"
            />
          </>
        )}

        <PixelArt
          pattern={STATIC_CLUSTER_A}
          pixelSize={4}
          className="game-hero__static-a"
        />
        <PixelArt
          pattern={STATIC_CLUSTER_B}
          pixelSize={4}
          className="game-hero__static-b"
        />

        <Link href="/dashboard/games" className="game-hero__back">
          ← Back to games
        </Link>

        <div className="game-hero__inner">
          <div className="game-hero__cover" style={{ background: game.color }}>
            {coverUrl ? (
              <Image
                src={coverUrl}
                alt={`${game.name} box art`}
                fill
                sizes="130px"
                className="game-hero__art"
              />
            ) : (
              <span aria-hidden="true">{game.shortName}</span>
            )}
          </div>

          <div className="game-hero__meta">
            <h1 className="game-hero__title">{game.name}</h1>
            <p className="game-hero__platform">{game.platform}</p>
            <p className="game-hero__description">{game.description}</p>
            <div className="game-hero__tags">
              {game.categories.map((category) => (
                <span className="game-hero__tag" key={category}>
                  {category}
                </span>
              ))}
            </div>

            {user && (
              <SetActiveGameButton
                slug={game.slug}
                name={game.name}
                isActive={activeGameSlug === game.slug}
                existingRomFilename={existingRomFilename}
              />
            )}
          </div>
        </div>
      </div>

      <nav className="game-tabs" aria-label="Game sections">
        <span className="game-tabs__item game-tabs__item--active">
          Leaderboard
        </span>
        <span className="game-tabs__item">Levels</span>
        <span className="game-tabs__item">News</span>
        <span className="game-tabs__item">Guides</span>
        <span className="game-tabs__item">Forums</span>
      </nav>

      <div className="dashboard-panel game-stats-panel">
        <div className="dashboard-panel__header">
          <span className="dashboard-panel__title">GAME STATS</span>
        </div>

        <div className="game-stats">
          <div className="game-stats__item">
            <div className="game-stats__value">{game.stats.racers}</div>
            <div className="game-stats__label">Racers</div>
          </div>
          <div className="game-stats__item">
            <div className="game-stats__value">{game.stats.runs}</div>
            <div className="game-stats__label">Runs</div>
          </div>
          <div className="game-stats__item">
            <div className="game-stats__value">{game.stats.categories}</div>
            <div className="game-stats__label">Categories</div>
          </div>
        </div>
      </div>
    </>
  );
}
