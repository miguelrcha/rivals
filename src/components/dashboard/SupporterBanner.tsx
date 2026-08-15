import Image from "next/image";
import { createClient } from "@/lib/supabase/server";

export async function SupporterBanner() {
  const supabase = await createClient();

  const [{ count: playerCount }, { data: featured }] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase
      .from("profiles")
      .select("username, avatar_url, avatar_color, avatar_initial")
      .in("username", ["miguelrcha", "guelzn"]),
  ]);

  const realAvatars = ["miguelrcha", "guelzn"].map(
    (username) => featured?.find((p) => p.username === username) ?? null,
  );

  return (
    <div className="dashboard-banner">
      <div className="dashboard-banner__photo">
        <Image
          src="/banners/supporter-banner.png"
          alt="Sponsor banner"
          fill
          sizes="620px"
          className="dashboard-banner__photo-img"
        />
      </div>

      <div className="dashboard-banner__content">
        <p className="dashboard-banner__text">
          Supporters help keep race night running.
        </p>
        <button className="dashboard-banner__cta" type="button">
          Join for $3.99/month
        </button>

        <div className="dashboard-banner__proof">
          <div className="dashboard-banner__avatars">
            {realAvatars.map((profile, i) =>
              profile ? (
                <span
                  key={profile.username}
                  className="dashboard-banner__avatar"
                  style={{ background: profile.avatar_color }}
                  title={profile.username}
                >
                  {profile.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={profile.avatar_url} alt="" />
                  ) : (
                    profile.avatar_initial
                  )}
                </span>
              ) : (
                <span
                  key={`placeholder-${i}`}
                  className="dashboard-banner__avatar dashboard-banner__avatar--placeholder"
                >
                  ?
                </span>
              ),
            )}
            <span className="dashboard-banner__avatar dashboard-banner__avatar--placeholder">
              L
            </span>
            <span className="dashboard-banner__avatar dashboard-banner__avatar--placeholder">
              M
            </span>
          </div>

          <div className="dashboard-banner__proof-text">
            <span>{playerCount ?? 0} players registered</span>
            <span className="dashboard-banner__live">
              <span className="dashboard-banner__live-dot" aria-hidden="true" />
              Available now
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
