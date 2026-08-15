import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PixelArt } from "@/components/PixelArt";
import { STATIC_CLUSTER_A, STATIC_CLUSTER_B } from "@/components/pixel-patterns";
import { SetActiveGameButton } from "@/components/dashboard/SetActiveGameButton";
import type { PartyPokemon } from "@/lib/pokemon-saves/firered";
import { ActiveRunsPanel } from "@/components/dashboard/ActiveRunsPanel";
import { GameTabs } from "@/components/games/GameTabs";
import { getGameBySlug } from "@/lib/games";
import { GAME_BOXART } from "@/lib/game-boxart";
import { emulatorsForPlatform, getEmulatorIcons } from "@/lib/emulators";
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
  const emulatorIcons = getEmulatorIcons();
  const emulators = emulatorsForPlatform(game.platform).map((emulator) => ({
    ...emulator,
    icon: emulatorIcons[emulator.id] ?? null,
  }));

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let activeGameSlug: string | null = null;
  let activeGameProgress = 0;
  let activeGameSyncCount = 0;
  let activeGameParty: PartyPokemon[] = [];
  let existingRomFilename: string | null = null;
  let currentUserProfile: {
    username: string;
    displayName: string;
    avatarColor: string;
    avatarInitial: string;
    avatarUrl: string | null;
  } | null = null;
  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select(
        "username, display_name, avatar_color, avatar_initial, avatar_url, active_game_slug, active_game_progress, active_game_sync_count, active_game_party",
      )
      .eq("id", user.id)
      .single();
    activeGameSlug = data?.active_game_slug ?? null;
    activeGameProgress = data?.active_game_progress ?? 0;
    activeGameSyncCount = data?.active_game_sync_count ?? 0;
    activeGameParty = (data?.active_game_party as PartyPokemon[] | null) ?? [];
    if (data) {
      currentUserProfile = {
        username: data.username as string,
        displayName: data.display_name as string,
        avatarColor: data.avatar_color as string,
        avatarInitial: data.avatar_initial as string,
        avatarUrl: data.avatar_url as string | null,
      };
    }

    const { data: rom } = await supabase
      .from("game_roms")
      .select("rom_filename")
      .eq("user_id", user.id)
      .eq("game_slug", game.slug)
      .maybeSingle();
    existingRomFilename = rom?.rom_filename ?? null;
  }

  const { data: activeRunnerRows } = await supabase
    .from("profiles")
    .select(
      "id, username, display_name, avatar_color, avatar_initial, avatar_url, last_active_at, active_game_progress, active_game_badges, active_game_pokedex_caught, active_game_playtime_seconds, active_game_sync_count, active_game_party, active_game_run_id",
    )
    .eq("active_game_slug", game.slug)
    .order("active_game_playtime_seconds", { ascending: false });

  const activeRunners = (activeRunnerRows ?? []).map((row) => ({
    id: row.id as string,
    runId: row.active_game_run_id as string | null,
    username: row.username as string,
    displayName: row.display_name as string,
    avatarColor: row.avatar_color as string,
    avatarInitial: row.avatar_initial as string,
    avatarUrl: row.avatar_url as string | null,
    lastActiveAt: row.last_active_at as string | null,
    progress: row.active_game_progress as number,
    badges: row.active_game_badges as number,
    pokedexCaught: row.active_game_pokedex_caught as number,
    playTimeSeconds: row.active_game_playtime_seconds as number,
    syncCount: row.active_game_sync_count as number,
    party: (row.active_game_party as PartyPokemon[] | null) ?? [],
  }));

  const { data: gameRow } = await supabase
    .from("games")
    .select("id")
    .eq("slug", game.slug)
    .maybeSingle();

  const { count: loggedRunsCount } = gameRow
    ? await supabase
        .from("runs")
        .select("*", { count: "exact", head: true })
        .eq("game_id", gameRow.id)
    : { count: 0 };

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
              style={{ backgroundImage: `url("${coverUrl}")` }}
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
                key={game.slug}
                slug={game.slug}
                name={game.name}
                gameId={gameRow?.id ?? null}
                isActive={activeGameSlug === game.slug}
                existingRomFilename={existingRomFilename}
                initialProgress={activeGameProgress}
                initialSyncCount={activeGameSyncCount}
                initialParty={activeGameParty}
                emulators={emulators}
              />
            )}
          </div>
        </div>
      </div>

      <GameTabs
        slug={game.slug}
        userId={user?.id ?? null}
        currentUserProfile={currentUserProfile}
      >
        <div className="dashboard-columns">
          <ActiveRunsPanel
            runners={activeRunners}
            currentUserId={user?.id ?? null}
            gameName={game.name}
            slug={game.slug}
          />

          <div className="dashboard-panel game-stats-panel">
            <div className="dashboard-panel__header">
              <span className="dashboard-panel__title">GAME STATS</span>
            </div>

            <div className="game-stats">
              <div className="game-stats__item">
                <div className="game-stats__value">{activeRunners.length}</div>
                <div className="game-stats__label">Racers</div>
              </div>
              <div className="game-stats__item">
                <div className="game-stats__value">{loggedRunsCount ?? 0}</div>
                <div className="game-stats__label">Runs</div>
              </div>
              <div className="game-stats__item">
                <div className="game-stats__value">{game.stats.categories}</div>
                <div className="game-stats__label">Categories</div>
              </div>
            </div>
          </div>
        </div>
      </GameTabs>
    </>
  );
}
