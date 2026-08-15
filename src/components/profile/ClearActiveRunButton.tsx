"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function ClearActiveRunButton({ userId }: { userId: string }) {
  const router = useRouter();
  const [isClearing, setIsClearing] = useState(false);

  async function handleClear() {
    if (isClearing) return;
    setIsClearing(true);

    const supabase = createClient();
    const { error } = await supabase
      .from("profiles")
      .update({
        active_game_slug: null,
        active_game_started_at: null,
        active_game_progress: 0,
        active_game_sync_count: 0,
        active_game_badges: 0,
        active_game_pokedex_caught: 0,
        active_game_playtime_seconds: 0,
      })
      .eq("id", userId);

    if (!error) {
      router.refresh();
    }
    setIsClearing(false);
  }

  return (
    <button
      type="button"
      className="profile-about__clear"
      onClick={handleClear}
      disabled={isClearing}
      aria-label="Stop this run"
      title="Stop this run"
    >
      {isClearing ? "…" : "✕"}
    </button>
  );
}
