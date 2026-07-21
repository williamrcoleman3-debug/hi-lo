import { SUITS } from "./constants.js";

const [SPADES, , HEARTS] = SUITS; // spades (mono), hearts (red) — one of each color for Double Suit

export const WIN_STREAK_UNLOCK_TARGET = 10;
// Double Deck unlock requires a Same hit at REAL odds under this, at Single Deck.
export const LONGSHOT_SAME_THRESHOLD = 0.15;

export const DECKS = [
  { id: "single-suit", name: "Single Suit", suits: [SPADES], deckCopies: 1, ante: 100 },
  { id: "double-suit", name: "Double Suit", suits: [SPADES, HEARTS], deckCopies: 1, ante: 200 },
  { id: "single-deck", name: "Single Deck", suits: SUITS, deckCopies: 1, ante: 400 },
  { id: "double-deck", name: "Double Deck", suits: SUITS, deckCopies: 2, ante: 800 },
];

export const DEFAULT_DECK_ID = "single-suit";

export function getDeck(id) {
  return DECKS.find((d) => d.id === id) ?? DECKS[0];
}

// What it takes to unlock a deck, evaluated against the PRECEDING deck's
// progress record — human-readable text doubles as the locked-state copy.
export const UNLOCK_REQUIREMENTS = {
  "double-suit": {
    description: `Reach a ${WIN_STREAK_UNLOCK_TARGET}-hand win streak on Single Suit`,
    isMet: (prev) => prev.bestWinStreak >= WIN_STREAK_UNLOCK_TARGET,
  },
  "single-deck": {
    description: `Reach a ${WIN_STREAK_UNLOCK_TARGET}-hand win streak on Double Suit, having called Same and Red/Black correctly at least once each`,
    isMet: (prev) => prev.bestWinStreak >= WIN_STREAK_UNLOCK_TARGET && prev.sameHit && prev.redBlackHit,
  },
  "double-deck": {
    description: `Reach a ${WIN_STREAK_UNLOCK_TARGET}-hand win streak on Single Deck, with a Same hit at real odds under ${Math.round(LONGSHOT_SAME_THRESHOLD * 100)}%`,
    isMet: (prev) =>
      prev.bestWinStreak >= WIN_STREAK_UNLOCK_TARGET &&
      prev.lowestOddsSameHit !== null &&
      prev.lowestOddsSameHit < LONGSHOT_SAME_THRESHOLD,
  },
};

// Progression is linear: deck N+1 can only unlock once deck N is unlocked
// and its requirement is met. Returns the ids unlocked given the full
// per-deck progress map (see persistence/progress.js for its shape).
export function computeUnlockedDecks(deckProgress) {
  const unlocked = [DECKS[0].id];
  for (let i = 1; i < DECKS.length; i++) {
    const deck = DECKS[i];
    const prevDeck = DECKS[i - 1];
    if (UNLOCK_REQUIREMENTS[deck.id].isMet(deckProgress[prevDeck.id])) {
      unlocked.push(deck.id);
    } else {
      break;
    }
  }
  return unlocked;
}
