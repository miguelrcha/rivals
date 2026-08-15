"use client";

import { ReactNode, useState } from "react";
import { GameComments } from "@/components/games/GameComments";
import { GameScreenshots } from "@/components/games/GameScreenshots";

type Tab = "leaderboard" | "levels" | "guides" | "comments" | "screenshots";

type CurrentUserProfile = {
  username: string;
  displayName: string;
  avatarColor: string;
  avatarInitial: string;
  avatarUrl: string | null;
};

const TABS: { key: Tab; label: string }[] = [
  { key: "leaderboard", label: "Leaderboard" },
  { key: "levels", label: "Levels" },
  { key: "guides", label: "Guides" },
  { key: "comments", label: "Comments" },
  { key: "screenshots", label: "Screenshots" },
];

export function GameTabs({
  slug,
  userId,
  currentUserProfile,
  children,
}: {
  slug: string;
  userId: string | null;
  currentUserProfile: CurrentUserProfile | null;
  children: ReactNode;
}) {
  const [tab, setTab] = useState<Tab>("leaderboard");

  return (
    <>
      <nav className="game-tabs" aria-label="Game sections">
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`game-tabs__item${
              tab === item.key ? " game-tabs__item--active" : ""
            }`}
            onClick={() => setTab(item.key)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {tab === "leaderboard" && children}

      {tab === "levels" && (
        <div className="dashboard-panel">
          <div className="profile-empty">
            <p className="profile-empty__title">COMING SOON</p>
            <p className="profile-empty__body">
              Level-by-level splits aren&apos;t tracked yet.
            </p>
          </div>
        </div>
      )}

      {tab === "guides" && (
        <div className="dashboard-panel">
          <div className="profile-empty">
            <p className="profile-empty__title">COMING SOON</p>
            <p className="profile-empty__body">
              No guides written for this game yet.
            </p>
          </div>
        </div>
      )}

      {tab === "comments" && (
        <GameComments
          slug={slug}
          userId={userId}
          currentUserProfile={currentUserProfile}
        />
      )}
      {tab === "screenshots" && (
        <GameScreenshots
          slug={slug}
          userId={userId}
          currentUserProfile={currentUserProfile}
        />
      )}
    </>
  );
}
