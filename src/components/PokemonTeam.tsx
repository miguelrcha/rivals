"use client";

import { useEffect, useState } from "react";
import { getPokemonArtworkUrl } from "@/lib/pokeapi";
import type { PartyPokemon } from "@/lib/pokemon-saves/firered";

export function PokemonTeam({ party }: { party: PartyPokemon[] }) {
  const [artwork, setArtwork] = useState<Record<number, string | null>>({});

  useEffect(() => {
    const missing = Array.from(
      new Set(
        party
          .map((mon) => mon.nationalDexNumber)
          .filter((dex): dex is number => dex !== null && !(dex in artwork)),
      ),
    );
    if (missing.length === 0) return;

    let cancelled = false;
    Promise.all(
      missing.map(
        async (dex) => [dex, await getPokemonArtworkUrl(String(dex))] as const,
      ),
    ).then((results) => {
      if (cancelled) return;
      setArtwork((current) => {
        const next = { ...current };
        for (const [dex, url] of results) next[dex] = url;
        return next;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [party, artwork]);

  if (party.length === 0) return null;

  return (
    <div className="pokemon-team">
      {party.map((mon, index) => (
        <div
          className="pokemon-team__mon"
          key={index}
          title={`${mon.nickname || (mon.isEgg ? "Egg" : "?")} — Lv.${mon.level}`}
        >
          {mon.nationalDexNumber && artwork[mon.nationalDexNumber] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={artwork[mon.nationalDexNumber]!} alt={mon.nickname} />
          ) : (
            <span className="pokemon-team__mon-fallback">
              {mon.isEgg ? "🥚" : "?"}
            </span>
          )}
          <span className="pokemon-team__mon-nickname">
            {mon.nickname || (mon.isEgg ? "Egg" : "?")}
          </span>
          <span className="pokemon-team__mon-level">Lv.{mon.level}</span>
        </div>
      ))}
    </div>
  );
}
