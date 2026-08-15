"use client";

import { ChangeEvent, useRef, useState } from "react";
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

export function SetActiveGameButton({
  slug,
  name,
  isActive,
  existingRomFilename,
  initialProgress,
  initialSyncCount,
}: {
  slug: string;
  name: string;
  isActive: boolean;
  existingRomFilename: string | null;
  initialProgress: number;
  initialSyncCount: number;
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [romFile, setRomFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState(initialProgress);
  const progressSaveTimeout = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
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

  function handleProgressChange(event: ChangeEvent<HTMLInputElement>) {
    const value = Number(event.target.value);
    setProgress(value);

    if (progressSaveTimeout.current) {
      clearTimeout(progressSaveTimeout.current);
    }
    progressSaveTimeout.current = setTimeout(async () => {
      const supabase = createClient();
      await supabase
        .from("profiles")
        .update({ active_game_progress: value })
        .eq("id", (await supabase.auth.getUser()).data.user?.id ?? "");
      router.refresh();
    }, 400);
  }

  function openModal() {
    setRomFile(null);
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

  async function setActive(uploadRom: boolean) {
    if (isSaving) return;

    setIsSaving(true);
    setError("");

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error("You need to be signed in to do that.");

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
          active_game_started_at: new Date().toISOString(),
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

  async function handleClear() {
    if (isSaving) return;

    setIsSaving(true);
    setError("");

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          active_game_slug: null,
          active_game_started_at: null,
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

      setSyncCount(0);
      setSyncStats(null);
      router.refresh();
    } catch {
      setError("Couldn't clear that — try again.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="game-hero__active">
      <button
        type="button"
        className={`game-hero__active-btn${
          isActive ? " game-hero__active-btn--active" : ""
        }`}
        onClick={isActive ? handleClear : openModal}
        disabled={isSaving}
      >
        {isActive
          ? "🎮 Active game — clear"
          : `Set ${name} as active game`}
      </button>

      {isActive && (
        <div className="game-hero__progress">
          <label htmlFor="active-game-progress">
            Progress — {progress}%
          </label>
          <input
            id="active-game-progress"
            type="range"
            min={0}
            max={100}
            value={progress}
            onChange={handleProgressChange}
          />
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
              <span className="import-modal__title">Add ROM — {name}</span>
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

            {error && <p className="import-modal__error">{error}</p>}

            <div className="import-modal__actions">
              <button
                type="button"
                className="import-modal__back"
                onClick={() => setActive(false)}
                disabled={isSaving}
              >
                Skip for now
              </button>
              <button
                type="button"
                className="import-modal__submit import-modal__continue"
                onClick={() => setActive(true)}
                disabled={isSaving || !romFile}
              >
                {isSaving ? "Saving…" : "Save & set active"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
