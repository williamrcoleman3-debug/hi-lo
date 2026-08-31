import { supabase } from "../supabase/client.js";
import { getDeviceId } from "../device/deviceId.js";

// Thin wrappers over the server-authoritative RPCs (see supabase/schema.sql
// -- start_game/make_call/use_lifeline_in_session/bust_session/bank_session).
// The server owns the shuffled deck and the running banked/win-streak state;
// these functions never send or receive the deck itself, only the current
// compare card and the outcome of each call.

export async function startGame(deckId, speedMode = false) {
  const { data, error } = await supabase.rpc("start_game", {
    p_deck_id: deckId,
    p_speed_mode: speedMode,
    // Manual-review signal only (see schema.sql's game_sessions.device_id)
    // -- never read on any gameplay path. null is a normal value here
    // (private browsing, storage disabled), start_game() accepts it as-is.
    p_device_id: getDeviceId(),
  });
  if (error) throw error;
  const row = data?.[0];
  return {
    sessionId: row.session_id,
    compareCard: row.compare_card,
    cardsLeft: row.cards_left,
    ante: row.ante,
  };
}

export async function makeServerCall(sessionId, call) {
  const { data, error } = await supabase.rpc("make_call", { p_session_id: sessionId, p_call: call });
  if (error) throw error;
  const row = data?.[0];
  return {
    correct: row.correct,
    drawnCard: row.drawn_card,
    banked: row.banked,
    winStreak: row.win_streak,
    // "cashed" here means the session already auto-finalized server-side
    // (a lifeline-used game that just cleared the full deck) -- voluntary
    // banking is disabled after a lifeline use, so this is the only way
    // that payout can ever be collected. No separate bankSession() call
    // is needed or possible once this comes back.
    status: row.status,
    gain: row.gain,
    cardsLeft: row.cards_left,
    isNewPeak: row.is_new_peak,
  };
}

export async function useLifelineInSession(sessionId) {
  const { data, error } = await supabase.rpc("use_lifeline_in_session", { p_session_id: sessionId });
  if (error) throw error;
  const row = data?.[0];
  return {
    success: row?.success ?? false,
    compareCard: row?.compare_card ?? null,
    lifelineBalance: row?.lifeline_balance ?? null,
    status: row?.status ?? null,
  };
}

export async function bustSession(sessionId) {
  const { data, error } = await supabase.rpc("bust_session", { p_session_id: sessionId });
  if (error) throw error;
  return { isNewPeak: data?.[0]?.is_new_peak ?? false };
}

export async function bankSession(sessionId) {
  const { data, error } = await supabase.rpc("bank_session", { p_session_id: sessionId });
  if (error) throw error;
  return { isNewPeak: data?.[0]?.is_new_peak ?? false };
}

// Ad-gate RPC (see supabase/schema.sql's "REMOVE ADS + AD SYSTEM"
// section) -- entirely separate from the session RPCs above, it only ever
// touches profiles' own ad-related columns, never game_sessions or the
// deck. Fails open on error at the call site (see
// src/ads/adGate.js#runGameStartAdGate), never here.
export async function shouldShowAdForNewGame() {
  const { data, error } = await supabase.rpc("should_show_ad_for_new_game");
  if (error) throw error;
  return data === true;
}

// Grants +20 game starts for today (see supabase/schema.sql's
// grant_daily_bonus_games) -- only ever called after a rewarded ad
// actually resolves "rewarded" (see src/ads/rewardGate.js), never
// speculatively. No cap on how many times this can be called in a day;
// resets naturally at UTC midnight along with the base daily play limit.
// Returns the account's new total bonus-games-today count.
export async function grantDailyBonusGames() {
  const { data, error } = await supabase.rpc("grant_daily_bonus_games");
  if (error) throw error;
  return data;
}
