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

// Mirrors applyCorrectCall's fold (see persistence/progress.js), but as an
// atomic DB-side upsert via record_deck_progress() — safe against races
// from multiple tabs/devices. Fire-and-forget from the caller's perspective;
// errors are logged, not thrown, since this is a best-effort background sync
// layered on top of the always-authoritative local optimistic update.
export async function recordDeckProgressRemote(deckId, { winStreak, sameHit, redBlackHit, sameOdds }) {
  const { error } = await supabase.rpc("record_deck_progress", {
    p_deck_id: deckId,
    p_win_streak: winStreak,
    p_same_hit: sameHit,
    p_red_black_hit: redBlackHit,
    p_same_odds: sameOdds ?? null,
  });
  if (error) console.error("recordDeckProgressRemote failed:", error.message);
}

// Returns { isNewPeak } — whether this amount beat the player's previous
// peak_score for the deck, straight from the atomic RPC (see
// supabase/schema.sql#record_game_end) rather than a separate client-side
// read-then-compare, which could race across tabs/devices.
export async function recordGameEndRemote(deckId, amount, wasBanked) {
  const { data, error } = await supabase.rpc("record_game_end", {
    p_deck_id: deckId,
    p_amount: amount,
    p_was_banked: wasBanked,
  });
  if (error) {
    console.error("recordGameEndRemote failed:", error.message);
    return { isNewPeak: false };
  }
  return { isNewPeak: data?.[0]?.is_new_peak ?? false };
}

// One-time (per sign-in) push of whatever was accumulated anonymously in
// localStorage, so a player who creates an account after playing a while
// doesn't lose that progress. Safe to call repeatedly — the RPC's
// GREATEST/OR merge semantics make this idempotent.
export async function migrateLocalProgressToCloud(localDeckProgress) {
  for (const deck of DECKS) {
    const dp = localDeckProgress[deck.id];
    if (!dp || (dp.bestWinStreak === 0 && !dp.sameHit && !dp.redBlackHit)) continue;
    await recordDeckProgressRemote(deck.id, {
      winStreak: dp.bestWinStreak,
      sameHit: dp.sameHit,
      redBlackHit: dp.redBlackHit,
      sameOdds: dp.lowestOddsSameHit ?? undefined,
    });
  }
}

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
