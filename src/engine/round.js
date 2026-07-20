import { calcProbs, probForCall } from "./odds.js";
import { growthFor } from "./payout.js";
import { reshuffleExcluding } from "./deck.js";
import { BASE_POINTS } from "./constants.js";

// Prices and draws a call off the true remaining deck. Reshuffles the shoe
// first if it's been exhausted. Returns null if the call is mathematically
// impossible (p <= 0) — callers should already disable that control, this is
// the authoritative guard.
export function prepareCall(deck, compareCard, call) {
  const workingDeck = deck.length === 0 ? reshuffleExcluding(compareCard) : deck;

  // Price this exact call off the real remaining deck, before anything is drawn.
  const probs = calcProbs(workingDeck, compareCard.rank.value);
  const p = probForCall(probs, call);
  if (p <= 0) return null;

  const growth = growthFor(p);
  const drawn = workingDeck[0];
  const rest = workingDeck.slice(1);

  return { workingDeck, probs, p, growth, drawn, rest };
}

export function isCorrectCall(call, compareCard, drawnCard) {
  const cur = compareCard.rank.value;
  const nxt = drawnCard.rank.value;
  switch (call) {
    case "same": return nxt === cur;
    case "higher": return nxt > cur;
    case "lower": return nxt < cur;
    case "red": return drawnCard.suit.color === "red";
    case "black": return drawnCard.suit.color === "mono";
    default: return false;
  }
}

// Applies a win: stakes the current bank (or the base ante if this is the
// first correct call of the run) and grows it by the priced multiplier.
export function applyWin(banked, growth) {
  const stake = banked > 0 ? banked : BASE_POINTS;
  const newBanked = Math.round(stake * growth);
  return { newBanked, gain: newBanked - banked };
}
