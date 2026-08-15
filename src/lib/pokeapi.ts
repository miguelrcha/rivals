const POKEAPI_BASE = "https://pokeapi.co/api/v2";
const ONE_DAY = 60 * 60 * 24;

type PokeApiPokemon = {
  sprites: {
    other?: {
      "official-artwork"?: {
        front_default: string | null;
      };
    };
  };
};

export async function getPokemonArtworkUrl(
  pokemonName: string,
): Promise<string | null> {
  try {
    const res = await fetch(`${POKEAPI_BASE}/pokemon/${pokemonName}`, {
      next: { revalidate: ONE_DAY },
    });

    if (!res.ok) return null;

    const data: PokeApiPokemon = await res.json();
    return data.sprites.other?.["official-artwork"]?.front_default ?? null;
  } catch {
    return null;
  }
}
