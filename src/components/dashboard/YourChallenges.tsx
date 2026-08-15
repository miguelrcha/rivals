import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

type ChallengeGroupRow = { id: string; name: string };

export async function YourChallenges() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: memberRows } = await supabase
    .from("challenge_group_members")
    .select("group_id, joined_at, group:challenge_groups(id, name)")
    .eq("user_id", user.id)
    .eq("status", "accepted")
    .order("joined_at", { ascending: false })
    .limit(4);

  const groups = (memberRows ?? [])
    .map((row) => row.group as unknown as ChallengeGroupRow | null)
    .filter((group): group is ChallengeGroupRow => group !== null);

  const groupIds = groups.map((group) => group.id);

  const [{ data: memberCountRows }, { data: itemCountRows }] = groupIds.length
    ? await Promise.all([
        supabase
          .from("challenge_group_members")
          .select("group_id")
          .in("group_id", groupIds)
          .eq("status", "accepted"),
        supabase
          .from("challenge_items")
          .select("group_id")
          .in("group_id", groupIds),
      ])
    : [
        { data: [] as { group_id: string }[] },
        { data: [] as { group_id: string }[] },
      ];

  const memberCounts = new Map<string, number>();
  for (const row of memberCountRows ?? []) {
    memberCounts.set(row.group_id, (memberCounts.get(row.group_id) ?? 0) + 1);
  }

  const itemCounts = new Map<string, number>();
  for (const row of itemCountRows ?? []) {
    itemCounts.set(row.group_id, (itemCounts.get(row.group_id) ?? 0) + 1);
  }

  return (
    <div className="dashboard-panel">
      <div className="dashboard-panel__header">
        <span className="dashboard-panel__title">YOUR CHALLENGES</span>
        <Link href="/dashboard/challenges" className="dashboard-panel__link">
          See all →
        </Link>
      </div>

      {groups.length === 0 ? (
        <div className="profile-empty">
          <p className="profile-empty__body">
            No challenges yet — start one to race a queue of games with your
            crew.
          </p>
        </div>
      ) : (
        <div className="home-challenges">
          {groups.map((group) => {
            const memberCount = memberCounts.get(group.id) ?? 1;
            const itemCount = itemCounts.get(group.id) ?? 0;

            return (
              <Link
                href={`/dashboard/challenges/${group.id}`}
                className="home-challenge-row"
                key={group.id}
              >
                <span className="home-challenge-row__name">{group.name}</span>
                <span className="home-challenge-row__meta">
                  {memberCount} member{memberCount === 1 ? "" : "s"} ·{" "}
                  {itemCount} game{itemCount === 1 ? "" : "s"}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
