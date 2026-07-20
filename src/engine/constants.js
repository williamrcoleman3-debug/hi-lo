export const SUITS = [
  { key: "spades", symbol: "♠", color: "mono" },
  { key: "clubs", symbol: "♣", color: "mono" },
  { key: "hearts", symbol: "♥", color: "red" },
  { key: "diamonds", symbol: "♦", color: "red" },
];

export const RANKS = [
  { key: "2", value: 2 }, { key: "3", value: 3 }, { key: "4", value: 4 },
  { key: "5", value: 5 }, { key: "6", value: 6 }, { key: "7", value: 7 },
  { key: "8", value: 8 }, { key: "9", value: 9 }, { key: "10", value: 10 },
  { key: "J", value: 11 }, { key: "Q", value: 12 }, { key: "K", value: 13 },
  { key: "A", value: 14 },
];

export const TIMER_MS = 6000;
export const AUTO_ADVANCE_MS = 1300; // pause after a win — long enough to screenshot, then auto-continues
export const HOUSE_EDGE = 0.01; // 1% — applied uniformly to every call via true-odds pricing

// Illustrative-only reference curve, computed at the *average* optimal-call
// win rate (~72.4%) across all 13 ranks, at a 100-point ante. Real payout is
// priced per hand off the level's static baseline odds — this is just a
// rough "what to expect" guide. Scale by (level.ante / 100) for other levels
// — ante scaling is confirmed proportional, so the curve scales with it.
export const AVG_REFERENCE = [100, 37, 50, 69, 94, 128, 176, 240, 329, 449];

// static-baseline: price every call off a fresh, full shoe for that rank —
// the gap between this price and the true remaining-deck odds is the skill
// (card counting). true-live-odds: price off the actual remaining deck, as
// in the original prototype — mathematically fair with no gap to exploit,
// which matters if this engine is ever licensed to an operator that wants
// to prevent advantage play instead of reward it.
export const PRICING_MODE = {
  STATIC_BASELINE: "static-baseline",
  TRUE_LIVE_ODDS: "true-live-odds",
};
export const DEFAULT_PRICING_MODE = PRICING_MODE.STATIC_BASELINE;
