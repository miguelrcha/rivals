"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { GAMES } from "@/lib/games";

type ChallengeItem = {
  id: string;
  gameSlug: string;
  status: "queued" | "current" | "done";
};

type ChallengeGroup = {
  id: string;
  name: string;
  isOwner: boolean;
  inviteCode: string;
  memberCount: number;
  items: ChallengeItem[];
};

type PendingInvite = {
  id: string;
  name: string;
};

type Props = {
  userId: string;
  initialGroups: ChallengeGroup[];
  initialPendingInvites: PendingInvite[];
  covers: Record<string, string>;
};

export function ChallengesBoard({
  userId,
  initialGroups,
  initialPendingInvites,
  covers,
}: Props) {
  const router = useRouter();
  const [groups, setGroups] = useState<ChallengeGroup[]>(initialGroups);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>(
    initialPendingInvites,
  );
  const [newGroupName, setNewGroupName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState("");

  async function handleAcceptInvite(invite: PendingInvite) {
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("challenge_group_members")
      .update({ status: "accepted" })
      .eq("group_id", invite.id)
      .eq("user_id", userId);

    if (updateError) {
      setError("Couldn't accept that invite — try again.");
      return;
    }

    setPendingInvites((current) => current.filter((i) => i.id !== invite.id));
    router.push(`/dashboard/challenges/${invite.id}`);
  }

  async function handleDeclineInvite(invite: PendingInvite) {
    const supabase = createClient();
    const { error: deleteError } = await supabase
      .from("challenge_group_members")
      .delete()
      .eq("group_id", invite.id)
      .eq("user_id", userId);

    if (!deleteError) {
      setPendingInvites((current) => current.filter((i) => i.id !== invite.id));
    }
  }

  async function handleCreateGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = newGroupName.trim();
    if (!name || isCreating) return;

    setIsCreating(true);
    setError("");

    const supabase = createClient();
    const { data, error: insertError } = await supabase
      .from("challenge_groups")
      .insert({ owner_id: userId, name })
      .select("id, name, invite_code")
      .single();

    if (insertError || !data) {
      setError("Couldn't create that challenge — try again.");
      setIsCreating(false);
      return;
    }

    const { error: memberError } = await supabase
      .from("challenge_group_members")
      .insert({ group_id: data.id, user_id: userId });

    if (memberError) {
      setError("Couldn't create that challenge — try again.");
      setIsCreating(false);
      return;
    }

    setGroups((current) => [
      ...current,
      {
        id: data.id,
        name: data.name,
        isOwner: true,
        inviteCode: data.invite_code,
        memberCount: 1,
        items: [],
      },
    ]);
    setNewGroupName("");
    setIsCreating(false);
  }

  async function handleJoinGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = joinCode.trim();
    if (!code || isJoining) return;

    setIsJoining(true);
    setError("");

    const supabase = createClient();
    const { data, error: joinError } = await supabase.rpc(
      "join_challenge_group",
      { p_invite_code: code },
    );

    if (joinError || !data) {
      setError("That code didn't match any challenge.");
      setIsJoining(false);
      return;
    }

    router.push(`/dashboard/challenges/${data}`);
  }

  async function handleLeaveOrDelete(group: ChallengeGroup) {
    const supabase = createClient();

    if (group.isOwner) {
      const { error: deleteError } = await supabase
        .from("challenge_groups")
        .delete()
        .eq("id", group.id);
      if (deleteError) return;
    } else {
      const { error: leaveError } = await supabase
        .from("challenge_group_members")
        .delete()
        .eq("group_id", group.id)
        .eq("user_id", userId);
      if (leaveError) return;
    }

    setGroups((current) => current.filter((g) => g.id !== group.id));
  }

  return (
    <>
      <div className="challenges-forms">
        <form className="wishlist-new-group" onSubmit={handleCreateGroup}>
          <input
            type="text"
            placeholder="New challenge name (e.g. Kanto Crew)"
            value={newGroupName}
            onChange={(event) => setNewGroupName(event.target.value)}
            maxLength={40}
          />
          <button type="submit" disabled={isCreating || !newGroupName.trim()}>
            {isCreating ? "Creating…" : "New challenge"}
          </button>
        </form>

        <form className="wishlist-new-group" onSubmit={handleJoinGroup}>
          <input
            type="text"
            placeholder="Have a code? Join a challenge"
            value={joinCode}
            onChange={(event) => setJoinCode(event.target.value)}
            maxLength={12}
          />
          <button type="submit" disabled={isJoining || !joinCode.trim()}>
            {isJoining ? "Joining…" : "Join"}
          </button>
        </form>
      </div>

      {error && <p className="auth-error">{error}</p>}

      {pendingInvites.length > 0 && (
        <div className="dashboard-panel challenge-invites">
          <div className="dashboard-panel__header">
            <span className="dashboard-panel__title">INVITES</span>
            <span className="friends-count">{pendingInvites.length}</span>
          </div>
          <div className="friends-list">
            {pendingInvites.map((invite) => (
              <div className="friend-row" key={invite.id}>
                <span className="friend-row__names">
                  <span className="friend-row__display-name">
                    {invite.name}
                  </span>
                  <span className="friend-row__username">
                    You&apos;ve been invited to this challenge
                  </span>
                </span>
                <div className="friend-row__actions">
                  <button
                    type="button"
                    className="friend-row__action"
                    onClick={() => handleAcceptInvite(invite)}
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    className="friend-row__action friend-row__action--muted"
                    onClick={() => handleDeclineInvite(invite)}
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {groups.length === 0 ? (
        <div className="dashboard-panel">
          <div className="profile-empty">
            <p className="profile-empty__title">NO CHALLENGES YET</p>
            <p className="profile-empty__body">
              Start one above, then invite friends or share the code so they
              can join.
            </p>
          </div>
        </div>
      ) : (
        <div className="wishlist-groups">
          {groups.map((group) => (
            <ChallengeGroupCard
              key={group.id}
              group={group}
              covers={covers}
              onLeaveOrDelete={() => handleLeaveOrDelete(group)}
            />
          ))}
        </div>
      )}
    </>
  );
}

function ChallengeGroupCard({
  group,
  covers,
  onLeaveOrDelete,
}: {
  group: ChallengeGroup;
  covers: Record<string, string>;
  onLeaveOrDelete: () => void;
}) {
  const currentItem = group.items.find((item) => item.status === "current");
  const currentGame = currentItem
    ? GAMES.find((g) => g.slug === currentItem.gameSlug)
    : null;

  return (
    <div className="dashboard-panel wishlist-group">
      <div className="dashboard-panel__header">
        <Link href={`/dashboard/challenges/${group.id}`} className="dashboard-panel__title">
          {group.name.toUpperCase()}
        </Link>
        <button
          type="button"
          className="wishlist-group__delete"
          onClick={onLeaveOrDelete}
          aria-label={group.isOwner ? `Delete ${group.name}` : `Leave ${group.name}`}
          title={group.isOwner ? "Delete challenge" : "Leave challenge"}
        >
          ✕
        </button>
      </div>

      <div className="challenge-card__body">
        <p className="challenge-card__meta">
          {group.memberCount} member{group.memberCount === 1 ? "" : "s"} ·{" "}
          {group.items.length} game{group.items.length === 1 ? "" : "s"}
        </p>

        {currentGame ? (
          <p className="challenge-card__now">▶ NOW PLAYING: {currentGame.name}</p>
        ) : (
          <p className="challenge-card__now challenge-card__now--empty">
            No game selected yet
          </p>
        )}

        {group.items.length > 0 && (
          <div className="challenge-card__thumbs">
            {group.items.slice(0, 5).map((item) => {
              const game = GAMES.find((g) => g.slug === item.gameSlug);
              const cover = covers[item.gameSlug];
              return (
                <div
                  key={item.id}
                  className="wishlist-item__thumb challenge-card__thumb"
                  style={{ background: game?.color ?? "#3a3a3e" }}
                  title={game?.name ?? item.gameSlug}
                >
                  {cover ? (
                    <Image
                      src={cover}
                      alt=""
                      fill
                      sizes="40px"
                      className="wishlist-item__art"
                    />
                  ) : (
                    <span aria-hidden="true">{game?.shortName ?? "?"}</span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <Link
          href={`/dashboard/challenges/${group.id}`}
          className="challenge-card__enter"
        >
          Open challenge →
        </Link>
      </div>
    </div>
  );
}
