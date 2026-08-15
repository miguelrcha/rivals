import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const revalidate = 30;

export async function GET() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("active_game_slug")
    .not("active_game_slug", "is", null);

  const racersBySlug: Record<string, number> = {};
  for (const row of data ?? []) {
    const slug = row.active_game_slug as string;
    racersBySlug[slug] = (racersBySlug[slug] ?? 0) + 1;
  }

  return NextResponse.json(racersBySlug);
}
