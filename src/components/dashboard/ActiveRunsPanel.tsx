"use client";

import { useState } from "react";
import Link from "next/link";
import { formatElapsed, isOnline } from "@/lib/format";
import { PokemonTeam } from "@/components/PokemonTeam";
import { StatusDot } from "@/components/StatusDot";
import type { PartyPokemon } from "@/lib/pokemon-saves/firered";

type Runner = {
  username: string;
  displayName: string;
  avatarColor: string;
  avatarInitial: string;
  avatarUrl: string | null;
  lastActiveAt: string | null;
  progress: number;
  badges: number;
  pokedexCaught: number;
  playTimeSeconds: number;
  syncCount: number;
  party: PartyPokemon[];
};

type Props = {
  runners: Runner[];
};

export function ActiveRunsPanel({ runners }: Props) {
  const [teamPopupUsername, setTeamPopupUsername] = useState<string | null>(
    null,
  );
  const popupRunner =
    runners.find((runner) => runner.username === teamPopupUsername) ?? null;

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
            <div className="active-runs__row" key={runner.username}>
              <div className="active-runs__row-main">
                <Link
                  href={`/users/${runner.username}`}
                  className="active-runs__racer"
                >
                  <span className="avatar-status">
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
                    <StatusDot
                      online={isOnline(runner.lastActiveAt)}
                      size="sm"
                    />
                  </span>
                  {runner.displayName}
                </Link>
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

              {runner.party.length > 0 && (
                <button
                  type="button"
                  className="active-runs__team-btn"
                  onClick={() => setTeamPopupUsername(runner.username)}
                >
                  View team
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {popupRunner && (
        <div
          className="import-modal-overlay"
          onClick={() => setTeamPopupUsername(null)}
        >
          <div
            className="import-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="import-modal__header">
              <span className="import-modal__title">
                {popupRunner.displayName}&apos;s team
              </span>
              <button
                type="button"
                className="import-modal__close"
                onClick={() => setTeamPopupUsername(null)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <PokemonTeam party={popupRunner.party} />
          </div>
        </div>
      )}
    </div>
  );
}
