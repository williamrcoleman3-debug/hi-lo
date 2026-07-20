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

export const BASE_POINTS = 100; // implicit ante for the first correct call of a run
export const TIMER_MS = 6000;
export const AUTO_ADVANCE_MS = 1300; // pause after a win — long enough to screenshot, then auto-continues
export const HOUSE_EDGE = 0.01; // 1% — applied uniformly to every call via true-odds pricing

// Illustrative-only reference curve, computed at the *average* optimal-call
// win rate (~72.4%) across all 13 ranks. Real payout is priced live per hand
// off the actual remaining deck — this is just a rough "what to expect" guide.
export const AVG_REFERENCE = [100, 37, 50, 69, 94, 128, 176, 240, 329, 449];
