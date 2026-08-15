// Parses a Pokémon FireRed/LeafGreen .sav file (Generation III, GBA) to pull
// real progress: gym badges, Pokédex count, and play time.
//
// A .gba ROM is identical for every copy of the game — it never contains a
// specific player's progress. That data only exists in the save file, which
// the game writes to the cartridge's flash memory at runtime. So this reads
// the .sav, not the .gba.
//
// Byte offsets below are verified against the real decompiled game source
// (github.com/pret/pokefirered — the ROM-hacking community's disassembly),
// not guessed:
//   - include/global.h: struct SaveBlock2 (player/pokedex) and
//     struct SaveBlock1 (world state, incl. event flags)
//   - include/save.h: struct SaveSector / sector footer layout
//   - include/constants/flags.h: FLAG_BADGE01_GET..FLAG_BADGE08_GET

const SECTOR_DATA_SIZE = 3968; // include/save.h SECTOR_DATA_SIZE
const SECTOR_SIZE = 4096; // SECTOR_DATA_SIZE + SECTOR_FOOTER_SIZE (128)
const SECTORS_PER_SLOT = 14; // include/save.h NUM_SECTORS_PER_SLOT
const SLOT_SIZE = SECTOR_SIZE * SECTORS_PER_SLOT; // 57344 bytes
const SECTOR_FOOTER_SIGNATURE = 0x08012025; // Gen III save sector magic

// Footer fields, relative to the start of a sector (SaveSector struct).
const FOOTER_ID_OFFSET = SECTOR_DATA_SIZE + 116; // 0xFF4
const FOOTER_SIGNATURE_OFFSET = SECTOR_DATA_SIZE + 120; // 0xFF8
const FOOTER_COUNTER_OFFSET = SECTOR_DATA_SIZE + 124; // 0xFFC

const SECTOR_ID_SAVEBLOCK2 = 0;
const SECTOR_ID_SAVEBLOCK1_START = 1;
const SECTOR_ID_SAVEBLOCK1_END = 4;

// SaveBlock2 offsets (sector id 0).
const PLAY_TIME_HOURS_OFFSET = 0x00e; // u16
const PLAY_TIME_MINUTES_OFFSET = 0x010; // u8
const PLAY_TIME_SECONDS_OFFSET = 0x011; // u8
const POKEDEX_OWNED_OFFSET = 0x028; // struct Pokedex.owned, at SaveBlock2+0x18+0x10
const POKEDEX_SEEN_OFFSET = 0x05c; // struct Pokedex.seen, at SaveBlock2+0x18+0x44
const POKEDEX_FLAG_BYTES = 52; // DEX_FLAGS_NO, derived from seen/owned spacing (0x44-0x10)
const NATIONAL_DEX_COUNT = 386; // Gen III era Pokédex size

// SaveBlock1 offset (spans sector ids 1-4, concatenated).
// FLAG_BADGE01_GET = SYS_FLAGS(0x800) + 0x20 = 0x820 -> byte 0x104, bit 0.
// All 8 badge flags are consecutive, so they share one byte.
// Absolute SaveBlock1 offset: flags[NUM_FLAG_BYTES] at 0x0EE0, + 0x104 = 0xFE4.
const BADGES_BYTE_OFFSET = 0x0fe4;

const PLAYER_NAME_OFFSET = 0x000; // SaveBlock2.playerName
const PLAYER_NAME_MAX_LENGTH = 7; // PLAYER_NAME_LENGTH
const STRING_TERMINATOR = 0xff; // Gen III end-of-string byte

// SaveBlock1 offsets (spans sector ids 1-4, concatenated) — struct SaveBlock1:
// /*0x0034*/ u8 playerPartyCount;
// /*0x0038*/ struct Pokemon playerParty[PARTY_SIZE];
const PARTY_COUNT_OFFSET = 0x034;
const PARTY_OFFSET = 0x038;
const PARTY_SIZE = 6;

// struct Pokemon is a 80-byte struct BoxPokemon followed by 20 bytes of
// battle stats (status, level, mail, current/max HP, stats) — 100 bytes
// total per party slot.
const PARTY_MON_SIZE = 100;

// struct BoxPokemon layout (bytes, all little-endian):
const BOXMON_NICKNAME_OFFSET = 0x008; // u8 nickname[POKEMON_NAME_LENGTH]
const NICKNAME_MAX_LENGTH = 10; // POKEMON_NAME_LENGTH
// Bitfield byte holding isBadEgg:1, hasSpecies:1, isEgg:1, blockBoxRS:1 —
// isEgg is bit index 2.
const BOXMON_FLAGS_OFFSET = 0x013;
const BOXMON_CHECKSUM_OFFSET = 0x01c; // u16 checksum
const BOXMON_SECURE_DATA_OFFSET = 0x020; // 48 bytes, 4x12-byte encrypted substructs

// struct Pokemon fields after the 80-byte BoxPokemon.
const MON_LEVEL_OFFSET = 84;
const MON_HP_OFFSET = 86;
const MON_MAX_HP_OFFSET = 88;

// Growth/Attacks/EVsCondition/Misc substructs are shuffled in memory based
// on personality % 24. Each row gives the physical word-group index (0-3,
// each group = 3 u32 words) for [growth, attacks, evCondition, misc] —
// taken verbatim from GetSubstruct's SUBSTRUCT_CASE table in pokemon.c.
const SUBSTRUCT_ORDER: readonly (readonly [number, number, number, number])[] =
  [
    [0, 1, 2, 3], [0, 1, 3, 2], [0, 2, 1, 3], [0, 3, 1, 2],
    [0, 2, 3, 1], [0, 3, 2, 1], [1, 0, 2, 3], [1, 0, 3, 2],
    [2, 0, 1, 3], [3, 0, 1, 2], [2, 0, 3, 1], [3, 0, 2, 1],
    [1, 2, 0, 3], [1, 3, 0, 2], [2, 1, 0, 3], [3, 1, 0, 2],
    [2, 3, 0, 1], [3, 2, 0, 1], [1, 2, 3, 0], [1, 3, 2, 0],
    [2, 1, 3, 0], [3, 1, 2, 0], [2, 3, 1, 0], [3, 2, 1, 0],
  ];

// Kanto gym badges, in FLAG_BADGE01_GET..FLAG_BADGE08_GET order — bit 0 of
// the badges byte is Boulder Badge, bit 7 is Earth Badge.
export const KANTO_BADGE_NAMES = [
  "Boulder Badge",
  "Cascade Badge",
  "Thunder Badge",
  "Rainbow Badge",
  "Soul Badge",
  "Marsh Badge",
  "Volcano Badge",
  "Earth Badge",
] as const;

// Gen III's custom character encoding (charmap.txt from the decompiled
// source) — covers the subset player names actually use: A-Z, a-z, 0-9.
const CHARMAP: Record<number, string> = {
  0xa1: "0", 0xa2: "1", 0xa3: "2", 0xa4: "3", 0xa5: "4",
  0xa6: "5", 0xa7: "6", 0xa8: "7", 0xa9: "8", 0xaa: "9",
  0xbb: "A", 0xbc: "B", 0xbd: "C", 0xbe: "D", 0xbf: "E",
  0xc0: "F", 0xc1: "G", 0xc2: "H", 0xc3: "I", 0xc4: "J",
  0xc5: "K", 0xc6: "L", 0xc7: "M", 0xc8: "N", 0xc9: "O",
  0xca: "P", 0xcb: "Q", 0xcc: "R", 0xcd: "S", 0xce: "T",
  0xcf: "U", 0xd0: "V", 0xd1: "W", 0xd2: "X", 0xd3: "Y",
  0xd4: "Z", 0xd5: "a", 0xd6: "b", 0xd7: "c", 0xd8: "d",
  0xd9: "e", 0xda: "f", 0xdb: "g", 0xdc: "h", 0xdd: "i",
  0xde: "j", 0xdf: "k", 0xe0: "l", 0xe1: "m", 0xe2: "n",
  0xe3: "o", 0xe4: "p", 0xe5: "q", 0xe6: "r", 0xe7: "s",
  0xe8: "t", 0xe9: "u", 0xea: "v", 0xeb: "w", 0xec: "x",
  0xed: "y", 0xee: "z", 0x00: " ",
};

export type PartyPokemon = {
  nickname: string;
  /** National Dex number, or null for the ~25 unused internal slots. */
  nationalDexNumber: number | null;
  level: number;
  isEgg: boolean;
  currentHp: number;
  maxHp: number;
};

export type FireRedSaveStats = {
  playerName: string;
  badgeCount: number;
  badges: string[];
  pokedexOwned: number;
  pokedexSeen: number;
  playTimeSeconds: number;
  /** 0-100, based on gym badges obtained (out of 8). */
  progress: number;
  party: PartyPokemon[];
};

type Sector = { id: number; counter: number; data: Uint8Array };

export function parseFireRedSave(buffer: ArrayBuffer): FireRedSaveStats | null {
  if (buffer.byteLength < SLOT_SIZE) return null;

  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);

  const slotOffsets = [0, SLOT_SIZE].filter(
    (offset) => offset + SLOT_SIZE <= bytes.length,
  );

  let bestSlotSectors: Map<number, Sector> | null = null;
  let bestCounter = -1;

  for (const slotOffset of slotOffsets) {
    const sectors = new Map<number, Sector>();
    let slotCounter = -1;

    for (let i = 0; i < SECTORS_PER_SLOT; i++) {
      const sectorOffset = slotOffset + i * SECTOR_SIZE;
      const signature = view.getUint32(
        sectorOffset + FOOTER_SIGNATURE_OFFSET,
        true,
      );
      if (signature !== SECTOR_FOOTER_SIGNATURE) continue;

      const id = view.getUint16(sectorOffset + FOOTER_ID_OFFSET, true);
      const counter = view.getUint32(sectorOffset + FOOTER_COUNTER_OFFSET, true);
      const data = bytes.slice(sectorOffset, sectorOffset + SECTOR_DATA_SIZE);

      sectors.set(id, { id, counter, data });
      slotCounter = Math.max(slotCounter, counter);
    }

    if (sectors.size > 0 && slotCounter > bestCounter) {
      bestCounter = slotCounter;
      bestSlotSectors = sectors;
    }
  }

  if (!bestSlotSectors) return null;

  const saveBlock2 = bestSlotSectors.get(SECTOR_ID_SAVEBLOCK2)?.data;
  if (!saveBlock2) return null;

  const saveBlock1Parts: Uint8Array[] = [];
  for (let id = SECTOR_ID_SAVEBLOCK1_START; id <= SECTOR_ID_SAVEBLOCK1_END; id++) {
    const sector = bestSlotSectors.get(id);
    if (!sector) return null;
    saveBlock1Parts.push(sector.data);
  }
  const saveBlock1 = concatBytes(saveBlock1Parts);

  const badgesByte = saveBlock1[BADGES_BYTE_OFFSET] ?? 0;
  const badgeCount = popcount(badgesByte);
  const badges = KANTO_BADGE_NAMES.filter(
    (_, index) => (badgesByte >> index) & 1,
  );

  const playerName = decodePlayerName(saveBlock2, PLAYER_NAME_OFFSET);

  const pokedexOwned = countSetBits(
    saveBlock2,
    POKEDEX_OWNED_OFFSET,
    POKEDEX_FLAG_BYTES,
    NATIONAL_DEX_COUNT,
  );
  const pokedexSeen = countSetBits(
    saveBlock2,
    POKEDEX_SEEN_OFFSET,
    POKEDEX_FLAG_BYTES,
    NATIONAL_DEX_COUNT,
  );

  const hours = readUint16(saveBlock2, PLAY_TIME_HOURS_OFFSET);
  const minutes = saveBlock2[PLAY_TIME_MINUTES_OFFSET] ?? 0;
  const seconds = saveBlock2[PLAY_TIME_SECONDS_OFFSET] ?? 0;
  const playTimeSeconds = hours * 3600 + minutes * 60 + seconds;

  const partyCount = Math.min(
    saveBlock1[PARTY_COUNT_OFFSET] ?? 0,
    PARTY_SIZE,
  );
  const party: PartyPokemon[] = [];
  for (let i = 0; i < partyCount; i++) {
    const slotOffset = PARTY_OFFSET + i * PARTY_MON_SIZE;
    const slot = saveBlock1.slice(slotOffset, slotOffset + PARTY_MON_SIZE);
    if (slot.length < PARTY_MON_SIZE) continue;

    const mon = decodePartyMon(slot);
    if (mon) party.push(mon);
  }

  return {
    playerName,
    badgeCount,
    badges,
    pokedexOwned,
    pokedexSeen,
    playTimeSeconds,
    progress: Math.round((badgeCount / 8) * 100),
    party,
  };
}

function decodePlayerName(
  bytes: Uint8Array,
  offset: number,
  maxLength: number = PLAYER_NAME_MAX_LENGTH,
): string {
  let name = "";
  for (let i = 0; i < maxLength; i++) {
    const byte = bytes[offset + i];
    if (byte === undefined || byte === STRING_TERMINATOR) break;
    name += CHARMAP[byte] ?? "?";
  }
  return name;
}

// Internal FRLG species indices 1-251 line up with the National Dex (Kanto
// and Johto share the Gen I/II ordering). Hoenn species (National Dex
// 252-386) were appended after 25 unused "old Unown" slots, so their
// internal index is offset by +25 (SPECIES_TREECKO = 277 -> Dex #252) —
// see include/constants/species.h in the decompiled source.
function speciesIndexToNationalDex(speciesIndex: number): number | null {
  if (speciesIndex >= 1 && speciesIndex <= 251) return speciesIndex;
  if (speciesIndex >= 277 && speciesIndex <= 411) return speciesIndex - 25;
  return null;
}

// Decrypts and reads one 100-byte party slot (struct Pokemon). Party data is
// encrypted (unlike the plain SaveBlock1/2 fields above) — see
// EncryptBoxMon/DecryptBoxMon and GetSubstruct in src/pokemon.c.
function decodePartyMon(slot: Uint8Array): PartyPokemon | null {
  const view = new DataView(slot.buffer, slot.byteOffset, slot.byteLength);
  const personality = view.getUint32(0, true);
  const otId = view.getUint32(4, true);
  if (personality === 0 && otId === 0) return null;

  const nickname = decodePlayerName(
    slot,
    BOXMON_NICKNAME_OFFSET,
    NICKNAME_MAX_LENGTH,
  );
  const isEgg = ((slot[BOXMON_FLAGS_OFFSET] ?? 0) >> 2 & 1) === 1;
  const storedChecksum = view.getUint16(BOXMON_CHECKSUM_OFFSET, true);

  // Decrypt the 48-byte secure block (12 u32 words) with personality ^ otId.
  const words: number[] = [];
  for (let i = 0; i < 12; i++) {
    const encrypted = view.getUint32(BOXMON_SECURE_DATA_OFFSET + i * 4, true);
    words.push((encrypted ^ personality ^ otId) >>> 0);
  }

  // Checksum = sum of every u16 half-word across all 12 decrypted u32
  // words, wrapping to 16 bits — validates the decryption key was right.
  let checksum = 0;
  for (const word of words) {
    checksum = (checksum + (word & 0xffff) + (word >>> 16)) & 0xffff;
  }
  if (checksum !== storedChecksum) return null;

  const [growthSlot] = SUBSTRUCT_ORDER[personality % 24];
  const species = words[growthSlot * 3] & 0xffff;
  if (species === 0) return null;

  return {
    nickname,
    nationalDexNumber: speciesIndexToNationalDex(species),
    level: slot[MON_LEVEL_OFFSET] ?? 0,
    isEgg,
    currentHp: view.getUint16(MON_HP_OFFSET, true),
    maxHp: view.getUint16(MON_MAX_HP_OFFSET, true),
  };
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

function readUint16(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] ?? 0) | ((bytes[offset + 1] ?? 0) << 8);
}

function popcount(byte: number): number {
  let count = 0;
  let value = byte;
  while (value > 0) {
    count += value & 1;
    value >>= 1;
  }
  return count;
}

function countSetBits(
  bytes: Uint8Array,
  offset: number,
  byteCount: number,
  bitLimit: number,
): number {
  let count = 0;
  for (let bit = 0; bit < bitLimit; bit++) {
    const byteIndex = offset + (bit >> 3);
    const bitIndex = bit & 7;
    if (byteIndex - offset >= byteCount) break;
    if (((bytes[byteIndex] ?? 0) >> bitIndex) & 1) count++;
  }
  return count;
}
