import { NextResponse } from "next/server";
import { getPokemonArtworkUrl } from "@/lib/pokeapi";
import { GAME_MASCOTS } from "@/lib/pokemon-mascots";

export const dynamic = "force-static";
export const revalidate = 86400;

export async function GET() {
  const uniqueNames = Array.from(new Set(Object.values(GAME_MASCOTS)));

  const artByName = new Map(
    await Promise.all(
      uniqueNames.map(
        async (name) => [name, await getPokemonArtworkUrl(name)] as const,
      ),
    ),
  );

  const artBySlug = Object.fromEntries(
    Object.entries(GAME_MASCOTS).map(([slug, name]) => [
      slug,
      artByName.get(name) ?? null,
    ]),
  );

  return NextResponse.json(artBySlug);
}
