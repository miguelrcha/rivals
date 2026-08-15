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

export type FireRedSaveStats = {
  badgeCount: number;
  pokedexOwned: number;
  pokedexSeen: number;
  playTimeSeconds: number;
  /** 0-100, based on gym badges obtained (out of 8). */
  progress: number;
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

  return {
    badgeCount,
    pokedexOwned,
    pokedexSeen,
    playTimeSeconds,
    progress: Math.round((badgeCount / 8) * 100),
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
