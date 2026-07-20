import { HOUSE_EDGE } from "./constants.js";

// Fair growth multiplier for a call with true win probability p, holding a
// constant house edge regardless of which call type or deck state produced p.
export function growthFor(p) {
  if (!p || p <= 0) return 0;
  return (1 - HOUSE_EDGE) / p;
}
