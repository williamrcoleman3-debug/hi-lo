import { RANKS, PRICING_MODE } from "./constants.js";

// True live odds for each call type, based on the actual cards left in the shoe.
export function calcProbs(deck, curVal) {
  const N = deck.length;
  if (N === 0) return { pHigher: 0, pLower: 0, pSame: 0, pRed: 0, pBlack: 0, N: 0 };
  let higher = 0, lower = 0, same = 0, red = 0, black = 0;
  for (const c of deck) {
    if (c.rank.value > curVal) higher++;
    else if (c.rank.value < curVal) lower++;
    else same++;
    if (c.suit.color === "red") red++;
    else black++;
  }
  return { pHigher: higher / N, pLower: lower / N, pSame: same / N, pRed: red / N, pBlack: black / N, N };
}

// Odds as if the shoe were freshly reshuffled and full for this level, given
// only the rank/suit of the card currently in play — never the actual
// remaining deck. This is the number a player sees and is priced against;
// the gap between it and calcProbs (the real remaining odds) is the skill
// a counting player can exploit. Pure: depends only on the one card in hand
// and the level's composition (suits + deckCopies), not on deck/discard state.
export function calcBaselineProbs(compareCard, levelConfig) {
  const { suits, deckCopies } = levelConfig;
  const totalCards = suits.length * RANKS.length * deckCopies;
  let higher = 0, lower = 0, same = 0, red = 0, black = 0;

  for (const suit of suits) {
    for (const rank of RANKS) {
      if (rank.value > compareCard.rank.value) higher += deckCopies;
      else if (rank.value < compareCard.rank.value) lower += deckCopies;
      else same += deckCopies;
      if (suit.color === "red") red += deckCopies;
      else black += deckCopies;
    }
  }

  // The compare card itself is already in play, not sitting in the
  // hypothetical fresh shoe — remove exactly that one physical instance.
  same -= 1;
  if (compareCard.suit.color === "red") red -= 1;
  else black -= 1;

  const N = totalCards - 1;
  if (N <= 0) return { pHigher: 0, pLower: 0, pSame: 0, pRed: 0, pBlack: 0, N: 0 };
  return { pHigher: higher / N, pLower: lower / N, pSame: same / N, pRed: red / N, pBlack: black / N, N };
}

// Dispatches to the odds source that should drive display, payout, and
// button-disabling for the given pricing mode.
export function getActiveProbs(mode, { deck, compareCard, levelConfig }) {
  if (mode === PRICING_MODE.TRUE_LIVE_ODDS) return calcProbs(deck, compareCard.rank.value);
  return calcBaselineProbs(compareCard, levelConfig);
}

export function probForCall(probs, call) {
  switch (call) {
    case "higher": return probs.pHigher;
    case "lower": return probs.pLower;
    case "same": return probs.pSame;
    case "red": return probs.pRed;
    case "black": return probs.pBlack;
    default: return 0;
  }
}
