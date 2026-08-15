import type { Metadata } from "next";
import { GamesBrowser } from "@/components/dashboard/GamesBrowser";
import { SupporterBanner } from "@/components/dashboard/SupporterBanner";

export const metadata: Metadata = {
  title: "Games / Rivals",
  description: "Every Pokémon game the crew can race.",
};

export default function GamesPage() {
  return <GamesBrowser banner={<SupporterBanner />} />;
}
