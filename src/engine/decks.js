import { SUITS } from "./constants.js";

const [SPADES, , HEARTS] = SUITS; // spades (mono), hearts (red) — one of each color for Double Suit

export const WIN_STREAK_UNLOCK_TARGET = 10;

// `enabled: false` feature-flags a deck off — hidden/unreachable in the
// current build, but its config, unlock-gate logic, and ante scaling all
// stay intact so it can be switched back on later with no other code
// changes. Only Single Deck is active right now (see ACTIVE_DECKS below,
// which everything UI-facing should read instead of this full list).
export const DECKS = [
  { id: "single-suit", name: "Single Suit", suits: [SPADES], deckCopies: 1, ante: 100, enabled: false },
  { id: "double-suit", name: "Double Suit", suits: [SPADES, HEARTS], deckCopies: 1, ante: 200, enabled: false },
  { id: "single-deck", name: "Single Deck", suits: SUITS, deckCopies: 1, ante: 400, enabled: true },
  { id: "double-deck", name: "Double Deck", suits: SUITS, deckCopies: 2, ante: 800, enabled: false },
];

// The decks actually reachable in the current build. UI (deck switchers,
// leaderboard deck-selectors, stats breakdowns) should read this, not
// DECKS directly — DECKS stays the full roster so hidden decks' configs
// and progress-tracking shape are never lost, just not surfaced.
export const ACTIVE_DECKS = DECKS.filter((d) => d.enabled);

export const DEFAULT_DECK_ID = ACTIVE_DECKS[0].id;

export function getDeck(id) {
  return DECKS.find((d) => d.id === id) ?? DECKS[0];
}

// What it takes to unlock a deck, evaluated against the PRECEDING deck's
// progress record — human-readable text doubles as the locked-state copy.
// Flat and uniform across every tier: a 10-hand Win Streak on the current
// deck, nothing else — no Same/Red-Black/odds conditions.
function makeFlatRequirement(prevDeckName) {
  return {
    description: `Reach a ${WIN_STREAK_UNLOCK_TARGET}-hand win streak on ${prevDeckName}`,
    isMet: (prev) => prev.bestWinStreak >= WIN_STREAK_UNLOCK_TARGET,
  };
}

export const UNLOCK_REQUIREMENTS = {
  "double-suit": makeFlatRequirement("Single Suit"),
  "single-deck": makeFlatRequirement("Double Suit"),
  "double-deck": makeFlatRequirement("Single Deck"),
};

// Progression is linear: deck N+1 can only unlock once deck N is unlocked
// and its requirement is met. Returns the ids unlocked given the full
// per-deck progress map (see persistence/progress.js for its shape).
// Operates over ACTIVE_DECKS only — with a single active deck this loop
// never runs, so that deck is unlocked from the start with no requirement,
// which is exactly what falls out of the algorithm rather than a special
// case bolted on. Re-enabling more decks later automatically restores
// progression through them, no changes needed here.
export function computeUnlockedDecks(deckProgress) {
  const unlocked = [ACTIVE_DECKS[0].id];
  for (let i = 1; i < ACTIVE_DECKS.length; i++) {
    const deck = ACTIVE_DECKS[i];
    const prevDeck = ACTIVE_DECKS[i - 1];
    if (UNLOCK_REQUIREMENTS[deck.id].isMet(deckProgress[prevDeck.id])) {
      unlocked.push(deck.id);
    } else {
      break;
    }
  }
  return unlocked;
}
