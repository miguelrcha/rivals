"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Props = {
  userId: string;
  runId: string | null;
  gameName: string;
};

export function EditRunButton({ userId, runId, gameName }: Props) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState("");

  function close() {
    if (isSaving) return;
    setIsOpen(false);
    setConfirmDelete(false);
    setError("");
  }

  async function clearActiveGameFields() {
    return createClient()
      .from("profiles")
      .update({
        active_game_slug: null,
        active_game_run_id: null,
        active_game_started_at: null,
        active_game_progress: 0,
        active_game_sync_count: 0,
        active_game_badges: 0,
        active_game_pokedex_caught: 0,
        active_game_playtime_seconds: 0,
        active_game_player_name: null,
        active_game_badge_names: [],
        active_game_party: [],
      })
      .eq("id", userId);
  }

  async function markCompleted(cleared: boolean) {
    if (isSaving) return;
    setIsSaving(true);
    setError("");

    const supabase = createClient();

    if (runId) {
      const { error: runError } = await supabase
        .from("runs")
        .update({ cleared, completed_at: new Date().toISOString() })
        .eq("id", runId);
      if (runError) {
        setError(runError.message);
        setIsSaving(false);
        return;
      }
    }

    const { error: profileError } = await clearActiveGameFields();
    setIsSaving(false);
    if (profileError) {
      setError(profileError.message);
      return;
    }

    setIsOpen(false);
    router.refresh();
  }

  async function handleDelete() {
    if (isSaving) return;

    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }

    setIsSaving(true);
    setError("");

    const supabase = createClient();

    if (runId) {
      const { error: runError } = await supabase
        .from("runs")
        .delete()
        .eq("id", runId);
      if (runError) {
        setError(runError.message);
        setIsSaving(false);
        return;
      }
    }

    const { error: profileError } = await clearActiveGameFields();
    setIsSaving(false);
    if (profileError) {
      setError(profileError.message);
      return;
    }

    setIsOpen(false);
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        className="active-runs__team-btn"
        onClick={() => setIsOpen(true)}
      >
        Edit run
      </button>

      {isOpen && (
        <div className="import-modal-overlay" onClick={close}>
          <div
            className="import-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="import-modal__header">
              <span className="import-modal__title">
                Edit your run — {gameName}
              </span>
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
              Mark this run as finished and record whether you cleared{" "}
              {gameName}, or delete it entirely.
            </p>

            <div className="import-modal__actions">
              <button
                type="button"
                className="import-modal__back"
                onClick={() => markCompleted(false)}
                disabled={isSaving}
              >
                Didn&apos;t beat it
              </button>
              <button
                type="button"
                className="import-modal__submit import-modal__continue"
                onClick={() => markCompleted(true)}
                disabled={isSaving}
              >
                {isSaving ? "Saving…" : "Beat it — mark complete"}
              </button>
            </div>

            {error && <p className="import-modal__error">{error}</p>}

            <button
              type="button"
              className="edit-run-modal__delete"
              onClick={handleDelete}
              disabled={isSaving}
            >
              {confirmDelete
                ? "Click again to permanently delete"
                : "Delete this run"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
