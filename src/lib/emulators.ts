import fs from "node:fs";
import path from "node:path";

export type Emulator = {
  id: string;
  name: string;
  platforms: string[];
};

// Which emulators show up on the "How to add ROM" card picker for a given
// game, keyed by the same `platform` string used in src/lib/games.ts.
export const EMULATORS: Emulator[] = [
  {
    id: "mgba",
    name: "mGBA",
    platforms: ["Game Boy", "Game Boy Color", "Game Boy Advance"],
  },
  {
    id: "visualboyadvance-m",
    name: "VisualBoyAdvance-M",
    platforms: ["Game Boy", "Game Boy Color", "Game Boy Advance"],
  },
  {
    id: "my-boy",
    name: "My Boy!",
    platforms: ["Game Boy", "Game Boy Color", "Game Boy Advance"],
  },
  {
    id: "john-gba",
    name: "John GBA",
    platforms: ["Game Boy Advance"],
  },
  {
    id: "retroarch",
    name: "RetroArch",
    platforms: [
      "Game Boy",
      "Game Boy Color",
      "Game Boy Advance",
      "Nintendo DS",
    ],
  },
  {
    id: "desmume",
    name: "DeSmuME",
    platforms: ["Nintendo DS"],
  },
  {
    id: "melonds",
    name: "melonDS",
    platforms: ["Nintendo DS"],
  },
  {
    id: "drastic",
    name: "DraStic",
    platforms: ["Nintendo DS"],
  },
  {
    id: "ryujinx",
    name: "Ryujinx",
    platforms: ["Nintendo Switch"],
  },
  {
    id: "yuzu",
    name: "Yuzu",
    platforms: ["Nintendo Switch"],
  },
];

// Switch-era-style local icons: drop a "<id>.png" into public/emulators/
// for any emulator above and it's picked up automatically — no code change
// needed. Server-only (uses fs) — call from a server component and pass the
// result down as plain data, same pattern as GAME_BOXART.
const LOCAL_ICON_DIR = path.join(process.cwd(), "public", "emulators");

export function getEmulatorIcons(): Record<string, string> {
  const icons: Record<string, string> = {};

  for (const emulator of EMULATORS) {
    if (fs.existsSync(path.join(LOCAL_ICON_DIR, `${emulator.id}.png`))) {
      icons[emulator.id] = `/emulators/${emulator.id}.png`;
    }
  }

  return icons;
}

export function emulatorsForPlatform(platform: string): Emulator[] {
  return EMULATORS.filter((emulator) => emulator.platforms.includes(platform));
}
