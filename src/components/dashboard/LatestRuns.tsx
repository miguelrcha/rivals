import Image from "next/image";
import Link from "next/link";
import { getUserByUsername } from "@/lib/users";
import { GAME_BOXART } from "@/lib/game-boxart";

const MEDALS: Record<number, string> = {
  1: "🥇",
  2: "🥈",
  3: "🥉",
};

type Run = {
  slug: string;
  game: string;
  thumb: string;
  color: string;
  category: string;
  tag: string;
  place: number;
  placeLabel: string;
  runnerUsername: string;
  time: string;
  timeAgo: string;
};

const RUNS: Run[] = [];

export function LatestRuns() {
  return (
    <div className="dashboard-panel">
      <div className="dashboard-panel__header">
        <span className="dashboard-panel__title">LATEST RUNS</span>
      </div>

      {RUNS.length === 0 ? (
        <div className="profile-empty">
          <p className="profile-empty__title">NO RUNS YET</p>
          <p className="profile-empty__body">
            Nobody in the crew has logged a run yet — be the first.
          </p>
        </div>
      ) : (
      <div className="run-list">
        {RUNS.map((run) => {
          const runner = getUserByUsername(run.runnerUsername);
          const cover = GAME_BOXART[run.slug];

          return (
            <Link
              href={`/games/${run.slug}`}
              className="run-card"
              key={run.game}
            >
              <div className="run-card__thumb" style={{ background: run.color }}>
                {cover ? (
                  <Image
                    src={cover}
                    alt={`${run.game} box art`}
                    fill
                    sizes="64px"
                    className="run-card__art"
                  />
                ) : (
                  <span aria-hidden="true">{run.thumb}</span>
                )}
              </div>

              <div className="run-card__body">
                <div className="run-card__title">{run.game}</div>
                <div className="run-card__category">{run.category}</div>
                <div className="run-card__tag">{run.tag}</div>
              </div>

              <div className="run-card__result">
                <div className="run-card__place" data-rank={run.place}>
                  {MEDALS[run.place]} {run.placeLabel}
                </div>
                {runner && (
                  <div className="run-card__runner">
                    <span
                      className="run-card__runner-avatar"
                      style={{ background: runner.color }}
                      aria-hidden="true"
                    >
                      {runner.avatarInitial}
                    </span>
                    <span aria-hidden="true">{runner.flag}</span>
                    <span>{runner.displayName}</span>
                  </div>
                )}
              </div>

              <div className="run-card__time">
                <div className="run-card__duration">{run.time}</div>
                <div className="run-card__ago">{run.timeAgo}</div>
              </div>
            </Link>
          );
        })}
      </div>
      )}
    </div>
  );
}
