import { SUITS } from "./constants.js";

const [SPADES, , HEARTS] = SUITS; // spades (mono), hearts (red) — one of each color for Level 2

export const STREAK_UNLOCK_TARGET = 10;
// Level 4 unlock requires a Same hit at REAL odds under this, at Level 3.
export const LONGSHOT_SAME_THRESHOLD = 0.15;

export const LEVELS = [
  { id: "single-suit", name: "Single Suit", suits: [SPADES], deckCopies: 1, ante: 100 },
  { id: "double-suit", name: "Double Suit", suits: [SPADES, HEARTS], deckCopies: 1, ante: 200 },
  { id: "full-deck", name: "Full Deck", suits: SUITS, deckCopies: 1, ante: 400 },
  { id: "double-deck", name: "Double Deck", suits: SUITS, deckCopies: 2, ante: 800 },
];

export const DEFAULT_LEVEL_ID = "single-suit";

export function getLevel(id) {
  return LEVELS.find((l) => l.id === id) ?? LEVELS[0];
}

// What it takes to unlock a level, evaluated against the PRECEDING level's
// progress record — human-readable text doubles as the locked-state copy.
export const UNLOCK_REQUIREMENTS = {
  "double-suit": {
    description: `Reach a ${STREAK_UNLOCK_TARGET}-call streak on Single Suit`,
    isMet: (prev) => prev.bestStreak >= STREAK_UNLOCK_TARGET,
  },
  "full-deck": {
    description: `Reach a ${STREAK_UNLOCK_TARGET}-call streak on Double Suit, having called Same and Red/Black correctly at least once each`,
    isMet: (prev) => prev.bestStreak >= STREAK_UNLOCK_TARGET && prev.sameHit && prev.redBlackHit,
  },
  "double-deck": {
    description: `Reach a ${STREAK_UNLOCK_TARGET}-call streak on Full Deck, with a Same hit at real odds under ${Math.round(LONGSHOT_SAME_THRESHOLD * 100)}%`,
    isMet: (prev) =>
      prev.bestStreak >= STREAK_UNLOCK_TARGET &&
      prev.lowestOddsSameHit !== null &&
      prev.lowestOddsSameHit < LONGSHOT_SAME_THRESHOLD,
  },
};

// Progression is linear: level N+1 can only unlock once level N is unlocked
// and its requirement is met. Returns the ids unlocked given the full
// per-level progress map (see persistence/progress.js for its shape).
export function computeUnlockedLevels(levelProgress) {
  const unlocked = [LEVELS[0].id];
  for (let i = 1; i < LEVELS.length; i++) {
    const level = LEVELS[i];
    const prevLevel = LEVELS[i - 1];
    if (UNLOCK_REQUIREMENTS[level.id].isMet(levelProgress[prevLevel.id])) {
      unlocked.push(level.id);
    } else {
      break;
    }
  }
  return unlocked;
}
