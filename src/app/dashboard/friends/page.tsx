import type { Metadata } from "next";
import { FriendsBoard } from "@/components/dashboard/FriendsBoard";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Friends / Rivals",
  description: "Requests you've sent, received, and the crew you race with.",
};

const PROFILE_FIELDS =
  "id, username, display_name, avatar_color, avatar_initial, avatar_url, last_active_at";

export default async function FriendsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const [{ data: incoming }, { data: sent }, { data: accepted }] =
    await Promise.all([
      supabase
        .from("friend_requests")
        .select(
          `id, created_at, requester:profiles!friend_requests_requester_id_fkey(${PROFILE_FIELDS})`,
        )
        .eq("addressee_id", user.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false }),
      supabase
        .from("friend_requests")
        .select(
          `id, created_at, addressee:profiles!friend_requests_addressee_id_fkey(${PROFILE_FIELDS})`,
        )
        .eq("requester_id", user.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false }),
      supabase
        .from("friend_requests")
        .select(
          `id, created_at, requester_id, addressee_id, requester:profiles!friend_requests_requester_id_fkey(${PROFILE_FIELDS}), addressee:profiles!friend_requests_addressee_id_fkey(${PROFILE_FIELDS})`,
        )
        .eq("status", "accepted")
        .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
        .order("created_at", { ascending: false }),
    ]);

  const incomingRequests = (incoming ?? []).map((row) => ({
    id: row.id as string,
    profile: row.requester as unknown as ProfileSummary,
  }));

  const sentRequests = (sent ?? []).map((row) => ({
    id: row.id as string,
    profile: row.addressee as unknown as ProfileSummary,
  }));

  const friends = (accepted ?? []).map((row) => ({
    id: row.id as string,
    profile: (row.requester_id === user.id
      ? row.addressee
      : row.requester) as unknown as ProfileSummary,
  }));

  return (
    <>
      <div className="dashboard-page-header">
        <h1 className="dashboard-page-header__title">Friends</h1>
        <p className="dashboard-page-header__subtitle">
          Add rivals by username, manage requests, and see who you race with.
        </p>
      </div>

      <FriendsBoard
        userId={user.id}
        initialIncoming={incomingRequests}
        initialSent={sentRequests}
        initialFriends={friends}
      />
    </>
  );
}

type ProfileSummary = {
  id: string;
  username: string;
  display_name: string;
  avatar_color: string;
  avatar_initial: string;
  avatar_url: string | null;
  last_active_at: string | null;
};
