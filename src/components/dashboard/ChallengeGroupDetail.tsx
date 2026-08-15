"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { GAMES } from "@/lib/games";

type ProfileSummary = {
  id: string;
  username: string;
  display_name: string;
  avatar_color: string;
  avatar_initial: string;
  avatar_url: string | null;
};

type Completion = {
  userId: string;
  profile: ProfileSummary;
};

type ChallengeItem = {
  id: string;
  gameSlug: string;
  position: number;
  completions: Completion[];
  plays: Completion[];
};

type Member = {
  userId: string;
  profile: ProfileSummary;
};

type Group = {
  id: string;
  name: string;
  ownerId: string;
  inviteCode: string;
};

type Props = {
  userId: string;
  group: Group;
  initialItems: ChallengeItem[];
  initialMembers: Member[];
  initialPendingInvitees: Member[];
  friends: ProfileSummary[];
  covers: Record<string, string>;
};

export function ChallengeGroupDetail({
  userId,
  group,
  initialItems,
  initialMembers,
  initialPendingInvitees,
  friends,
  covers,
}: Props) {
  const router = useRouter();
  const isOwner = group.ownerId === userId;

  const [items, setItems] = useState<ChallengeItem[]>(initialItems);
  const [members, setMembers] = useState<Member[]>(initialMembers);
  const [pendingInvitees, setPendingInvitees] = useState<Member[]>(
    initialPendingInvitees,
  );
  const [invitableFriends, setInvitableFriends] =
    useState<ProfileSummary[]>(friends);
  const [selectedFriendId, setSelectedFriendId] = useState("");
  const [selectedSlug, setSelectedSlug] = useState("");
  const [error, setError] = useState("");
  const [codeCopied, setCodeCopied] = useState(false);
  const [isGamePickerOpen, setIsGamePickerOpen] = useState(false);
  const [gameSearch, setGameSearch] = useState("");
  const gamePickerRef = useRef<HTMLDivElement>(null);

  const addedSlugs = new Set(items.map((item) => item.gameSlug));
  const availableGames = GAMES.filter((game) => !addedSlugs.has(game.slug));
  const myProfile = members.find((m) => m.userId === userId)?.profile;
  const selectedGame = availableGames.find((g) => g.slug === selectedSlug);
  const filteredGames = availableGames.filter((game) =>
    game.name.toLowerCase().includes(gameSearch.trim().toLowerCase()),
  );

  useEffect(() => {
    if (!isGamePickerOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (
        gamePickerRef.current &&
        !gamePickerRef.current.contains(event.target as Node)
      ) {
        setIsGamePickerOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isGamePickerOpen]);

  async function handleCopyCode() {
    try {
      await navigator.clipboard.writeText(group.inviteCode);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 1500);
    } catch {
      // Clipboard access can fail silently (permissions) — the code is
      // still visible on screen for the user to copy by hand.
    }
  }

  async function handleLeaveOrDelete() {
    const supabase = createClient();

    if (isOwner) {
      const { error: deleteError } = await supabase
        .from("challenge_groups")
        .delete()
        .eq("id", group.id);
      if (deleteError) {
        setError("Couldn't delete this challenge — try again.");
        return;
      }
    } else {
      const { error: leaveError } = await supabase
        .from("challenge_group_members")
        .delete()
        .eq("group_id", group.id)
        .eq("user_id", userId);
      if (leaveError) {
        setError("Couldn't leave this challenge — try again.");
        return;
      }
    }

    router.push("/dashboard/challenges");
  }

  async function handleRemoveMember(memberUserId: string) {
    const supabase = createClient();
    const { error: deleteError } = await supabase
      .from("challenge_group_members")
      .delete()
      .eq("group_id", group.id)
      .eq("user_id", memberUserId);

    if (!deleteError) {
      setMembers((current) => current.filter((m) => m.userId !== memberUserId));
    }
  }

  async function handleInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedFriendId) return;

    const friend = invitableFriends.find((f) => f.id === selectedFriendId);
    if (!friend) return;

    const supabase = createClient();
    const { error: inviteError } = await supabase.rpc(
      "invite_challenge_group_member",
      { p_group_id: group.id, p_friend_id: friend.id },
    );

    if (inviteError) {
      setError("Couldn't invite that friend — try again.");
      return;
    }

    setPendingInvitees((current) => [
      ...current,
      { userId: friend.id, profile: friend },
    ]);
    setInvitableFriends((current) => current.filter((f) => f.id !== friend.id));
    setSelectedFriendId("");
  }

  async function handleCancelInvite(memberUserId: string) {
    const supabase = createClient();
    const { error: deleteError } = await supabase
      .from("challenge_group_members")
      .delete()
      .eq("group_id", group.id)
      .eq("user_id", memberUserId);

    if (!deleteError) {
      setPendingInvitees((current) =>
        current.filter((m) => m.userId !== memberUserId),
      );
    }
  }

  async function handleAddGame(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedSlug) return;

    const supabase = createClient();
    const { data, error: insertError } = await supabase
      .from("challenge_items")
      .insert({
        group_id: group.id,
        game_slug: selectedSlug,
        position: items.length,
        added_by: userId,
      })
      .select("id, game_slug, position")
      .single();

    if (!insertError && data) {
      setItems((current) => [
        ...current,
        {
          id: data.id,
          gameSlug: data.game_slug,
          position: data.position,
          completions: [],
          plays: [],
        },
      ]);
      setSelectedSlug("");
    }
  }

  async function handleRemoveItem(itemId: string) {
    const supabase = createClient();
    const { error: deleteError } = await supabase
      .from("challenge_items")
      .delete()
      .eq("id", itemId);

    if (!deleteError) {
      setItems((current) => current.filter((item) => item.id !== itemId));
    }
  }

  async function handleTogglePlaying(itemId: string) {
    if (!myProfile) return;

    const item = items.find((i) => i.id === itemId);
    const alreadyPlaying = item?.plays.some((p) => p.userId === userId);
    const supabase = createClient();

    if (alreadyPlaying) {
      const { error: deleteError } = await supabase
        .from("challenge_item_plays")
        .delete()
        .eq("item_id", itemId)
        .eq("user_id", userId);

      if (!deleteError) {
        setItems((current) =>
          current.map((i) =>
            i.id === itemId
              ? { ...i, plays: i.plays.filter((p) => p.userId !== userId) }
              : i,
          ),
        );
      }
    } else {
      const { error: insertError } = await supabase
        .from("challenge_item_plays")
        .insert({ item_id: itemId, user_id: userId });

      if (!insertError) {
        setItems((current) =>
          current.map((i) =>
            i.id === itemId
              ? { ...i, plays: [...i.plays, { userId, profile: myProfile }] }
              : i,
          ),
        );
      }
    }
  }

  async function handleToggleDone(itemId: string) {
    if (!myProfile) return;

    const item = items.find((i) => i.id === itemId);
    const alreadyDone = item?.completions.some((c) => c.userId === userId);
    const supabase = createClient();

    if (alreadyDone) {
      const { error: deleteError } = await supabase
        .from("challenge_item_completions")
        .delete()
        .eq("item_id", itemId)
        .eq("user_id", userId);

      if (!deleteError) {
        setItems((current) =>
          current.map((i) =>
            i.id === itemId
              ? {
                  ...i,
                  completions: i.completions.filter((c) => c.userId !== userId),
                }
              : i,
          ),
        );
      }
    } else {
      const { error: insertError } = await supabase
        .from("challenge_item_completions")
        .insert({ item_id: itemId, user_id: userId });

      if (!insertError) {
        // Marking it done also stops "currently playing" — you're not still
        // playing something you just finished.
        await supabase
          .from("challenge_item_plays")
          .delete()
          .eq("item_id", itemId)
          .eq("user_id", userId);

        setItems((current) =>
          current.map((i) =>
            i.id === itemId
              ? {
                  ...i,
                  completions: [...i.completions, { userId, profile: myProfile }],
                  plays: i.plays.filter((p) => p.userId !== userId),
                }
              : i,
          ),
        );
      }
    }
  }

  async function handleMove(itemId: string, direction: -1 | 1) {
    const sorted = [...items].sort((a, b) => a.position - b.position);
    const index = sorted.findIndex((item) => item.id === itemId);
    const swapIndex = index + direction;
    if (index === -1 || swapIndex < 0 || swapIndex >= sorted.length) return;

    const current = sorted[index];
    const swap = sorted[swapIndex];

    const supabase = createClient();
    const [{ error: err1 }, { error: err2 }] = await Promise.all([
      supabase
        .from("challenge_items")
        .update({ position: swap.position })
        .eq("id", current.id),
      supabase
        .from("challenge_items")
        .update({ position: current.position })
        .eq("id", swap.id),
    ]);

    if (!err1 && !err2) {
      setItems((currentItems) =>
        currentItems.map((item) => {
          if (item.id === current.id) return { ...item, position: swap.position };
          if (item.id === swap.id) return { ...item, position: current.position };
          return item;
        }),
      );
    }
  }

  const sortedItems = [...items].sort((a, b) => a.position - b.position);

  return (
    <>
      <div className="dashboard-page-header challenge-header">
        <div>
          <Link href="/dashboard/challenges" className="challenge-header__back">
            ← Challenges
          </Link>
          <h1 className="dashboard-page-header__title">{group.name}</h1>
          <p className="dashboard-page-header__subtitle">
            {members.length} member{members.length === 1 ? "" : "s"} racing
            through this queue together.
          </p>
        </div>
        <button
          type="button"
          className="challenge-header__leave"
          onClick={handleLeaveOrDelete}
        >
          {isOwner ? "Delete challenge" : "Leave challenge"}
        </button>
      </div>

      {error && <p className="auth-error">{error}</p>}

      <div className="dashboard-columns">
        <div className="dashboard-panel">
          <div className="dashboard-panel__header">
            <span className="dashboard-panel__title">GAME QUEUE</span>
          </div>

          {sortedItems.length === 0 ? (
            <div className="profile-empty">
              <p className="profile-empty__body">
                No games queued yet — add one below to kick things off.
              </p>
            </div>
          ) : (
            <div className="wishlist-items challenge-queue">
              {sortedItems.map((item, index) => {
                const game = GAMES.find((g) => g.slug === item.gameSlug);
                const cover = covers[item.gameSlug];
                const isDoneByMe = item.completions.some(
                  (c) => c.userId === userId,
                );
                const isPlayingByMe = item.plays.some(
                  (p) => p.userId === userId,
                );
                const rowClass = [
                  "challenge-queue__row",
                  `challenge-queue__row--${item.plays.length > 0 ? "current" : "queued"}`,
                  isDoneByMe ? "challenge-queue__row--done" : "",
                ]
                  .filter(Boolean)
                  .join(" ");

                return (
                  <div className={rowClass} key={item.id}>
                    <div className="challenge-queue__order">
                      <button
                        type="button"
                        onClick={() => handleMove(item.id, -1)}
                        disabled={index === 0}
                        aria-label="Move up"
                      >
                        ▲
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMove(item.id, 1)}
                        disabled={index === sortedItems.length - 1}
                        aria-label="Move down"
                      >
                        ▼
                      </button>
                    </div>

                    <Link
                      href={`/games/${item.gameSlug}`}
                      className="wishlist-item__thumb"
                      style={{ background: game?.color ?? "#3a3a3e" }}
                    >
                      {cover ? (
                        <Image
                          src={cover}
                          alt=""
                          fill
                          sizes="48px"
                          className="wishlist-item__art"
                        />
                      ) : (
                        <span aria-hidden="true">{game?.shortName ?? "?"}</span>
                      )}
                    </Link>

                    <div className="challenge-queue__info">
                      <Link
                        href={`/games/${item.gameSlug}`}
                        className="wishlist-item__name"
                      >
                        {game?.name ?? item.gameSlug}
                      </Link>
                      <span className="challenge-queue__status">
                        {item.plays.length > 0
                          ? `🎮 ${item.plays
                              .map((p) => p.profile.display_name)
                              .join(", ")} Now playing`
                          : "Queued"}
                      </span>
                    </div>

                    <div className="challenge-queue__members">
                      {members.map((member) => {
                        const memberDone = item.completions.some(
                          (c) => c.userId === member.userId,
                        );
                        const memberPlaying = item.plays.some(
                          (p) => p.userId === member.userId,
                        );
                        const stateClass = memberDone
                          ? " challenge-queue__member-avatar--done"
                          : memberPlaying
                            ? " challenge-queue__member-avatar--playing"
                            : "";
                        const statusLabel = memberDone
                          ? " finished this"
                          : memberPlaying
                            ? " is playing this"
                            : " hasn't finished this yet";
                        return (
                          <div
                            key={member.userId}
                            className={`challenge-queue__member-avatar${stateClass}`}
                            style={{ background: member.profile.avatar_color }}
                            title={`${member.profile.display_name}${statusLabel}`}
                          >
                            {member.profile.avatar_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={member.profile.avatar_url} alt="" />
                            ) : (
                              member.profile.avatar_initial
                            )}
                            {memberDone && (
                              <span
                                className="challenge-queue__done-badge"
                                aria-hidden="true"
                              >
                                ✓
                              </span>
                            )}
                            {!memberDone && memberPlaying && (
                              <span
                                className="challenge-queue__playing-badge"
                                aria-hidden="true"
                              >
                                🎮
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <div className="challenge-queue__actions">
                      <button
                        type="button"
                        className="challenge-queue__action"
                        onClick={() => handleTogglePlaying(item.id)}
                      >
                        {isPlayingByMe ? "Stop playing" : "Play now"}
                      </button>
                      <button
                        type="button"
                        className="challenge-queue__action"
                        onClick={() => handleToggleDone(item.id)}
                      >
                        {isDoneByMe ? "Undo done" : "Mark done"}
                      </button>

                      <button
                        type="button"
                        className="wishlist-item__remove"
                        onClick={() => handleRemoveItem(item.id)}
                        aria-label={`Remove ${game?.name ?? item.gameSlug}`}
                        title="Remove from queue"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {availableGames.length > 0 && (
            <form className="wishlist-add-form" onSubmit={handleAddGame}>
              <div className="game-picker" ref={gamePickerRef}>
                <button
                  type="button"
                  className="game-picker__trigger"
                  onClick={() => {
                    setIsGamePickerOpen((open) => !open);
                    setGameSearch("");
                  }}
                  aria-haspopup="listbox"
                  aria-expanded={isGamePickerOpen}
                >
                  <span className="game-picker__trigger-label">
                    {selectedGame ? selectedGame.name : "Add a game…"}
                  </span>
                  <span className="game-picker__chevron" aria-hidden="true">
                    ▼
                  </span>
                </button>

                {isGamePickerOpen && (
                  <div className="game-picker__panel">
                    <input
                      type="text"
                      className="game-picker__search"
                      placeholder="Search games…"
                      value={gameSearch}
                      onChange={(event) => setGameSearch(event.target.value)}
                      autoFocus
                    />
                    <div className="game-picker__list" role="listbox">
                      {filteredGames.length === 0 ? (
                        <p className="game-picker__empty">No games match.</p>
                      ) : (
                        filteredGames.map((game) => {
                          const cover = covers[game.slug];
                          return (
                            <button
                              type="button"
                              key={game.slug}
                              className={`game-picker__item${
                                game.slug === selectedSlug
                                  ? " game-picker__item--selected"
                                  : ""
                              }`}
                              onClick={() => {
                                setSelectedSlug(game.slug);
                                setIsGamePickerOpen(false);
                              }}
                              role="option"
                              aria-selected={game.slug === selectedSlug}
                            >
                              <span
                                className="game-picker__swatch"
                                style={{ background: game.color }}
                              >
                                {cover ? (
                                  <Image
                                    src={cover}
                                    alt=""
                                    fill
                                    sizes="28px"
                                    className="game-picker__cover"
                                  />
                                ) : (
                                  <span aria-hidden="true">
                                    {game.shortName}
                                  </span>
                                )}
                              </span>
                              <span className="game-picker__name">
                                {game.name}
                              </span>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
              <button type="submit" disabled={!selectedSlug}>
                Add
              </button>
            </form>
          )}
        </div>

        <div className="dashboard-panel">
          <div className="dashboard-panel__header">
            <span className="dashboard-panel__title">INVITE CODE</span>
          </div>
          <div className="challenge-invite-code">
            <span className="challenge-invite-code__value">
              {group.inviteCode}
            </span>
            <button type="button" onClick={handleCopyCode}>
              {codeCopied ? "Copied!" : "Copy"}
            </button>
          </div>

          <div className="dashboard-panel__header">
            <span className="dashboard-panel__title">MEMBERS</span>
            <span className="friends-count">{members.length}</span>
          </div>

          <div className="friends-list challenge-members">
            {members.map((member) => (
              <div className="friend-row" key={member.userId}>
                <Link
                  href={`/users/${member.profile.username}`}
                  className="friend-row__identity"
                >
                  <div
                    className="friend-row__avatar"
                    style={{ background: member.profile.avatar_color }}
                    aria-hidden="true"
                  >
                    {member.profile.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={member.profile.avatar_url} alt="" />
                    ) : (
                      member.profile.avatar_initial
                    )}
                  </div>
                  <div className="friend-row__names">
                    <span className="friend-row__display-name">
                      {member.profile.display_name}
                      {member.userId === group.ownerId ? (
                        <Image
                          src="/icons/crown.png"
                          alt="Owner"
                          width={16}
                          height={16}
                          className="friend-row__crown"
                          unoptimized
                        />
                      ) : null}
                    </span>
                    <span className="friend-row__username">
                      @{member.profile.username}
                    </span>
                  </div>
                </Link>
                {isOwner && member.userId !== userId && (
                  <button
                    type="button"
                    className="friend-row__action friend-row__action--muted"
                    onClick={() => handleRemoveMember(member.userId)}
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>

          {pendingInvitees.length > 0 && (
            <>
              <div className="dashboard-panel__header friends-sent-header">
                <span className="dashboard-panel__title">PENDING INVITES</span>
                <span className="friends-count">{pendingInvitees.length}</span>
              </div>
              <div className="friends-list challenge-members">
                {pendingInvitees.map((invitee) => (
                  <div className="friend-row" key={invitee.userId}>
                    <Link
                      href={`/users/${invitee.profile.username}`}
                      className="friend-row__identity"
                    >
                      <div
                        className="friend-row__avatar"
                        style={{ background: invitee.profile.avatar_color }}
                        aria-hidden="true"
                      >
                        {invitee.profile.avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={invitee.profile.avatar_url} alt="" />
                        ) : (
                          invitee.profile.avatar_initial
                        )}
                      </div>
                      <div className="friend-row__names">
                        <span className="friend-row__display-name">
                          {invitee.profile.display_name}
                        </span>
                        <span className="friend-row__username">
                          Waiting for them to accept
                        </span>
                      </div>
                    </Link>
                    {(isOwner || invitee.userId === userId) && (
                      <button
                        type="button"
                        className="friend-row__action friend-row__action--muted"
                        onClick={() => handleCancelInvite(invitee.userId)}
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {invitableFriends.length > 0 && (
            <form className="wishlist-add-form" onSubmit={handleInvite}>
              <select
                value={selectedFriendId}
                onChange={(event) => setSelectedFriendId(event.target.value)}
                aria-label="Invite a friend"
              >
                <option value="">Invite a friend…</option>
                {invitableFriends.map((friend) => (
                  <option key={friend.id} value={friend.id}>
                    {friend.display_name}
                  </option>
                ))}
              </select>
              <button type="submit" disabled={!selectedFriendId}>
                Invite
              </button>
            </form>
          )}
        </div>
      </div>
    </>
  );
}
