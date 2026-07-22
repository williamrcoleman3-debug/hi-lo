import { supabase } from "../supabase/client.js";
import { DECKS } from "../engine/decks.js";

function emptyDeckProgress() {
  return { bestWinStreak: 0, sameHit: false, redBlackHit: false, lowestOddsSameHit: null };
}

export async function fetchCloudDeckProgress(userId) {
  const { data, error } = await supabase.from("deck_progress").select("*").eq("user_id", userId);
  if (error) throw error;

  const deckProgress = {};
  for (const deck of DECKS) {
    const row = data.find((r) => r.deck_id === deck.id);
    deckProgress[deck.id] = row
      ? {
          bestWinStreak: row.best_win_streak,
          sameHit: row.same_hit,
          redBlackHit: row.red_black_hit,
          lowestOddsSameHit: row.lowest_odds_same_hit,
        }
      : emptyDeckProgress();
  }
  return deckProgress;
}

// record_deck_progress()/record_game_end() are retired (see
// supabase/schema.sql) -- the server now tracks banked amount, win streak,
// and deck_progress entirely itself via a game_sessions row, finalized
// through bust_session()/bank_session() (see src/session/gameSession.js).
// There is no longer any endpoint that accepts a client-reported outcome.
//
// This also means anonymous (local-only, never server-touched) progress no
// longer migrates into deck_progress on sign-in (migrateLocalProgressToCloud
// is gone) -- that data was always purely client-computed with nothing to
// verify it, so crediting it to a real account's best_win_streak would just
// reopen the exact hole this rebuild closes. A player who signs up after
// playing anonymously starts deck_progress fresh; equipped_theme (a
// cosmetic preference, not an achievement) still carries over below.

// equipped_theme is a plain preference, not a race-sensitive metric like the
// streak/score columns — a direct table read/write is fine, no RPC needed.
export async function fetchEquippedTheme(userId) {
  const { data, error } = await supabase.from("profiles").select("equipped_theme").eq("id", userId).maybeSingle();
  if (error) throw error;
  return data?.equipped_theme ?? null;
}

export async function pushEquippedTheme(userId, themeId) {
  const { error } = await supabase.from("profiles").update({ equipped_theme: themeId }).eq("id", userId);
  if (error) console.error("pushEquippedTheme failed:", error.message);
}
