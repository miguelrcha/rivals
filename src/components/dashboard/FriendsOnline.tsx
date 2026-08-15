import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
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

const PROFILE_FIELDS =
  "id, username, display_name, avatar_color, avatar_initial, avatar_url, last_active_at";

export async function FriendsOnline() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: friendRows } = await supabase
    .from("friend_requests")
    .select(
      `requester_id, addressee_id, requester:profiles!friend_requests_requester_id_fkey(${PROFILE_FIELDS}), addressee:profiles!friend_requests_addressee_id_fkey(${PROFILE_FIELDS})`,
    )
    .eq("status", "accepted")
    .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);

  const onlineFriends = (friendRows ?? [])
    .map(
      (row) =>
        (row.requester_id === user.id
          ? row.addressee
          : row.requester) as unknown as ProfileSummary,
    )
    .filter((friend) => isOnline(friend.last_active_at))
    .sort(
      (a, b) =>
        new Date(b.last_active_at ?? 0).getTime() -
        new Date(a.last_active_at ?? 0).getTime(),
    );

  return (
    <div className="dashboard-panel">
      <div className="dashboard-panel__header">
        <span className="dashboard-panel__title">FRIENDS ONLINE</span>
        <span className="friends-count">{onlineFriends.length}</span>
      </div>

      {onlineFriends.length === 0 ? (
        <div className="profile-empty">
          <p className="profile-empty__body">
            No friends online right now — check back later.
          </p>
        </div>
      ) : (
        <div className="friends-list">
          {onlineFriends.map((friend) => (
            <Link
              href={`/users/${friend.username}`}
              className="friend-row"
              key={friend.id}
            >
              <span className="friend-row__identity">
                <span className="avatar-status">
                  <span
                    className="friend-row__avatar"
                    style={{ background: friend.avatar_color }}
                    aria-hidden="true"
                  >
                    {friend.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={friend.avatar_url} alt="" />
                    ) : (
                      friend.avatar_initial
                    )}
                  </span>
                  <StatusDot online />
                </span>
                <span className="friend-row__names">
                  <span className="friend-row__display-name">
                    {friend.display_name}
                  </span>
                  <span className="friend-row__username">
                    @{friend.username}
                  </span>
                </span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
