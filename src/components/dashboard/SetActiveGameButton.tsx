"use client";

import {
  ChangeEvent,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import {
  parseFireRedSave,
  type FireRedSaveStats,
  type PartyPokemon,
} from "@/lib/pokemon-saves/firered";
import type { Emulator } from "@/lib/emulators";
import { PokemonTeam } from "@/components/PokemonTeam";
import { formatElapsed } from "@/lib/format";

// How often to re-read the save file once a File System Access API handle
// is picked — the emulator keeps overwriting the same .sav while playing.
const AUTO_SYNC_INTERVAL_MS = 15_000;

// Feature support never changes after mount, so no real subscription is
// needed — this is just useSyncExternalStore's sanctioned way to read a
// client-only value without a server/client hydration mismatch.
function subscribeNoop() {
  return () => {};
}
function getFsaSupportSnapshot() {
  return typeof window !== "undefined" && "showOpenFilePicker" in window;
}
function getFsaSupportServerSnapshot() {
  return false;
}

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
  initialParty,
  emulators,
}: {
  slug: string;
  name: string;
  gameId: string | null;
  isActive: boolean;
  existingRomFilename: string | null;
  initialProgress: number;
  initialSyncCount: number;
  initialParty: PartyPokemon[];
  emulators: (Emulator & { icon: string | null })[];
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isTeamOpen, setIsTeamOpen] = useState(false);
  const [isEmulatorGuideOpen, setIsEmulatorGuideOpen] = useState(false);
  const [selectedEmulatorId, setSelectedEmulatorId] = useState<string | null>(
    null,
  );
  const [romFile, setRomFile] = useState<File | null>(null);
  const [startDate, setStartDate] = useState(todayLocalDate());
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState(initialProgress);
  const [party, setParty] = useState<PartyPokemon[]>(initialParty);
  const [syncStats, setSyncStats] = useState<FireRedSaveStats | null>(null);
  const [syncError, setSyncError] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncCount, setSyncCount] = useState(initialSyncCount);
  const isFsaSupported = useSyncExternalStore(
    subscribeNoop,
    getFsaSupportSnapshot,
    getFsaSupportServerSnapshot,
  );
  const [fileHandle, setFileHandle] = useState<FileSystemFileHandle | null>(
    null,
  );
  const [autoSync, setAutoSync] = useState(false);
  const saveParser = SAVE_PARSERS[slug];
  const syncCountRef = useRef(initialSyncCount);

  async function syncFromFile(file: File) {
    if (!saveParser) return;

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

      const nextSyncCount = syncCountRef.current + 1;
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
          active_game_party: stats.party,
        })
        .eq("id", user.id);
      if (updateError) throw updateError;

      syncCountRef.current = nextSyncCount;
      setProgress(stats.progress);
      setSyncStats(stats);
      setSyncCount(nextSyncCount);
      setParty(stats.party);
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

  const syncFromFileRef = useRef(syncFromFile);
  useEffect(() => {
    syncFromFileRef.current = syncFromFile;
  });

  useEffect(() => {
    if (!fileHandle || !autoSync) return;

    const interval = setInterval(async () => {
      try {
        const file = await fileHandle.getFile();
        await syncFromFileRef.current(file);
      } catch {
        setSyncError("Lost access to the save file — pick it again.");
        setAutoSync(false);
        setFileHandle(null);
      }
    }, AUTO_SYNC_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [fileHandle, autoSync]);

  async function handleSaveFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    await syncFromFile(file);
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
      setFileHandle(handle);
      setAutoSync(true);
      const file = await handle.getFile();
      await syncFromFile(file);
    } catch (err) {
      if (err instanceof Error && err.name !== "AbortError") {
        setSyncError("Couldn't open that file — try again.");
      }
    }
  }

  function stopAutoSync() {
    setAutoSync(false);
    setFileHandle(null);
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

      let runId: string | null = null;
      if (gameId) {
        const { data: run, error: runError } = await supabase
          .from("runs")
          .insert({
            runner_id: user.id,
            game_id: gameId,
            started_at: startedAt,
          })
          .select("id")
          .single();
        if (runError) throw runError;
        runId = run.id;
      }

      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          active_game_slug: slug,
          active_game_run_id: runId,
          active_game_started_at: startedAt,
          active_game_progress: 0,
          active_game_sync_count: 0,
          active_game_badges: 0,
          active_game_pokedex_caught: 0,
          active_game_playtime_seconds: 0,
          active_game_player_name: null,
          active_game_badge_names: [],
          active_game_party: [],
        })
        .eq("id", user.id);
      if (updateError) throw updateError;

      setIsOpen(false);
      setRomFile(null);
      setSyncCount(0);
      syncCountRef.current = 0;
      setSyncStats(null);
      setParty([]);
      setAutoSync(false);
      setFileHandle(null);
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
        <div className="game-hero__active-row">
          <button
            type="button"
            className="game-hero__active-btn"
            onClick={openModal}
            disabled={isSaving}
          >
            {`Add a run — ${name}`}
          </button>

          {emulators.length > 0 && (
            <button
              type="button"
              className="game-hero__how-to-btn"
              onClick={() => {
                setSelectedEmulatorId(null);
                setIsEmulatorGuideOpen(true);
              }}
            >
              How to add ROM
            </button>
          )}
        </div>
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
          {isFsaSupported ? (
            fileHandle ? (
              <div className="game-hero__sync-live">
                <span className="game-hero__sync-live-dot" aria-hidden="true" />
                {isSyncing
                  ? "Reading save…"
                  : `Auto-syncing "${fileHandle.name}" every ${
                      AUTO_SYNC_INTERVAL_MS / 1000
                    }s`}
                <button
                  type="button"
                  className="game-hero__sync-stop"
                  onClick={stopAutoSync}
                >
                  Stop
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="game-hero__sync-btn"
                onClick={handlePickSaveFile}
                disabled={isSyncing}
              >
                {isSyncing ? "Reading save…" : "Sync save file (.sav)"}
              </button>
            )
          ) : (
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
          )}

          {syncError && <p className="import-modal__error">{syncError}</p>}

          {syncStats && (
            <p className="game-hero__sync-result">
              Synced: {syncStats.badgeCount}/8 badges · {syncStats.pokedexOwned}
              /386 caught · {formatElapsed(syncStats.playTimeSeconds * 1000)}{" "}
              played
            </p>
          )}

          {party.length > 0 && (
            <button
              type="button"
              className="game-hero__sync-team-btn"
              onClick={() => setIsTeamOpen(true)}
            >
              View team
            </button>
          )}

          {syncCount > 0 && (
            <p className="game-hero__sync-count">
              Synced {syncCount} time{syncCount === 1 ? "" : "s"} this run
            </p>
          )}
        </div>
      )}

      {isTeamOpen && (
        <div
          className="import-modal-overlay"
          onClick={() => setIsTeamOpen(false)}
        >
          <div
            className="import-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="import-modal__header">
              <span className="import-modal__title">Your team</span>
              <button
                type="button"
                className="import-modal__close"
                onClick={() => setIsTeamOpen(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <PokemonTeam party={party} />
          </div>
        </div>
      )}

      {isEmulatorGuideOpen && (
        <div
          className="import-modal-overlay"
          onClick={() => setIsEmulatorGuideOpen(false)}
        >
          <div
            className="import-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="import-modal__header">
              <span className="import-modal__title">
                Which emulator are you using?
              </span>
              <button
                type="button"
                className="import-modal__close"
                onClick={() => setIsEmulatorGuideOpen(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <p className="import-modal__hint">
              Pick your emulator to see where it keeps the .sav file for{" "}
              {name}.
            </p>

            <div className="emulator-grid">
              {emulators.map((emulator) => (
                <button
                  type="button"
                  key={emulator.id}
                  className={`emulator-card${
                    selectedEmulatorId === emulator.id
                      ? " emulator-card--selected"
                      : ""
                  }`}
                  onClick={() => setSelectedEmulatorId(emulator.id)}
                >
                  <span className="emulator-card__icon">
                    {emulator.icon ? (
                      <Image src={emulator.icon} alt="" fill sizes="48px" />
                    ) : (
                      <span aria-hidden="true">
                        {emulator.name.slice(0, 2).toUpperCase()}
                      </span>
                    )}
                  </span>
                  <span className="emulator-card__name">{emulator.name}</span>
                </button>
              ))}
            </div>

            {selectedEmulatorId && (
              <p className="import-modal__hint">
                General steps: open{" "}
                {emulators.find((e) => e.id === selectedEmulatorId)?.name},
                load your {name} ROM, and look for the .sav saved right next
                to it (or in the emulator&apos;s own saves folder) — that&apos;s
                the file you sync here.
              </p>
            )}
          </div>
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
