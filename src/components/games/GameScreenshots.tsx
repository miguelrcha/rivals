"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { HeartIcon } from "@/components/HeartIcon";
import { formatTimeAgo } from "@/lib/format";

const PROFILE_FIELDS =
  "id, username, display_name, avatar_color, avatar_initial, avatar_url";
const MAX_FILE_BYTES = 8 * 1024 * 1024;

type ProfileSummary = {
  id: string;
  username: string;
  display_name: string;
  avatar_color: string;
  avatar_initial: string;
  avatar_url: string | null;
};

type Screenshot = {
  id: string;
  userId: string;
  imagePath: string;
  imageUrl: string;
  caption: string | null;
  createdAt: string;
  profile: ProfileSummary;
};

type LikeState = { count: number; likedByMe: boolean };

type CurrentUserProfile = {
  username: string;
  displayName: string;
  avatarColor: string;
  avatarInitial: string;
  avatarUrl: string | null;
};

export function GameScreenshots({
  slug,
  userId,
  currentUserProfile,
}: {
  slug: string;
  userId: string | null;
  currentUserProfile: CurrentUserProfile | null;
}) {
  const [screenshots, setScreenshots] = useState<Screenshot[]>([]);
  const [likes, setLikes] = useState<Record<string, LikeState>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    async function load() {
      const { data: rows } = await supabase
        .from("game_screenshots")
        .select(
          `id, user_id, image_path, caption, created_at, profile:profiles!game_screenshots_user_id_fkey(${PROFILE_FIELDS})`,
        )
        .eq("game_slug", slug)
        .order("created_at", { ascending: false });

      const loaded = (rows ?? []).map((row) => ({
        id: row.id as string,
        userId: row.user_id as string,
        imagePath: row.image_path as string,
        imageUrl: supabase.storage
          .from("game-screenshots")
          .getPublicUrl(row.image_path as string).data.publicUrl,
        caption: row.caption as string | null,
        createdAt: row.created_at as string,
        profile: row.profile as unknown as ProfileSummary,
      }));

      const ids = loaded.map((s) => s.id);
      const { data: likeRows } = ids.length
        ? await supabase
            .from("game_screenshot_likes")
            .select("screenshot_id, user_id")
            .in("screenshot_id", ids)
        : { data: [] };

      if (cancelled) return;

      const nextLikes: Record<string, LikeState> = {};
      for (const id of ids) nextLikes[id] = { count: 0, likedByMe: false };
      for (const row of likeRows ?? []) {
        const screenshotId = row.screenshot_id as string;
        const state = nextLikes[screenshotId] ?? { count: 0, likedByMe: false };
        state.count += 1;
        if (row.user_id === userId) state.likedByMe = true;
        nextLikes[screenshotId] = state;
      }

      setScreenshots(loaded);
      setLikes(nextLikes);
      setIsLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [slug, userId]);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const picked = event.target.files?.[0] ?? null;
    if (picked && picked.size > MAX_FILE_BYTES) {
      setError("That image is too large — max 8MB.");
      setFile(null);
      return;
    }
    setError("");
    setFile(picked);
  }

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId || !file) return;

    setIsUploading(true);
    setError("");

    try {
      const supabase = createClient();
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${userId}/${slug}-${Date.now()}-${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from("game-screenshots")
        .upload(path, file);
      if (uploadError) throw uploadError;

      const { data, error: insertError } = await supabase
        .from("game_screenshots")
        .insert({
          game_slug: slug,
          user_id: userId,
          image_path: path,
          caption: caption.trim() || null,
        })
        .select(
          `id, user_id, image_path, caption, created_at, profile:profiles!game_screenshots_user_id_fkey(${PROFILE_FIELDS})`,
        )
        .single();
      if (insertError || !data) throw insertError ?? new Error("insert failed");

      const imageUrl = supabase.storage
        .from("game-screenshots")
        .getPublicUrl(path).data.publicUrl;

      setScreenshots((current) => [
        {
          id: data.id as string,
          userId: data.user_id as string,
          imagePath: data.image_path as string,
          imageUrl,
          caption: data.caption as string | null,
          createdAt: data.created_at as string,
          profile: data.profile as unknown as ProfileSummary,
        },
        ...current,
      ]);
      setLikes((current) => ({
        ...current,
        [data.id as string]: { count: 0, likedByMe: false },
      }));
      setFile(null);
      setCaption("");
    } catch {
      setError("Couldn't upload that screenshot — try again.");
    } finally {
      setIsUploading(false);
    }
  }

  async function handleDelete(shot: Screenshot) {
    const supabase = createClient();
    const { error: deleteError } = await supabase
      .from("game_screenshots")
      .delete()
      .eq("id", shot.id);

    if (deleteError) {
      setError("Couldn't delete that — try again.");
      return;
    }

    await supabase.storage.from("game-screenshots").remove([shot.imagePath]);
    setScreenshots((current) => current.filter((s) => s.id !== shot.id));
  }

  async function handleToggleLike(screenshotId: string) {
    if (!userId) return;
    const current = likes[screenshotId] ?? { count: 0, likedByMe: false };
    const supabase = createClient();

    if (current.likedByMe) {
      setLikes((state) => ({
        ...state,
        [screenshotId]: { count: current.count - 1, likedByMe: false },
      }));
      await supabase
        .from("game_screenshot_likes")
        .delete()
        .eq("screenshot_id", screenshotId)
        .eq("user_id", userId);
    } else {
      setLikes((state) => ({
        ...state,
        [screenshotId]: { count: current.count + 1, likedByMe: true },
      }));
      await supabase
        .from("game_screenshot_likes")
        .insert({ screenshot_id: screenshotId, user_id: userId });
    }
  }

  return (
    <div className="dashboard-panel game-screenshots-panel">
      <div className="dashboard-panel__header">
        <span className="dashboard-panel__title">SCREENSHOTS</span>
        <span className="friends-count">{screenshots.length}</span>
      </div>

      {userId && currentUserProfile ? (
        <form className="composer" onSubmit={handleUpload}>
          <div className="composer__row">
            <span
              className="composer__avatar"
              style={{ background: currentUserProfile.avatarColor }}
              aria-hidden="true"
            >
              {currentUserProfile.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={currentUserProfile.avatarUrl} alt="" />
              ) : (
                currentUserProfile.avatarInitial
              )}
            </span>
            <textarea
              className="composer__input"
              value={caption}
              onChange={(event) => setCaption(event.target.value)}
              placeholder="Add a caption..."
              rows={2}
            />
          </div>

          {file && (
            <div className="composer__attachment">
              📎 {file.name}
              <button
                type="button"
                className="composer__attachment-remove"
                onClick={() => setFile(null)}
                aria-label="Remove attachment"
              >
                ✕
              </button>
            </div>
          )}

          <div className="composer__footer">
            <div className="composer__icons">
              <label className="composer__icon-btn" aria-label="Add screenshot">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <path d="m21 15-5-5L5 21" />
                </svg>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  hidden
                />
              </label>
            </div>
            <button
              type="submit"
              className="composer__submit"
              disabled={isUploading || !file}
            >
              {isUploading ? "Uploading…" : "Post"}
            </button>
          </div>
        </form>
      ) : (
        <p className="import-modal__hint">Sign in to post a screenshot.</p>
      )}

      {error && <p className="import-modal__error">{error}</p>}

      {!isLoading && screenshots.length === 0 && (
        <div className="profile-empty">
          <p className="profile-empty__body">
            No screenshots yet — post the first one.
          </p>
        </div>
      )}

      <div className="game-screenshots-grid">
        {screenshots.map((shot) => {
          const like = likes[shot.id] ?? { count: 0, likedByMe: false };
          return (
            <div className="game-screenshot-card" key={shot.id}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={shot.imageUrl}
                alt={shot.caption ?? ""}
                className="game-screenshot-card__image"
              />
              <div className="game-screenshot-card__body">
                <div className="game-comment__head">
                  <Link
                    href={`/users/${shot.profile.username}`}
                    className="game-comment__name"
                  >
                    {shot.profile.display_name}
                  </Link>
                  <span className="game-comment__date">
                    {formatTimeAgo(shot.createdAt)}
                  </span>
                </div>

                {shot.caption && (
                  <p className="game-comment__text">{shot.caption}</p>
                )}

                <div className="game-comment__actions">
                  <button
                    type="button"
                    className={`game-comment__action game-comment__action--like${
                      like.likedByMe ? " game-comment__action--liked" : ""
                    }`}
                    onClick={() => handleToggleLike(shot.id)}
                    disabled={!userId}
                  >
                    <HeartIcon filled={like.likedByMe} />
                    {like.count > 0 ? like.count : ""}
                  </button>

                  {userId === shot.userId && (
                    <button
                      type="button"
                      className="game-comment__action game-comment__action--delete"
                      onClick={() => handleDelete(shot)}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
