import type { Metadata } from "next";
import { ChallengesBoard } from "@/components/dashboard/ChallengesBoard";
import { createClient } from "@/lib/supabase/server";
import { GAME_BOXART } from "@/lib/game-boxart";

export const metadata: Metadata = {
  title: "Challenges / Rivals",
  description: "Race a queue of games with your crew — solo or with friends.",
};

const PROFILE_FIELDS =
  "id, username, display_name, avatar_color, avatar_initial, avatar_url";

export default async function ChallengesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const [{ data: groups }, { data: items }, { data: members }] =
    await Promise.all([
      supabase
        .from("challenge_groups")
        .select("id, name, owner_id, invite_code, created_at")
        .order("created_at", { ascending: true }),
      supabase
        .from("challenge_items")
        .select("id, group_id, game_slug, position")
        .order("position", { ascending: true }),
      supabase
        .from("challenge_group_members")
        .select(
          `group_id, user_id, status, joined_at, profile:profiles(${PROFILE_FIELDS})`,
        )
        .order("joined_at", { ascending: true }),
    ]);

  const myMembership = new Map(
    (members ?? [])
      .filter((m) => m.user_id === user.id)
      .map((m) => [m.group_id as string, m.status as string]),
  );

  const acceptedGroupRows = (groups ?? []).filter(
    (group) =>
      group.owner_id === user.id || myMembership.get(group.id) === "accepted",
  );

  const pendingInvites = (groups ?? [])
    .filter((group) => myMembership.get(group.id) === "pending")
    .map((group) => ({
      id: group.id as string,
      name: group.name as string,
    }));

  const initialGroups = acceptedGroupRows.map((group) => ({
    id: group.id as string,
    name: group.name as string,
    isOwner: group.owner_id === user.id,
    inviteCode: group.invite_code as string,
    memberCount: (members ?? []).filter(
      (m) => m.group_id === group.id && m.status === "accepted",
    ).length,
    members: (members ?? [])
      .filter((m) => m.group_id === group.id && m.status === "accepted")
      .map((m) => m.profile as unknown as ProfileSummary),
    items: (items ?? [])
      .filter((item) => item.group_id === group.id)
      .map((item) => ({
        id: item.id as string,
        gameSlug: item.game_slug as string,
      })),
  }));

  return (
    <>
      <div className="dashboard-page-header">
        <h1 className="dashboard-page-header__title">Challenges</h1>
        <p className="dashboard-page-header__subtitle">
          Build a queue of games to race through with your crew — invite
          friends or share a code to join.
        </p>
      </div>

      <ChallengesBoard
        userId={user.id}
        initialGroups={initialGroups}
        initialPendingInvites={pendingInvites}
        covers={GAME_BOXART}
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
};
