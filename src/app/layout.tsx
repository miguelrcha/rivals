import type { Metadata } from "next";
import "./globals.css";
import "./site.css";

export const metadata: Metadata = {
  title: "Rivals / Convide seus amigos para uma liga de speedrun de Pokémon",
  description:
    "rivals é uma liga de speedrun de Pokémon entre amigos: um leaderboard compartilhado, splits ao vivo, noites de corrida semanais e regras que mantêm cada corrida honesta.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
