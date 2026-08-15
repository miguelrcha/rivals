import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SupporterBanner } from "@/components/dashboard/SupporterBanner";
import { EditProfileModal } from "@/components/profile/EditProfileModal";
import { AddFriendButton } from "@/components/profile/AddFriendButton";
import { createClient } from "@/lib/supabase/server";

type Props = { params: Promise<{ username: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("username", username)
    .single();

  return {
    title: profile
      ? `${profile.display_name} / Rivals`
      : "User not found / Rivals",
  };
}

export default async function UserProfilePage({ params }: Props) {
  const { username } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("username", username)
    .single();

  if (!profile) {
    notFound();
  }

  const { count: runsCount } = await supabase
    .from("runs")
    .select("*", { count: "exact", head: true })
    .eq("runner_id", profile.id);

  const isOwnProfile = user?.id === profile.id;

  let friendStatus: "none" | "pending" | "accepted" = "none";

  if (user && !isOwnProfile) {
    const { data: existingRequest } = await supabase
      .from("friend_requests")
      .select("status")
      .or(
        `and(requester_id.eq.${user.id},addressee_id.eq.${profile.id}),and(requester_id.eq.${profile.id},addressee_id.eq.${user.id})`,
      )
      .maybeSingle();

    if (existingRequest) {
      friendStatus =
        existingRequest.status === "accepted" ? "accepted" : "pending";
    }
  }

  const joined = new Date(profile.created_at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <>
      <SupporterBanner />

      <div
        className="profile-banner"
        style={{
          backgroundImage: profile.banner_url
            ? `url(${profile.banner_url})`
            : undefined,
          background: !profile.banner_url ? profile.avatar_color : undefined,
        }}
      />

      <div className="profile-header">
        <div
          className="profile-header__avatar"
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

        <div className="profile-header__meta">
          <div className="profile-header__name-row">
            <h1
              className="profile-header__name"
              style={{ color: profile.avatar_color }}
            >
              {profile.display_name}
            </h1>
            <div className="profile-badges">
              {profile.username === "miguelrcha" && (
                <span className="profile-badge profile-badge--owner">
                  OWNER
                </span>
              )}
              <span className="profile-badge profile-badge--beta">BETA</span>
            </div>
          </div>
          <p className="profile-header__tagline">
            {profile.flag && (
              <span aria-hidden="true">{profile.flag} </span>
            )}
            {profile.tagline ?? `@${profile.username}`}
          </p>
        </div>

        <div className="profile-header__actions">
          {isOwnProfile ? (
            <EditProfileModal
              userId={profile.id}
              avatarUrl={profile.avatar_url}
              bannerUrl={profile.banner_url}
              avatarColor={profile.avatar_color}
              avatarInitial={profile.avatar_initial}
              tagline={profile.tagline}
            />
          ) : (
            <>
              <button className="profile-header__message" type="button">
                Message
              </button>
              <AddFriendButton
                profileId={profile.id}
                initialStatus={friendStatus}
              />
            </>
          )}
        </div>
      </div>

      <nav className="game-tabs" aria-label="Profile sections">
        <span className="game-tabs__item game-tabs__item--active">
          Full game runs
        </span>
        <span className="game-tabs__item">Level runs</span>
        <span className="game-tabs__item">Threads</span>
        <span className="game-tabs__item">Comments</span>
        <span className="game-tabs__item">Followers</span>
        <span className="game-tabs__item">Following</span>
        <span className="game-tabs__item">About</span>
      </nav>

      <div className="dashboard-columns">
        <div className="dashboard-panel">
          <div className="dashboard-panel__header">
            <span className="dashboard-panel__title">FULL GAME RUNS</span>
          </div>

          <div className="profile-empty">
            <p className="profile-empty__title">NO RUNS</p>
            <p className="profile-empty__body">
              {profile.display_name} doesn&apos;t have any full game runs
              logged yet.
            </p>
          </div>
        </div>

        <div className="dashboard-panel">
          <div className="dashboard-panel__header">
            <span className="dashboard-panel__title">
              ABOUT {profile.display_name.toUpperCase()}
            </span>
          </div>

          <div className="profile-about">
            <div className="profile-about__item">
              <div className="profile-about__label">Joined</div>
              <div className="profile-about__value">{joined}</div>
            </div>
            <div className="profile-about__item">
              <div className="profile-about__label">Runs</div>
              <div className="profile-about__value">{runsCount ?? 0}</div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
