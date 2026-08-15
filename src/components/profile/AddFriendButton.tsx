"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type FriendStatus = "none" | "pending" | "accepted";

type Props = {
  profileId: string;
  initialStatus: FriendStatus;
};

export function AddFriendButton({ profileId, initialStatus }: Props) {
  const [status, setStatus] = useState<FriendStatus>(initialStatus);
  const [isSending, setIsSending] = useState(false);

  async function handleClick() {
    if (status !== "none" || isSending) return;
    setIsSending(true);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setIsSending(false);
      return;
    }

    const { error } = await supabase.from("friend_requests").insert({
      requester_id: user.id,
      addressee_id: profileId,
    });

    if (!error) {
      setStatus("pending");
    }

    setIsSending(false);
  }

  const label =
    status === "accepted"
      ? "Friends"
      : status === "pending"
        ? "Request Sent"
        : isSending
          ? "Sending…"
          : "Add Friend";

  return (
    <button
      type="button"
      className="profile-header__message"
      onClick={handleClick}
      disabled={status !== "none" || isSending}
    >
      {label}
    </button>
  );
}
