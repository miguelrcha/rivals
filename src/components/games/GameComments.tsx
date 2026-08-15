"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { HeartIcon } from "@/components/HeartIcon";
import { formatTimeAgo } from "@/lib/format";

const PROFILE_FIELDS =
  "id, username, display_name, avatar_color, avatar_initial, avatar_url";

type ProfileSummary = {
  id: string;
  username: string;
  display_name: string;
  avatar_color: string;
  avatar_initial: string;
  avatar_url: string | null;
};

type Comment = {
  id: string;
  userId: string;
  parentId: string | null;
  body: string;
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

function mapCommentRow(row: Record<string, unknown>): Comment {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    parentId: row.parent_id as string | null,
    body: row.body as string,
    createdAt: row.created_at as string,
    profile: row.profile as unknown as ProfileSummary,
  };
}

function ComposerAvatar({ profile }: { profile: CurrentUserProfile }) {
  return (
    <span
      className="composer__avatar"
      style={{ background: profile.avatarColor }}
      aria-hidden="true"
    >
      {profile.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={profile.avatarUrl} alt="" />
      ) : (
        profile.avatarInitial
      )}
    </span>
  );
}

export function GameComments({
  slug,
  userId,
  currentUserProfile,
}: {
  slug: string;
  userId: string | null;
  currentUserProfile: CurrentUserProfile | null;
}) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [likes, setLikes] = useState<Record<string, LikeState>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [newBody, setNewBody] = useState("");
  const [isPosting, setIsPosting] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState<Record<string, string>>({});
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    async function load() {
      const { data: commentRows } = await supabase
        .from("game_comments")
        .select(
          `id, user_id, parent_id, body, created_at, profile:profiles!game_comments_user_id_fkey(${PROFILE_FIELDS})`,
        )
        .eq("game_slug", slug)
        .order("created_at", { ascending: true });

      const loaded = (commentRows ?? []).map(mapCommentRow);
      const ids = loaded.map((c) => c.id);

      const { data: likeRows } = ids.length
        ? await supabase
            .from("game_comment_likes")
            .select("comment_id, user_id")
            .in("comment_id", ids)
        : { data: [] };

      if (cancelled) return;

      const nextLikes: Record<string, LikeState> = {};
      for (const id of ids) nextLikes[id] = { count: 0, likedByMe: false };
      for (const row of likeRows ?? []) {
        const commentId = row.comment_id as string;
        const state = nextLikes[commentId] ?? { count: 0, likedByMe: false };
        state.count += 1;
        if (row.user_id === userId) state.likedByMe = true;
        nextLikes[commentId] = state;
      }

      setComments(loaded);
      setLikes(nextLikes);
      setIsLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [slug, userId]);

  async function handlePost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = newBody.trim();
    if (!userId || !body) return;

    setIsPosting(true);
    setError("");
    const supabase = createClient();
    const { data, error: insertError } = await supabase
      .from("game_comments")
      .insert({ game_slug: slug, user_id: userId, body })
      .select(
        `id, user_id, parent_id, body, created_at, profile:profiles!game_comments_user_id_fkey(${PROFILE_FIELDS})`,
      )
      .single();
    setIsPosting(false);

    if (insertError || !data) {
      setError("Couldn't post that — try again.");
      return;
    }

    setComments((current) => [...current, mapCommentRow(data)]);
    setLikes((current) => ({ ...current, [data.id]: { count: 0, likedByMe: false } }));
    setNewBody("");
  }

  async function handleReply(parentId: string) {
    const body = (replyBody[parentId] ?? "").trim();
    if (!userId || !body) return;

    const supabase = createClient();
    const { data, error: insertError } = await supabase
      .from("game_comments")
      .insert({ game_slug: slug, user_id: userId, parent_id: parentId, body })
      .select(
        `id, user_id, parent_id, body, created_at, profile:profiles!game_comments_user_id_fkey(${PROFILE_FIELDS})`,
      )
      .single();

    if (insertError || !data) {
      setError("Couldn't post that reply — try again.");
      return;
    }

    setComments((current) => [...current, mapCommentRow(data)]);
    setLikes((current) => ({ ...current, [data.id]: { count: 0, likedByMe: false } }));
    setReplyBody((current) => ({ ...current, [parentId]: "" }));
    setReplyingTo(null);
  }

  async function handleDelete(commentId: string) {
    const supabase = createClient();
    const { error: deleteError } = await supabase
      .from("game_comments")
      .delete()
      .eq("id", commentId);

    if (deleteError) {
      setError("Couldn't delete that — try again.");
      return;
    }

    setComments((current) =>
      current.filter((c) => c.id !== commentId && c.parentId !== commentId),
    );
  }

  async function handleToggleLike(commentId: string) {
    if (!userId) return;
    const current = likes[commentId] ?? { count: 0, likedByMe: false };
    const supabase = createClient();

    if (current.likedByMe) {
      setLikes((state) => ({
        ...state,
        [commentId]: { count: current.count - 1, likedByMe: false },
      }));
      await supabase
        .from("game_comment_likes")
        .delete()
        .eq("comment_id", commentId)
        .eq("user_id", userId);
    } else {
      setLikes((state) => ({
        ...state,
        [commentId]: { count: current.count + 1, likedByMe: true },
      }));
      await supabase
        .from("game_comment_likes")
        .insert({ comment_id: commentId, user_id: userId });
    }
  }

  const topLevel = comments.filter((c) => c.parentId === null).reverse();
  const repliesByParent = new Map<string, Comment[]>();
  for (const comment of comments) {
    if (!comment.parentId) continue;
    const list = repliesByParent.get(comment.parentId) ?? [];
    list.push(comment);
    repliesByParent.set(comment.parentId, list);
  }

  function renderComment(comment: Comment, isReply: boolean) {
    const like = likes[comment.id] ?? { count: 0, likedByMe: false };

    return (
      <div
        className={`game-comment${isReply ? " game-comment--reply" : ""}`}
        key={comment.id}
      >
        <Link
          href={`/users/${comment.profile.username}`}
          className="game-comment__avatar"
          style={{ background: comment.profile.avatar_color }}
          aria-hidden="true"
        >
          {comment.profile.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={comment.profile.avatar_url} alt="" />
          ) : (
            comment.profile.avatar_initial
          )}
        </Link>

        <div className="game-comment__body">
          <div className="game-comment__head">
            <Link
              href={`/users/${comment.profile.username}`}
              className="game-comment__name"
            >
              {comment.profile.display_name}
            </Link>
            <span className="game-comment__date">
              {formatTimeAgo(comment.createdAt)}
            </span>
          </div>

          <p className="game-comment__text">{comment.body}</p>

          <div className="game-comment__actions">
            <button
              type="button"
              className={`game-comment__action game-comment__action--like${
                like.likedByMe ? " game-comment__action--liked" : ""
              }`}
              onClick={() => handleToggleLike(comment.id)}
              disabled={!userId}
            >
              <HeartIcon filled={like.likedByMe} />
              {like.count > 0 ? like.count : ""}
            </button>

            {!isReply && userId && (
              <button
                type="button"
                className="game-comment__action"
                onClick={() =>
                  setReplyingTo(replyingTo === comment.id ? null : comment.id)
                }
              >
                Reply
              </button>
            )}

            {userId === comment.userId && (
              <button
                type="button"
                className="game-comment__action game-comment__action--delete"
                onClick={() => handleDelete(comment.id)}
              >
                Delete
              </button>
            )}
          </div>

          {!isReply && replyingTo === comment.id && currentUserProfile && (
            <div className="composer composer--reply">
              <div className="composer__row">
                <ComposerAvatar profile={currentUserProfile} />
                <textarea
                  className="composer__input"
                  value={replyBody[comment.id] ?? ""}
                  onChange={(event) =>
                    setReplyBody((current) => ({
                      ...current,
                      [comment.id]: event.target.value,
                    }))
                  }
                  placeholder={`Reply to ${comment.profile.display_name}...`}
                  rows={1}
                />
              </div>
              <div className="composer__footer">
                <button
                  type="button"
                  className="composer__submit"
                  onClick={() => handleReply(comment.id)}
                  disabled={!(replyBody[comment.id] ?? "").trim()}
                >
                  Reply
                </button>
              </div>
            </div>
          )}

          {!isReply && (repliesByParent.get(comment.id) ?? []).length > 0 && (
            <div className="game-comment__replies">
              {(repliesByParent.get(comment.id) ?? []).map((reply) =>
                renderComment(reply, true),
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-panel game-comments-panel">
      <div className="dashboard-panel__header">
        <span className="dashboard-panel__title">COMMENTS</span>
        <span className="friends-count">{topLevel.length}</span>
      </div>

      {userId && currentUserProfile ? (
        <form className="composer" onSubmit={handlePost}>
          <div className="composer__row">
            <ComposerAvatar profile={currentUserProfile} />
            <textarea
              className="composer__input"
              value={newBody}
              onChange={(event) => setNewBody(event.target.value)}
              placeholder="What's happening in this run?"
              rows={2}
            />
          </div>
          <div className="composer__footer">
            <button
              type="submit"
              className="composer__submit"
              disabled={isPosting || !newBody.trim()}
            >
              {isPosting ? "Posting…" : "Post"}
            </button>
          </div>
        </form>
      ) : (
        <p className="import-modal__hint">Sign in to join the discussion.</p>
      )}

      {error && <p className="import-modal__error">{error}</p>}

      {!isLoading && topLevel.length === 0 && (
        <div className="profile-empty">
          <p className="profile-empty__body">
            No comments yet — be the first to say something.
          </p>
        </div>
      )}

      <div className="game-comments-list">
        {topLevel.map((comment) => renderComment(comment, false))}
      </div>
    </div>
  );
}
