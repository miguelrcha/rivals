import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { SupporterBanner } from "@/components/dashboard/SupporterBanner";
import { EditProfileModal } from "@/components/profile/EditProfileModal";
import { AddFriendButton } from "@/components/profile/AddFriendButton";
import { ClearActiveRunButton } from "@/components/profile/ClearActiveRunButton";
import { RunDetailsButton } from "@/components/profile/RunDetailsButton";
import { createClient } from "@/lib/supabase/server";
import { getGameBySlug } from "@/lib/games";
import { formatElapsed } from "@/lib/format";
import { GAME_BOXART } from "@/lib/game-boxart";

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

  const activeGame = profile.active_game_slug
    ? getGameBySlug(profile.active_game_slug)
    : null;
  const activeGameCover = activeGame ? GAME_BOXART[activeGame.slug] : null;

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
          Runs
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
            <span className="dashboard-panel__title">RUNS</span>
          </div>

          {activeGame ? (
            <div className="profile-run-card">
              <Link
                href={`/games/${activeGame.slug}`}
                className="profile-run-card__thumb"
                style={{ background: activeGame.color }}
              >
                {activeGameCover ? (
                  <Image
                    src={activeGameCover}
                    alt=""
                    fill
                    sizes="64px"
                    className="profile-run-card__art"
                  />
                ) : (
                  <span aria-hidden="true">{activeGame.shortName}</span>
                )}
              </Link>

              <div className="profile-run-card__info">
                <div className="profile-run-card__top">
                  <Link
                    href={`/games/${activeGame.slug}`}
                    className="profile-run-card__name"
                  >
                    {activeGame.name}
                  </Link>
                  {(profile.active_game_sync_count ?? 0) > 0 && (
                    <RunDetailsButton
                      gameName={activeGame.name}
                      playerName={profile.active_game_player_name}
                      badgeNames={profile.active_game_badge_names ?? []}
                      pokedexCaught={profile.active_game_pokedex_caught ?? 0}
                      playTimeSeconds={
                        profile.active_game_playtime_seconds ?? 0
                      }
                    />
                  )}
                  {isOwnProfile && (
                    <ClearActiveRunButton userId={profile.id} />
                  )}
                </div>

                <p className="profile-run-card__meta">
                  {(profile.active_game_sync_count ?? 0) > 0 ? (
                    <>
                      {profile.active_game_badges ?? 0}/8 badges ·{" "}
                      {profile.active_game_pokedex_caught ?? 0}/386 caught ·{" "}
                      {formatElapsed(
                        (profile.active_game_playtime_seconds ?? 0) * 1000,
                      )}{" "}
                      played · Synced {profile.active_game_sync_count}x
                    </>
                  ) : (
                    "No save synced yet"
                  )}
                </p>

                <div className="profile-run-card__progress">
                  <span className="profile-run-card__progress-bar">
                    <span
                      className="profile-run-card__progress-fill"
                      style={{ width: `${profile.active_game_progress ?? 0}%` }}
                    />
                  </span>
                  {profile.active_game_progress ?? 0}%
                </div>
              </div>
            </div>
          ) : (
            <div className="profile-empty">
              <p className="profile-empty__title">NO RUNS</p>
              <p className="profile-empty__body">
                {profile.display_name} doesn&apos;t have any runs logged yet.
              </p>
            </div>
          )}
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
