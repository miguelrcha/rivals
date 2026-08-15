import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { GAME_BOXART } from "@/lib/game-boxart";
import { formatElapsed, formatTimeAgo, isOnline } from "@/lib/format";
import { StatusDot } from "@/components/StatusDot";

const MEDALS: Record<number, string> = {
  1: "🥇",
  2: "🥈",
  3: "🥉",
};

type RunRow = {
  id: string;
  time_seconds: number | null;
  place: number | null;
  tag: string | null;
  created_at: string;
  game: {
    slug: string;
    name: string;
    color: string;
    short_name: string;
  } | null;
  category: { name: string } | null;
  runner: {
    username: string;
    display_name: string;
    avatar_color: string;
    avatar_initial: string;
    avatar_url: string | null;
    flag: string | null;
    last_active_at: string | null;
  } | null;
};

export async function LatestRuns() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("runs")
    .select(
      `id, time_seconds, place, tag, created_at,
       game:games(slug, name, color, short_name),
       category:categories(name),
       runner:profiles(username, display_name, avatar_color, avatar_initial, avatar_url, flag, last_active_at)`,
    )
    .order("created_at", { ascending: false })
    .limit(5);

  const runs = (data ?? []) as unknown as RunRow[];

  return (
    <div className="dashboard-panel">
      <div className="dashboard-panel__header">
        <span className="dashboard-panel__title">LATEST RUNS</span>
      </div>

      {runs.length === 0 ? (
        <div className="profile-empty">
          <p className="profile-empty__title">NO RUNS YET</p>
          <p className="profile-empty__body">
            Nobody in the crew has logged a run yet — be the first.
          </p>
        </div>
      ) : (
        <div className="run-list">
          {runs.map((run) => {
            if (!run.game || !run.runner) return null;
            const cover = GAME_BOXART[run.game.slug];

            return (
              <Link
                href={`/games/${run.game.slug}`}
                className="run-card"
                key={run.id}
              >
                <div
                  className="run-card__thumb"
                  style={{ background: run.game.color }}
                >
                  {cover ? (
                    <Image
                      src={cover}
                      alt={`${run.game.name} box art`}
                      fill
                      sizes="64px"
                      className="run-card__art"
                    />
                  ) : (
                    <span aria-hidden="true">{run.game.short_name}</span>
                  )}
                </div>

                <div className="run-card__body">
                  <div className="run-card__title">{run.game.name}</div>
                  <div className="run-card__category">
                    {run.category?.name ?? "Any%"}
                  </div>
                  {run.tag && <div className="run-card__tag">{run.tag}</div>}
                </div>

                <div className="run-card__result">
                  {run.place && (
                    <div className="run-card__place" data-rank={run.place}>
                      {MEDALS[run.place] ?? `#${run.place}`}
                    </div>
                  )}
                  <div className="run-card__runner">
                    <span className="avatar-status">
                      <span
                        className="run-card__runner-avatar"
                        style={{ background: run.runner.avatar_color }}
                        aria-hidden="true"
                      >
                        {run.runner.avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={run.runner.avatar_url} alt="" />
                        ) : (
                          run.runner.avatar_initial
                        )}
                      </span>
                      <StatusDot
                        online={isOnline(run.runner.last_active_at)}
                        size="sm"
                      />
                    </span>
                    {run.runner.flag && (
                      <span aria-hidden="true">{run.runner.flag}</span>
                    )}
                    <span>{run.runner.display_name}</span>
                  </div>
                </div>

                <div className="run-card__time">
                  <div className="run-card__duration">
                    {run.time_seconds != null
                      ? formatElapsed(run.time_seconds * 1000)
                      : "In progress"}
                  </div>
                  <div className="run-card__ago">
                    {formatTimeAgo(run.created_at)}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
