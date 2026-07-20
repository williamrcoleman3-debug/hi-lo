import { calcProbs, getActiveProbs, probForCall } from "./odds.js";
import { growthFor } from "./payout.js";
import { reshuffleExcluding } from "./deck.js";
import { DEFAULT_PRICING_MODE } from "./constants.js";

// Prices and draws a call off whichever odds source the pricing mode
// selects (see getActiveProbs) — that same source also gates whether the
// call is even allowed. Reshuffles the shoe first if it's been exhausted.
// Returns null if the priced call is impossible (p <= 0) — callers should
// already disable that control, this is the authoritative guard.
//
// Also returns trueProbs — the REAL live-deck odds, computed regardless of
// pricing mode. Never shown to the player; it exists only so callers can
// check ground-truth achievement conditions (e.g. a long-shot Same hit)
// even when the displayed price is the static baseline.
export function prepareCall(deck, compareCard, call, options) {
  const { levelConfig, mode = DEFAULT_PRICING_MODE } = options;
  const workingDeck = deck.length === 0 ? reshuffleExcluding(compareCard, levelConfig) : deck;

  const probs = getActiveProbs(mode, { deck: workingDeck, compareCard, levelConfig });
  const p = probForCall(probs, call);
  if (p <= 0) return null;

  const trueProbs = calcProbs(workingDeck, compareCard.rank.value);
  const growth = growthFor(p);
  const drawn = workingDeck[0];
  const rest = workingDeck.slice(1);

  return { workingDeck, probs, trueProbs, p, growth, drawn, rest };
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

// Applies a win: stakes the current bank (or the level's ante if this is
// the first correct call of the run) and grows it by the priced multiplier.
export function applyWin(banked, growth, ante) {
  const stake = banked > 0 ? banked : ante;
  const newBanked = Math.round(stake * growth);
  return { newBanked, gain: newBanked - banked };
}
