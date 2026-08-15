"use client";

import { ChangeEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  parseFireRedSave,
  type FireRedSaveStats,
} from "@/lib/pokemon-saves/firered";
import { formatElapsed } from "@/lib/format";

// Per-game .sav parsers. Each Pokémon game generation uses a different save
// format, so this grows one entry at a time — FireRed/LeafGreen first since
// Gen III saves are unencrypted and fully reverse-engineered.
const SAVE_PARSERS: Partial<
  Record<string, (buffer: ArrayBuffer) => FireRedSaveStats | null>
> = {
  "pokemon-fire-red": parseFireRedSave,
  "pokemon-leaf-green": parseFireRedSave,
};

function todayLocalDate() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

export function SetActiveGameButton({
  slug,
  name,
  gameId,
  isActive,
  existingRomFilename,
  initialProgress,
  initialSyncCount,
}: {
  slug: string;
  name: string;
  gameId: string | null;
  isActive: boolean;
  existingRomFilename: string | null;
  initialProgress: number;
  initialSyncCount: number;
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [romFile, setRomFile] = useState<File | null>(null);
  const [startDate, setStartDate] = useState(todayLocalDate());
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState(initialProgress);
  const [syncStats, setSyncStats] = useState<FireRedSaveStats | null>(null);
  const [syncError, setSyncError] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncCount, setSyncCount] = useState(initialSyncCount);
  const saveParser = SAVE_PARSERS[slug];

  async function handleSaveFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !saveParser) return;

    setIsSyncing(true);
    setSyncError("");
    setSyncStats(null);

    try {
      const buffer = await file.arrayBuffer();
      const stats = saveParser(buffer);

      if (!stats) {
        throw new Error(
          "Couldn't read that save file — make sure it's a real .sav for this game.",
        );
      }

      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("You need to be signed in to do that.");

      const nextSyncCount = syncCount + 1;
      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          active_game_progress: stats.progress,
          active_game_sync_count: nextSyncCount,
          active_game_badges: stats.badgeCount,
          active_game_pokedex_caught: stats.pokedexOwned,
          active_game_playtime_seconds: stats.playTimeSeconds,
          active_game_player_name: stats.playerName || null,
          active_game_badge_names: stats.badges,
        })
        .eq("id", user.id);
      if (updateError) throw updateError;

      setProgress(stats.progress);
      setSyncStats(stats);
      setSyncCount(nextSyncCount);
      router.refresh();
    } catch (err) {
      setSyncError(
        err instanceof Error
          ? err.message
          : "Couldn't read that save file — try again.",
      );
    } finally {
      setIsSyncing(false);
    }
  }

  function openModal() {
    setRomFile(null);
    setStartDate(todayLocalDate());
    setError("");
    setIsOpen(true);
  }

  function close() {
    if (isSaving) return;
    setIsOpen(false);
    setRomFile(null);
    setError("");
  }

  function handleRomChange(event: ChangeEvent<HTMLInputElement>) {
    setRomFile(event.target.files?.[0] ?? null);
  }

  function handleStartDateChange(event: ChangeEvent<HTMLInputElement>) {
    setStartDate(event.target.value);
  }

  async function setActive(uploadRom: boolean) {
    if (isSaving) return;

    if (!startDate) {
      setError("Pick the date you started this run.");
      return;
    }

    setIsSaving(true);
    setError("");

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error("You need to be signed in to do that.");

      const startedAt = new Date(`${startDate}T00:00:00`).toISOString();

      if (uploadRom && romFile) {
        const safeName = romFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${user.id}/${slug}-${Date.now()}-${safeName}`;

        const { error: uploadError } = await supabase.storage
          .from("game-roms")
          .upload(path, romFile);
        if (uploadError) throw uploadError;

        const { error: romError } = await supabase.from("game_roms").upsert(
          {
            user_id: user.id,
            game_slug: slug,
            rom_path: path,
            rom_filename: romFile.name,
          },
          { onConflict: "user_id,game_slug" },
        );
        if (romError) throw romError;
      }

      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          active_game_slug: slug,
          active_game_started_at: startedAt,
          active_game_progress: 0,
          active_game_sync_count: 0,
          active_game_badges: 0,
          active_game_pokedex_caught: 0,
          active_game_playtime_seconds: 0,
          active_game_player_name: null,
          active_game_badge_names: [],
        })
        .eq("id", user.id);
      if (updateError) throw updateError;

      if (gameId) {
        const { error: runError } = await supabase.from("runs").insert({
          runner_id: user.id,
          game_id: gameId,
          started_at: startedAt,
        });
        if (runError) throw runError;
      }

      setIsOpen(false);
      setRomFile(null);
      setSyncCount(0);
      setSyncStats(null);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Couldn't save that — try again.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="game-hero__active">
      {!isActive && (
        <button
          type="button"
          className="game-hero__active-btn"
          onClick={openModal}
          disabled={isSaving}
        >
          {`Add a run — ${name}`}
        </button>
      )}

      {isActive && (
        <div className="game-hero__progress">
          <span className="game-hero__progress-label">
            Progress — {progress}%
          </span>
          <span className="game-hero__progress-bar">
            <span
              className="game-hero__progress-fill"
              style={{ width: `${progress}%` }}
            />
          </span>
        </div>
      )}

      {isActive && saveParser && (
        <div className="game-hero__sync">
          <label className="game-hero__sync-upload">
            {isSyncing ? "Reading save…" : "Sync save file (.sav)"}
            <input
              type="file"
              accept=".sav"
              onChange={handleSaveFileChange}
              disabled={isSyncing}
              hidden
            />
          </label>

          {syncError && <p className="import-modal__error">{syncError}</p>}

          {syncStats && (
            <p className="game-hero__sync-result">
              Synced: {syncStats.badgeCount}/8 badges · {syncStats.pokedexOwned}
              /386 caught · {formatElapsed(syncStats.playTimeSeconds * 1000)}{" "}
              played
            </p>
          )}

          {syncCount > 0 && (
            <p className="game-hero__sync-count">
              Synced {syncCount} time{syncCount === 1 ? "" : "s"} this run
            </p>
          )}
        </div>
      )}

      {isOpen && (
        <div className="import-modal-overlay" onClick={close}>
          <div
            className="import-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="import-modal__header">
              <span className="import-modal__title">New run — {name}</span>
              <button
                type="button"
                className="import-modal__close"
                onClick={close}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <p className="import-modal__hint">
              Attach your {name} ROM so rivals can start pulling live
              stats and progress from it.
            </p>

            {existingRomFilename && !romFile && (
              <p className="import-modal__hint">
                Current ROM: <strong>{existingRomFilename}</strong>
              </p>
            )}

            <label className="edit-profile-form__upload">
              {romFile ? romFile.name : "Choose ROM file"}
              <input type="file" onChange={handleRomChange} hidden />
            </label>

            <label className="import-modal__field">
              Run started on
              <input
                type="date"
                className="import-modal__date"
                value={startDate}
                max={todayLocalDate()}
                onChange={handleStartDateChange}
              />
            </label>

            {error && <p className="import-modal__error">{error}</p>}

            <div className="import-modal__actions">
              <button
                type="button"
                className="import-modal__back"
                onClick={() => setActive(false)}
                disabled={isSaving}
              >
                Register without ROM
              </button>
              <button
                type="button"
                className="import-modal__submit import-modal__continue"
                onClick={() => setActive(true)}
                disabled={isSaving || !romFile}
              >
                {isSaving ? "Saving…" : "Register run"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
