import { NextResponse } from "next/server";
import { GAME_BOXART } from "@/lib/game-boxart";

export const dynamic = "force-static";
export const revalidate = 60 * 60 * 24;

export async function GET() {
  return NextResponse.json(GAME_BOXART);
}
