// =============================================================================
// CONTEST INTEGRITY — LEGALLY REQUIRED, NOT A DESIGN PREFERENCE
//
// The $25,000 contest is legally approved ONLY on the condition that players
// never pay real money for anything that improves their chances of winning.
// This means:
//
//   * Tokens must NEVER be purchasable with real currency, under any
//     circumstance, present or future.
//   * Any future monetization feature (ads, purchases, subscriptions, etc.)
//     must be reviewed against this constraint BEFORE implementation, not
//     after.
//   * This applies even to indirect paths (e.g. "buy tokens, redeem for
//     lifelines" violates this just as much as buying lifelines directly).
//
// If in doubt whether a proposed feature crosses this line, treat it as
// BLOCKED pending explicit legal review, not as a judgment call to make
// unilaterally.
// =============================================================================

import { HOUSE_EDGE } from "./constants.js";

// Fair growth multiplier for a call with true win probability p, holding a
// constant house edge regardless of which call type or deck state produced p.
export function growthFor(p) {
  if (!p || p <= 0) return 0;
  return (1 - HOUSE_EDGE) / p;
}
