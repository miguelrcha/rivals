"use client";

import { ChangeEvent, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  parseFireRedSave,
  type FireRedSaveStats,
} from "@/lib/pokemon-saves/firered";

// Same subscription-less useSyncExternalStore trick as SetActiveGameButton —
// feature support never changes after mount, this just avoids a
// server/client hydration mismatch when reading it.
function subscribeNoop() {
  return () => {};
}
function getFsaSupportSnapshot() {
  return typeof window !== "undefined" && "showOpenFilePicker" in window;
}
function getFsaSupportServerSnapshot() {
  return false;
}

const SAVE_PARSERS: Partial<
  Record<string, (buffer: ArrayBuffer) => FireRedSaveStats | null>
> = {
  "pokemon-fire-red": parseFireRedSave,
  "pokemon-leaf-green": parseFireRedSave,
};

type Props = {
  slug: string;
  userId: string;
  syncCount: number;
};

export function SyncSaveButton({ slug, userId, syncCount }: Props) {
  const router = useRouter();
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState("");
  const isFsaSupported = useSyncExternalStore(
    subscribeNoop,
    getFsaSupportSnapshot,
    getFsaSupportServerSnapshot,
  );
  const saveParser = SAVE_PARSERS[slug];

  if (!saveParser) return null;

  async function syncFromFile(file: File) {
    setIsSyncing(true);
    setError("");

    try {
      const buffer = await file.arrayBuffer();
      const stats = saveParser!(buffer);

      if (!stats) {
        throw new Error(
          "Couldn't read that save file — make sure it's a real .sav for this game.",
        );
      }

      const supabase = createClient();
      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          active_game_progress: stats.progress,
          active_game_sync_count: syncCount + 1,
          active_game_badges: stats.badgeCount,
          active_game_pokedex_caught: stats.pokedexOwned,
          active_game_playtime_seconds: stats.playTimeSeconds,
          active_game_player_name: stats.playerName || null,
          active_game_badge_names: stats.badges,
          active_game_party: stats.party,
        })
        .eq("id", userId);
      if (updateError) throw updateError;

      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Couldn't read that save file — try again.",
      );
    } finally {
      setIsSyncing(false);
    }
  }

  async function handlePickSaveFile() {
    if (!window.showOpenFilePicker) return;

    try {
      const [handle] = await window.showOpenFilePicker({
        types: [
          {
            description: "Save file",
            accept: { "application/octet-stream": [".sav"] },
          },
        ],
      });
      const file = await handle.getFile();
      await syncFromFile(file);
    } catch (err) {
      if (err instanceof Error && err.name !== "AbortError") {
        setError("Couldn't open that file — try again.");
      }
    }
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    await syncFromFile(file);
  }

  return (
    <>
      {isFsaSupported ? (
        <button
          type="button"
          className="active-runs__team-btn"
          onClick={handlePickSaveFile}
          disabled={isSyncing}
        >
          {isSyncing ? "Syncing…" : "Sync save (.sav)"}
        </button>
      ) : (
        <label className="active-runs__team-btn">
          {isSyncing ? "Syncing…" : "Sync save (.sav)"}
          <input
            type="file"
            accept=".sav"
            onChange={handleFileChange}
            disabled={isSyncing}
            hidden
          />
        </label>
      )}

      {error && <p className="import-modal__error">{error}</p>}
    </>
  );
}
