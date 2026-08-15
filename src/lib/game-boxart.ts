import fs from "node:fs";
import path from "node:path";

const LIBRETRO_BASE =
  "https://raw.githubusercontent.com/libretro-thumbnails";

function boxart(repo: string, filename: string) {
  return `${LIBRETRO_BASE}/${repo}/master/Named_Boxarts/${encodeURIComponent(filename)}`;
}

// Switch-era games aren't covered by libretro-thumbnails (it targets retro
// emulation). Drop a "<slug>.png" into public/box-art/ for any of these and
// it picks it up automatically — no code change needed.
const LOCAL_BOXART_DIR = path.join(process.cwd(), "public", "box-art");
const SWITCH_ERA_SLUGS = [
  "pokemon-lets-go-pikachu",
  "pokemon-lets-go-eevee",
  "pokemon-sword",
  "pokemon-shield",
  "pokemon-brilliant-diamond",
  "pokemon-shining-pearl",
  "pokemon-legends-arceus",
  "pokemon-scarlet",
  "pokemon-violet",
  "pokemon-legends-za",
];

function localBoxart(): Record<string, string> {
  const entries: Record<string, string> = {};

  for (const slug of SWITCH_ERA_SLUGS) {
    if (fs.existsSync(path.join(LOCAL_BOXART_DIR, `${slug}.png`))) {
      entries[slug] = `/box-art/${slug}.png`;
    }
  }

  return entries;
}

/**
 * Real cover art per game. Games with a scan available from the
 * libretro-thumbnails project (community-maintained box art packs for
 * RetroArch) use that; Switch-era games use a locally-provided image from
 * public/box-art/ when present. Missing either way falls back in the UI
 * to the placeholder cover.
 */
const REMOTE_BOXART: Record<string, string> = {
  "pokemon-red": boxart(
    "Nintendo_-_Game_Boy",
    "Pokemon - Red Version (USA, Europe) (SGB Enhanced).png",
  ),
  "pokemon-blue": boxart(
    "Nintendo_-_Game_Boy",
    "Pokemon - Blue Version (USA, Europe) (SGB Enhanced).png",
  ),
  "pokemon-green": boxart(
    "Nintendo_-_Game_Boy",
    "Pokemon - Green Version (USA, Europe) (SGB Enhanced).png",
  ),
  "pokemon-yellow": boxart(
    "Nintendo_-_Game_Boy",
    "Pokemon - Yellow Version - Special Pikachu Edition (USA, Europe) (CGB+SGB Enhanced).png",
  ),
  "pokemon-gold": boxart(
    "Nintendo_-_Game_Boy_Color",
    "Pokemon - Gold Version (USA, Europe) (SGB Enhanced) (GB Compatible).png",
  ),
  "pokemon-silver": boxart(
    "Nintendo_-_Game_Boy_Color",
    "Pokemon - Silver Version (USA, Europe) (SGB Enhanced) (GB Compatible).png",
  ),
  "pokemon-crystal": boxart(
    "Nintendo_-_Game_Boy_Color",
    "Pokemon - Crystal Version (USA).png",
  ),
  "pokemon-ruby": boxart(
    "Nintendo_-_Game_Boy_Advance",
    "Pokemon - Ruby Version (USA).png",
  ),
  "pokemon-sapphire": boxart(
    "Nintendo_-_Game_Boy_Advance",
    "Pokemon - Sapphire Version (USA).png",
  ),
  "pokemon-emerald": boxart(
    "Nintendo_-_Game_Boy_Advance",
    "Pokemon - Emerald Version (USA, Europe).png",
  ),
  "pokemon-fire-red": boxart(
    "Nintendo_-_Game_Boy_Advance",
    "Pokemon - FireRed Version (USA).png",
  ),
  "pokemon-leaf-green": boxart(
    "Nintendo_-_Game_Boy_Advance",
    "Pokemon - LeafGreen Version (USA).png",
  ),
  "pokemon-diamond": boxart(
    "Nintendo_-_Nintendo_DS",
    "Pokemon - Diamond Version (USA) (Rev 5).png",
  ),
  "pokemon-pearl": boxart(
    "Nintendo_-_Nintendo_DS",
    "Pokemon - Pearl Version (USA) (Rev 5).png",
  ),
  "pokemon-platinum": boxart(
    "Nintendo_-_Nintendo_DS",
    "Pokemon - Platinum Version (USA).png",
  ),
  "pokemon-heartgold": boxart(
    "Nintendo_-_Nintendo_DS",
    "Pokemon - HeartGold Version (USA).png",
  ),
  "pokemon-soulsilver": boxart(
    "Nintendo_-_Nintendo_DS",
    "Pokemon - SoulSilver Version (USA).png",
  ),
  "pokemon-black": boxart(
    "Nintendo_-_Nintendo_DS",
    "Pokemon - Black Version (USA, Europe) (NDSi Enhanced).png",
  ),
  "pokemon-white": boxart(
    "Nintendo_-_Nintendo_DS",
    "Pokemon - White Version (USA, Europe) (NDSi Enhanced).png",
  ),
  "pokemon-black-2": boxart(
    "Nintendo_-_Nintendo_DS",
    "Pokemon - Black Version 2 (USA, Europe) (NDSi Enhanced).png",
  ),
  "pokemon-white-2": boxart(
    "Nintendo_-_Nintendo_DS",
    "Pokemon - White Version 2 (USA, Europe) (NDSi Enhanced).png",
  ),
  "pokemon-x": boxart("Nintendo_-_Nintendo_3DS", "Pokemon X (USA).png"),
  "pokemon-y": boxart("Nintendo_-_Nintendo_3DS", "Pokemon Y (USA).png"),
  "pokemon-omega-ruby": boxart(
    "Nintendo_-_Nintendo_3DS",
    "Pokemon Omega Ruby (USA).png",
  ),
  "pokemon-alpha-sapphire": boxart(
    "Nintendo_-_Nintendo_3DS",
    "Pokemon Alpha Sapphire (USA).png",
  ),
  "pokemon-sun": boxart(
    "Nintendo_-_Nintendo_3DS",
    "Pokemon Sun (USA) (En,Ja,Fr,De,Es,It,Zh,Ko).png",
  ),
  "pokemon-moon": boxart(
    "Nintendo_-_Nintendo_3DS",
    "Pokemon Moon (USA) (En,Ja,Fr,De,Es,It,Zh,Ko).png",
  ),
  "pokemon-ultra-sun": boxart(
    "Nintendo_-_Nintendo_3DS",
    "Pokemon Ultra Sun (USA) (En,Ja,Fr,De,Es,It,Zh,Ko).png",
  ),
  "pokemon-ultra-moon": boxart(
    "Nintendo_-_Nintendo_3DS",
    "Pokemon Ultra Moon (USA) (En,Ja,Fr,De,Es,It,Zh,Ko).png",
  ),
};

export const GAME_BOXART: Record<string, string> = {
  ...REMOTE_BOXART,
  ...localBoxart(),
};
