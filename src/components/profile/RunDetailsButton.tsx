"use client";

import { useState } from "react";
import { KANTO_BADGE_NAMES } from "@/lib/pokemon-saves/firered";
import { formatElapsed } from "@/lib/format";

type Props = {
  gameName: string;
  playerName: string | null;
  badgeNames: string[];
  pokedexCaught: number;
  playTimeSeconds: number;
};

export function RunDetailsButton({
  gameName,
  playerName,
  badgeNames,
  pokedexCaught,
  playTimeSeconds,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const earned = new Set(badgeNames);

  return (
    <>
      <button
        type="button"
        className="profile-run-card__details-btn"
        onClick={() => setIsOpen(true)}
      >
        Details
      </button>

      {isOpen && (
        <div
          className="import-modal-overlay"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="import-modal trainer-card-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="import-modal__close trainer-card__close"
              onClick={() => setIsOpen(false)}
              aria-label="Close"
            >
              ✕
            </button>

            <div className="trainer-card">
              <div className="trainer-card__header">
                <span className="trainer-card__title">Trainer Card</span>
                <span className="trainer-card__game-pill">{gameName}</span>
              </div>

              <div className="trainer-card__body">
                <div className="trainer-card__fields">
                  <div className="trainer-card__row">
                    <span className="trainer-card__label">
                      <span className="trainer-card__bullet" /> Name
                    </span>
                    <span className="trainer-card__value">
                      {playerName || "?????"}
                    </span>
                  </div>

                  <div className="trainer-card__row">
                    <span className="trainer-card__label">
                      <span className="trainer-card__bullet" /> Pokédex
                    </span>
                    <span className="trainer-card__value">
                      {pokedexCaught}/386
                    </span>
                  </div>

                  <div className="trainer-card__row">
                    <span className="trainer-card__label">
                      <span className="trainer-card__bullet" /> Time
                    </span>
                    <span className="trainer-card__value">
                      {formatElapsed(playTimeSeconds * 1000)}
                    </span>
                  </div>
                </div>

                <div className="trainer-card__silhouette" aria-hidden="true">
                  <span className="trainer-card__silhouette-cap" />
                  <span className="trainer-card__silhouette-head" />
                  <span className="trainer-card__silhouette-body" />
                </div>
              </div>

              <div className="trainer-card__badges">
                <span className="trainer-card__badges-label">Badges</span>
                <div className="trainer-card__badges-row">
                  {KANTO_BADGE_NAMES.map((badge) => (
                    <span
                      key={badge}
                      className={`trainer-card__badge${
                        earned.has(badge) ? " trainer-card__badge--earned" : ""
                      }`}
                      title={badge}
                      aria-label={badge}
                    />
                  ))}
                </div>
              </div>
            </div>

            <p className="import-modal__hint trainer-card__team-note">
              Current team: coming soon.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
