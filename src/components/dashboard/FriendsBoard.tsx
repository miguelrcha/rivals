"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { isOnline } from "@/lib/format";
import { StatusDot } from "@/components/StatusDot";

type ProfileSummary = {
  id: string;
  username: string;
  display_name: string;
  avatar_color: string;
  avatar_initial: string;
  avatar_url: string | null;
  last_active_at: string | null;
};

type FriendEntry = {
  id: string;
  profile: ProfileSummary;
};

type Props = {
  userId: string;
  initialIncoming: FriendEntry[];
  initialSent: FriendEntry[];
  initialFriends: FriendEntry[];
};

export function FriendsBoard({
  userId,
  initialIncoming,
  initialSent,
  initialFriends,
}: Props) {
  const [incoming, setIncoming] = useState(initialIncoming);
  const [sent, setSent] = useState(initialSent);
  const [friends, setFriends] = useState(initialFriends);
  const [username, setUsername] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");

  async function handleAddFriend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const target = username.trim().replace(/^@/, "");
    if (!target || isSending) return;

    setIsSending(true);
    setError("");

    const supabase = createClient();

    const { data: profile, error: lookupError } = await supabase
      .from("profiles")
      .select(
        "id, username, display_name, avatar_color, avatar_initial, avatar_url, last_active_at",
      )
      .eq("username", target)
      .maybeSingle();

    if (lookupError || !profile) {
      setError(`No rival found with username "${target}".`);
      setIsSending(false);
      return;
    }

    if (profile.id === userId) {
      setError("You can't add yourself.");
      setIsSending(false);
      return;
    }

    if (friends.some((f) => f.profile.id === profile.id)) {
      setError(`You're already friends with ${profile.display_name}.`);
      setIsSending(false);
      return;
    }

    if (sent.some((f) => f.profile.id === profile.id)) {
      setError(`You already sent ${profile.display_name} a request.`);
      setIsSending(false);
      return;
    }

    if (incoming.some((f) => f.profile.id === profile.id)) {
      setError(
        `${profile.display_name} already sent you a request — check Requests below.`,
      );
      setIsSending(false);
      return;
    }

    const { data, error: insertError } = await supabase
      .from("friend_requests")
      .insert({ requester_id: userId, addressee_id: profile.id })
      .select("id")
      .single();

    if (insertError || !data) {
      setError("Couldn't send that request — try again.");
    } else {
      setSent((current) => [{ id: data.id, profile }, ...current]);
      setUsername("");
    }

    setIsSending(false);
  }

  async function handleAccept(requestId: string) {
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("friend_requests")
      .update({ status: "accepted" })
      .eq("id", requestId);

    if (!updateError) {
      const entry = incoming.find((r) => r.id === requestId);
      setIncoming((current) => current.filter((r) => r.id !== requestId));
      if (entry) setFriends((current) => [entry, ...current]);
    }
  }

  async function handleDecline(requestId: string) {
    const supabase = createClient();
    const { error: deleteError } = await supabase
      .from("friend_requests")
      .delete()
      .eq("id", requestId);

    if (!deleteError) {
      setIncoming((current) => current.filter((r) => r.id !== requestId));
    }
  }

  async function handleCancel(requestId: string) {
    const supabase = createClient();
    const { error: deleteError } = await supabase
      .from("friend_requests")
      .delete()
      .eq("id", requestId);

    if (!deleteError) {
      setSent((current) => current.filter((r) => r.id !== requestId));
    }
  }

  async function handleUnfriend(requestId: string) {
    const supabase = createClient();
    const { error: deleteError } = await supabase
      .from("friend_requests")
      .delete()
      .eq("id", requestId);

    if (!deleteError) {
      setFriends((current) => current.filter((r) => r.id !== requestId));
    }
  }

  return (
    <>
      <form className="wishlist-new-group" onSubmit={handleAddFriend}>
        <input
          type="text"
          placeholder="Add a rival by username"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          maxLength={40}
        />
        <button type="submit" disabled={isSending || !username.trim()}>
          {isSending ? "Sending…" : "Send request"}
        </button>
      </form>

      {error && <p className="auth-error">{error}</p>}

      <div className="dashboard-columns">
        <div className="dashboard-panel">
          <div className="dashboard-panel__header">
            <span className="dashboard-panel__title">FRIENDS</span>
            <span className="friends-count">{friends.length}</span>
          </div>

          {friends.length === 0 ? (
            <div className="profile-empty">
              <p className="profile-empty__body">
                No friends yet — send a request above.
              </p>
            </div>
          ) : (
            <div className="friends-list">
              {friends.map((entry) => (
                <div className="friend-row" key={entry.id}>
                  <FriendIdentity profile={entry.profile} />
                  <button
                    type="button"
                    className="friend-row__action friend-row__action--muted"
                    onClick={() => handleUnfriend(entry.id)}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="dashboard-panel">
          <div className="dashboard-panel__header">
            <span className="dashboard-panel__title">REQUESTS</span>
            <span className="friends-count">{incoming.length}</span>
          </div>

          {incoming.length === 0 ? (
            <div className="profile-empty">
              <p className="profile-empty__body">No incoming requests.</p>
            </div>
          ) : (
            <div className="friends-list">
              {incoming.map((entry) => (
                <div className="friend-row" key={entry.id}>
                  <FriendIdentity profile={entry.profile} />
                  <div className="friend-row__actions">
                    <button
                      type="button"
                      className="friend-row__action"
                      onClick={() => handleAccept(entry.id)}
                    >
                      Accept
                    </button>
                    <button
                      type="button"
                      className="friend-row__action friend-row__action--muted"
                      onClick={() => handleDecline(entry.id)}
                    >
                      Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {sent.length > 0 && (
            <>
              <div className="dashboard-panel__header friends-sent-header">
                <span className="dashboard-panel__title">SENT</span>
                <span className="friends-count">{sent.length}</span>
              </div>
              <div className="friends-list">
                {sent.map((entry) => (
                  <div className="friend-row" key={entry.id}>
                    <FriendIdentity profile={entry.profile} />
                    <button
                      type="button"
                      className="friend-row__action friend-row__action--muted"
                      onClick={() => handleCancel(entry.id)}
                    >
                      Cancel
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

function FriendIdentity({ profile }: { profile: ProfileSummary }) {
  return (
    <Link href={`/users/${profile.username}`} className="friend-row__identity">
      <div className="avatar-status">
        <div
          className="friend-row__avatar"
          style={{ background: profile.avatar_color }}
          aria-hidden="true"
        >
          {profile.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.avatar_url} alt="" />
          ) : (
            profile.avatar_initial
          )}
        </div>
        <StatusDot online={isOnline(profile.last_active_at)} />
      </div>
      <div className="friend-row__names">
        <span className="friend-row__display-name">
          {profile.display_name}
        </span>
        <span className="friend-row__username">@{profile.username}</span>
      </div>
    </Link>
  );
}
