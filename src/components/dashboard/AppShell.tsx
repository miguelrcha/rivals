import Link from "next/link";
import { signOut } from "@/app/auth/actions";
import { createClient } from "@/lib/supabase/server";
import { GAMES } from "@/lib/games";
import { MobileNav } from "./MobileNav";

export async function AppShell({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let profile: {
    username: string;
    display_name: string;
    avatar_color: string;
    avatar_initial: string;
    avatar_url: string | null;
    active_game_slug: string | null;
  } | null = null;

  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select(
        "username, display_name, avatar_color, avatar_initial, avatar_url, active_game_slug",
      )
      .eq("id", user.id)
      .single();
    profile = data;
  }

  const activeGame = profile?.active_game_slug
    ? GAMES.find((game) => game.slug === profile.active_game_slug)
    : null;

  return (
    <div className="dashboard-shell">
      <aside className="dashboard-sidebar">
        <MobileNav
          logo={
            <Link
              href="/"
              className="dashboard-sidebar__logo"
              aria-label="rivals home"
            >
              rivals
            </Link>
          }
        >
          <nav className="dashboard-nav" aria-label="Dashboard">
            <ul>
              <li>
                <Link href="/dashboard/games">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <rect x="3" y="3" width="7" height="7" />
                    <rect x="14" y="3" width="7" height="7" />
                    <rect x="14" y="14" width="7" height="7" />
                    <rect x="3" y="14" width="7" height="7" />
                  </svg>
                  Games
                </Link>
              </li>
              <li>
                <Link href="/#leaderboard">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <line x1="18" y1="20" x2="18" y2="10" />
                    <line x1="12" y1="20" x2="12" y2="4" />
                    <line x1="6" y1="20" x2="6" y2="14" />
                  </svg>
                  Leaderboard
                </Link>
              </li>
              <li>
                <Link href="/dashboard/friends">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                  Friends
                </Link>
              </li>
              <li>
                <Link href="/dashboard/challenges">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
                    <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
                    <path d="M4 22h16" />
                    <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
                    <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
                    <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
                  </svg>
                  Challenges
                </Link>
              </li>
            </ul>
          </nav>

          <div className="dashboard-sidebar__bottom">
            {profile ? (
              <div className="dashboard-account">
                <Link
                  href={`/users/${profile.username}`}
                  className="dashboard-account__link"
                >
                  <div
                    className="dashboard-account__avatar"
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

                  <div className="dashboard-account__info">
                    <div className="dashboard-account__name">
                      {profile.display_name}
                    </div>
                    {activeGame ? (
                      <div className="dashboard-account__game">
                        🎮 {activeGame.name}
                      </div>
                    ) : (
                      <div className="dashboard-account__email">
                        {user?.email ?? ""}
                      </div>
                    )}
                  </div>
                </Link>

                <form action={signOut}>
                  <button
                    type="submit"
                    className="dashboard-account__logout"
                    aria-label="Log out"
                    title="Log out"
                  >
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                      <polyline points="16 17 21 12 16 7" />
                      <line x1="21" y1="12" x2="9" y2="12" />
                    </svg>
                  </button>
                </form>
              </div>
            ) : (
              <Link href="/auth/sign-in" className="dashboard-signin-btn">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                  <polyline points="10 17 15 12 10 7" />
                  <line x1="15" y1="12" x2="3" y2="12" />
                </svg>
                Sign In
              </Link>
            )}
          </div>
        </MobileNav>
      </aside>
      <main className="dashboard-main">{children}</main>
    </div>
  );
}
