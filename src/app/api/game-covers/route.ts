import { NextResponse } from "next/server";
import { GAME_BOXART } from "@/lib/game-boxart";

export const dynamic = "force-static";
export const revalidate = 86400;

export async function GET() {
  return NextResponse.json(GAME_BOXART);
}
