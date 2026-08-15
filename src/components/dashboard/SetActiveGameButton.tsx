"use client";

import { ChangeEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function SetActiveGameButton({
  slug,
  name,
  isActive,
  existingRomFilename,
}: {
  slug: string;
  name: string;
  isActive: boolean;
  existingRomFilename: string | null;
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [romFile, setRomFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

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
        .update({ active_game_slug: slug })
        .eq("id", user.id);
      if (updateError) throw updateError;

      setIsOpen(false);
      setRomFile(null);
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
        .update({ active_game_slug: null })
        .eq("id", user.id);
      if (updateError) throw updateError;

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
