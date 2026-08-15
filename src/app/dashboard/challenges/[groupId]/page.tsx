import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ChallengeGroupDetail } from "@/components/dashboard/ChallengeGroupDetail";
import { createClient } from "@/lib/supabase/server";
import { GAME_BOXART } from "@/lib/game-boxart";

type Props = { params: Promise<{ groupId: string }> };

const PROFILE_FIELDS =
  "id, username, display_name, avatar_color, avatar_initial, avatar_url";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { groupId } = await params;
  const supabase = await createClient();
  const { data: group } = await supabase
    .from("challenge_groups")
    .select("name")
    .eq("id", groupId)
    .maybeSingle();

  return {
    title: group ? `${group.name} / Rivals` : "Challenge not found / Rivals",
  };
}

export default async function ChallengeGroupPage({ params }: Props) {
  const { groupId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: group } = await supabase
    .from("challenge_groups")
    .select("id, name, owner_id, invite_code")
    .eq("id", groupId)
    .maybeSingle();

  if (!group) {
    notFound();
  }

  const [{ data: items }, { data: memberRows }, { data: friendRows }] =
    await Promise.all([
      supabase
        .from("challenge_items")
        .select("id, game_slug, position, added_by")
        .eq("group_id", groupId)
        .order("position", { ascending: true }),
      supabase
        .from("challenge_group_members")
        .select(`user_id, joined_at, status, profile:profiles(${PROFILE_FIELDS})`)
        .eq("group_id", groupId)
        .order("joined_at", { ascending: true }),
      supabase
        .from("friend_requests")
        .select(
          `requester_id, addressee_id, requester:profiles!friend_requests_requester_id_fkey(${PROFILE_FIELDS}), addressee:profiles!friend_requests_addressee_id_fkey(${PROFILE_FIELDS})`,
        )
        .eq("status", "accepted")
        .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`),
    ]);

  const itemIds = (items ?? []).map((item) => item.id as string);
  const [{ data: completionRows }, { data: playRows }] = itemIds.length
    ? await Promise.all([
        supabase
          .from("challenge_item_completions")
          .select(`item_id, user_id, profile:profiles(${PROFILE_FIELDS})`)
          .in("item_id", itemIds),
        supabase
          .from("challenge_item_plays")
          .select(`item_id, user_id, profile:profiles(${PROFILE_FIELDS})`)
          .in("item_id", itemIds),
      ])
    : [{ data: [] as never[] }, { data: [] as never[] }];

  const completionsByItem = new Map<
    string,
    { userId: string; profile: ProfileSummary }[]
  >();
  for (const row of completionRows ?? []) {
    const list = completionsByItem.get(row.item_id as string) ?? [];
    list.push({
      userId: row.user_id as string,
      profile: row.profile as unknown as ProfileSummary,
    });
    completionsByItem.set(row.item_id as string, list);
  }

  const playsByItem = new Map<
    string,
    { userId: string; profile: ProfileSummary }[]
  >();
  for (const row of playRows ?? []) {
    const list = playsByItem.get(row.item_id as string) ?? [];
    list.push({
      userId: row.user_id as string,
      profile: row.profile as unknown as ProfileSummary,
    });
    playsByItem.set(row.item_id as string, list);
  }

  const members = (memberRows ?? [])
    .filter((row) => row.status === "accepted")
    .map((row) => ({
      userId: row.user_id as string,
      profile: row.profile as unknown as ProfileSummary,
    }));

  const pendingInvitees = (memberRows ?? [])
    .filter((row) => row.status === "pending")
    .map((row) => ({
      userId: row.user_id as string,
      profile: row.profile as unknown as ProfileSummary,
    }));

  const memberIds = new Set((memberRows ?? []).map((row) => row.user_id as string));

  const friends = (friendRows ?? [])
    .map((row) =>
      (row.requester_id === user.id
        ? row.addressee
        : row.requester) as unknown as ProfileSummary,
    )
    .filter((profile) => !memberIds.has(profile.id));

  const initialItems = (items ?? []).map((item) => ({
    id: item.id as string,
    gameSlug: item.game_slug as string,
    position: item.position as number,
    completions: completionsByItem.get(item.id as string) ?? [],
    plays: playsByItem.get(item.id as string) ?? [],
  }));

  return (
    <ChallengeGroupDetail
      userId={user.id}
      group={{
        id: group.id,
        name: group.name,
        ownerId: group.owner_id,
        inviteCode: group.invite_code,
      }}
      initialItems={initialItems}
      initialMembers={members}
      initialPendingInvitees={pendingInvitees}
      friends={friends}
      covers={GAME_BOXART}
    />
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
