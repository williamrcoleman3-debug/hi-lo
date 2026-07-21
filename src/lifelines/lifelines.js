import { supabase } from "../supabase/client.js";

export const LIFELINE_COST_TOKENS = 10000;
export const MAX_LIFELINES_PER_GAME = 2;

// Redeems spendable_tokens (a pool separate from the permanent
// cumulative_banked leaderboard column) for one lifeline. Returns the
// updated balances regardless of outcome, so the caller can refresh its
// local view of both without a second round-trip.
export async function redeemLifeline() {
  const { data, error } = await supabase.rpc("redeem_lifeline");
  if (error) {
    console.error("redeemLifeline failed:", error.message);
    return { success: false, lifelineBalance: null, spendableTokens: null };
  }
  const row = data?.[0];
  return {
    success: row?.success ?? false,
    lifelineBalance: row?.lifeline_balance ?? null,
    spendableTokens: row?.spendable_tokens ?? null,
  };
}

// Atomically spends one lifeline from the account balance. The per-game
// cap of 2 is separate, client-side session state (see hooks/useGame.js) —
// this only guards the persistent account balance itself.
export async function useLifelineRemote() {
  const { data, error } = await supabase.rpc("use_lifeline");
  if (error) {
    console.error("useLifelineRemote failed:", error.message);
    return { success: false, lifelineBalance: null };
  }
  const row = data?.[0];
  return { success: row?.success ?? false, lifelineBalance: row?.lifeline_balance ?? null };
}
