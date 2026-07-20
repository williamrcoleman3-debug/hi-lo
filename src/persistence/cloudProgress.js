import { supabase } from "../supabase/client.js";
import { LEVELS } from "../engine/levels.js";

function emptyLevelProgress() {
  return { bestStreak: 0, sameHit: false, redBlackHit: false, lowestOddsSameHit: null };
}

export async function fetchCloudLevelProgress(userId) {
  const { data, error } = await supabase.from("level_progress").select("*").eq("user_id", userId);
  if (error) throw error;

  const levelProgress = {};
  for (const level of LEVELS) {
    const row = data.find((r) => r.level_id === level.id);
    levelProgress[level.id] = row
      ? {
          bestStreak: row.best_streak,
          sameHit: row.same_hit,
          redBlackHit: row.red_black_hit,
          lowestOddsSameHit: row.lowest_odds_same_hit,
        }
      : emptyLevelProgress();
  }
  return levelProgress;
}

// Mirrors applyCorrectCall's fold (see persistence/progress.js), but as an
// atomic DB-side upsert via record_level_progress() — safe against races
// from multiple tabs/devices. Fire-and-forget from the caller's perspective;
// errors are logged, not thrown, since this is a best-effort background sync
// layered on top of the always-authoritative local optimistic update.
export async function recordLevelProgressRemote(levelId, { streak, sameHit, redBlackHit, sameOdds }) {
  const { error } = await supabase.rpc("record_level_progress", {
    p_level_id: levelId,
    p_streak: streak,
    p_same_hit: sameHit,
    p_red_black_hit: redBlackHit,
    p_same_odds: sameOdds ?? null,
  });
  if (error) console.error("recordLevelProgressRemote failed:", error.message);
}

// Returns { isNewPeak } — whether this amount beat the player's previous
// peak_score for the level, straight from the atomic RPC (see
// supabase/schema.sql#record_run_end) rather than a separate client-side
// read-then-compare, which could race across tabs/devices.
export async function recordRunEndRemote(levelId, amount, wasBanked) {
  const { data, error } = await supabase.rpc("record_run_end", {
    p_level_id: levelId,
    p_amount: amount,
    p_was_banked: wasBanked,
  });
  if (error) {
    console.error("recordRunEndRemote failed:", error.message);
    return { isNewPeak: false };
  }
  return { isNewPeak: data?.[0]?.is_new_peak ?? false };
}

// One-time (per sign-in) push of whatever was accumulated anonymously in
// localStorage, so a player who creates an account after playing a while
// doesn't lose that progress. Safe to call repeatedly — the RPC's
// GREATEST/OR merge semantics make this idempotent.
export async function migrateLocalProgressToCloud(localLevelProgress) {
  for (const level of LEVELS) {
    const lp = localLevelProgress[level.id];
    if (!lp || (lp.bestStreak === 0 && !lp.sameHit && !lp.redBlackHit)) continue;
    await recordLevelProgressRemote(level.id, {
      streak: lp.bestStreak,
      sameHit: lp.sameHit,
      redBlackHit: lp.redBlackHit,
      sameOdds: lp.lowestOddsSameHit ?? undefined,
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
