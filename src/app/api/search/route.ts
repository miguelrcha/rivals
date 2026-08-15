import { NextRequest, NextResponse } from "next/server";
import { GAMES } from "@/lib/games";
import { GAME_BOXART } from "@/lib/game-boxart";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";

  if (!query) {
    return NextResponse.json({ games: [], users: [] });
  }

  const search = query.toLowerCase();

  const games = GAMES.filter((game) => game.name.toLowerCase().includes(search))
    .slice(0, 6)
    .map((game) => ({
      slug: game.slug,
      name: game.name,
      color: game.color,
      cover: GAME_BOXART[game.slug] ?? null,
    }));

  const supabase = await createClient();
  const [byUsername, byDisplayName] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "username, display_name, avatar_color, avatar_initial, avatar_url",
      )
      .ilike("username", `%${query}%`)
      .limit(6),
    supabase
      .from("profiles")
      .select(
        "username, display_name, avatar_color, avatar_initial, avatar_url",
      )
      .ilike("display_name", `%${query}%`)
      .limit(6),
  ]);

  const seen = new Set<string>();
  const users: {
    username: string;
    displayName: string;
    avatarColor: string;
    avatarInitial: string;
    avatarUrl: string | null;
  }[] = [];

  for (const profile of [
    ...(byUsername.data ?? []),
    ...(byDisplayName.data ?? []),
  ]) {
    if (seen.has(profile.username)) continue;
    seen.add(profile.username);
    users.push({
      username: profile.username,
      displayName: profile.display_name,
      avatarColor: profile.avatar_color,
      avatarInitial: profile.avatar_initial,
      avatarUrl: profile.avatar_url,
    });
  }

  return NextResponse.json({ games, users: users.slice(0, 6) });
}
