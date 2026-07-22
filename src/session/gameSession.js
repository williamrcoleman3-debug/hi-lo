import { supabase } from "../supabase/client.js";

// Thin wrappers over the server-authoritative RPCs (see supabase/schema.sql
// -- start_game/make_call/use_lifeline_in_session/bust_session/bank_session).
// The server owns the shuffled deck and the running banked/win-streak state;
// these functions never send or receive the deck itself, only the current
// compare card and the outcome of each call.

export async function startGame(deckId) {
  const { data, error } = await supabase.rpc("start_game", { p_deck_id: deckId });
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
    status: row.status,
    gain: row.gain,
    cardsLeft: row.cards_left,
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
