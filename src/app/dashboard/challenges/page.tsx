import type { Metadata } from "next";
import { ChallengesBoard } from "@/components/dashboard/ChallengesBoard";
import { createClient } from "@/lib/supabase/server";
import { GAME_BOXART } from "@/lib/game-boxart";

export const metadata: Metadata = {
  title: "Challenges / Rivals",
  description: "Race a queue of games with your crew — solo or with friends.",
};

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
        .select("id, group_id, game_slug, status, position")
        .order("position", { ascending: true }),
      supabase.from("challenge_group_members").select("group_id, user_id"),
    ]);

  const initialGroups = (groups ?? []).map((group) => ({
    id: group.id as string,
    name: group.name as string,
    isOwner: group.owner_id === user.id,
    inviteCode: group.invite_code as string,
    memberCount: (members ?? []).filter((m) => m.group_id === group.id)
      .length,
    items: (items ?? [])
      .filter((item) => item.group_id === group.id)
      .map((item) => ({
        id: item.id as string,
        gameSlug: item.game_slug as string,
        status: item.status as "queued" | "current" | "done",
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
        covers={GAME_BOXART}
      />
    </>
  );
}
