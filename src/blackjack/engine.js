import { SUITS, freshDeck } from "../engine";

// Standard single 52-card shoe, reusing the already-verified Fisher-Yates
// shuffle from engine/deck.js rather than writing a second one. This game
// has no stakes and no fairness requirement to prove (see the header
// comment on useBlackjack.js), so the client-side Math.random shuffle used
// there is perfectly fine here too.
export function freshShoe() {
  return freshDeck({ suits: SUITS, deckCopies: 1 });
}

function cardPoints(card) {
  if (card.rank.key === "A") return 11;
  if (card.rank.key === "J" || card.rank.key === "Q" || card.rank.key === "K") return 10;
  return Number(card.rank.key);
}

// Standard scoring: Aces count as 11 until the hand would bust, then drop
// to 1 one at a time. `soft` is true only while at least one Ace is still
// being counted as 11.
export function handValue(cards) {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    total += cardPoints(c);
    if (c.rank.key === "A") aces += 1;
  }
  let softAces = aces;
  while (total > 21 && softAces > 0) {
    total -= 10;
    softAces -= 1;
  }
  return { total, soft: softAces > 0, busted: total > 21 };
}

export function isNatural(cards) {
  return cards.length === 2 && handValue(cards).total === 21;
}

// Stands on soft 17 -- the simpler, more common variant. Not configurable;
// this game has no per-table rule variations.
export function dealerShouldHit(cards) {
  return handValue(cards).total < 17;
}

// One hand vs. the dealer's final hand. Doesn't distinguish a natural from
// an ordinary 21 -- that distinction is only used at deal time (see
// useBlackjack.js) to end the round immediately, before any player action.
export function resolveHand(playerCards, dealerCards) {
  const p = handValue(playerCards);
  const d = handValue(dealerCards);
  if (p.busted) return "lose";
  if (d.busted) return "win";
  if (p.total > d.total) return "win";
  if (p.total < d.total) return "lose";
  return "push";
}

// Split only ever allowed on the starting two cards, and only when they're
// the exact same rank (the stricter, less permissive of the two common
// "same rank" vs. "same 10-value" rules).
export function canSplitPair(cards) {
  return cards.length === 2 && cards[0].rank.key === cards[1].rank.key;
}
