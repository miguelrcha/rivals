"use client";

import Link from "next/link";
import { formatElapsed } from "@/lib/format";

type Runner = {
  username: string;
  displayName: string;
  avatarColor: string;
  avatarInitial: string;
  avatarUrl: string | null;
  progress: number;
  badges: number;
  pokedexCaught: number;
  playTimeSeconds: number;
  syncCount: number;
};

type Props = {
  runners: Runner[];
};

export function ActiveRunsPanel({ runners }: Props) {
  return (
    <div className="dashboard-panel active-runs-panel">
      <div className="dashboard-panel__header">
        <span className="dashboard-panel__title">ACTIVE RUNS</span>
        <span className="friends-count">{runners.length}</span>
      </div>

      {runners.length === 0 ? (
        <div className="profile-empty">
          <p className="profile-empty__body">
            Nobody&apos;s racing this game right now — set it as your active
            game to show up here.
          </p>
        </div>
      ) : (
        <div className="active-runs">
          <div className="active-runs__row-main active-runs__row-main--head">
            <span>Racer</span>
            <span>Time</span>
            <span>Progress</span>
          </div>
          {runners.map((runner) => (
            <Link
              href={`/users/${runner.username}`}
              className="active-runs__row"
              key={runner.username}
            >
              <div className="active-runs__row-main">
                <span className="active-runs__racer">
                  <span
                    className="active-runs__avatar"
                    style={{ background: runner.avatarColor }}
                    aria-hidden="true"
                  >
                    {runner.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={runner.avatarUrl} alt="" />
                    ) : (
                      runner.avatarInitial
                    )}
                  </span>
                  {runner.displayName}
                </span>
                <span className="active-runs__time">
                  {runner.syncCount > 0
                    ? formatElapsed(runner.playTimeSeconds * 1000)
                    : "—"}
                </span>
                <span className="active-runs__progress">
                  <span className="active-runs__progress-bar">
                    <span
                      className="active-runs__progress-fill"
                      style={{ width: `${runner.progress}%` }}
                    />
                  </span>
                  {runner.progress}%
                </span>
              </div>

              {runner.syncCount > 0 && (
                <p className="active-runs__synced">
                  Synced: {runner.badges}/8 badges · {runner.pokedexCaught}
                  /386 caught · {formatElapsed(runner.playTimeSeconds * 1000)}{" "}
                  played
                </p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
