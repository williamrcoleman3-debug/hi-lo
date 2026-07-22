import { DECKS, ACTIVE_DECKS, DEFAULT_DECK_ID, computeUnlockedDecks } from "../engine/decks.js";
import { THEME_IDS } from "../themes/registry.js";

const STORAGE_KEY = "hilo:progress:v1";

function emptyDeckProgress() {
  return { bestWinStreak: 0, sameHit: false, redBlackHit: false, lowestOddsSameHit: null };
}

export function defaultProgress() {
  const deckProgress = {};
  for (const deck of DECKS) deckProgress[deck.id] = emptyDeckProgress();
  return {
    version: 1,
    selectedDeck: DEFAULT_DECK_ID,
    unlockedDecks: computeUnlockedDecks(deckProgress),
    deckProgress,
    equippedTheme: THEME_IDS.CLASSIC,
  };
}

export function loadProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultProgress();
    const parsed = JSON.parse(raw);
    if (parsed?.version !== 1) return defaultProgress();
    // Merge over defaults so progress saved before a field existed (e.g.
    // equippedTheme, added later) still loads with a sane value instead of
    // undefined, without needing a version bump for every additive field.
    return sanitizeSelectedDeck({ ...defaultProgress(), ...parsed });
  } catch {
    return defaultProgress();
  }
}

// A browser's saved selectedDeck can predate a deck being feature-flagged
// off (see engine/decks.js's ACTIVE_DECKS) — the merge above would
// otherwise let that stale value win over the current default, silently
// landing the player on a deck that's supposed to be unreachable, with no
// UI path back (DeckSwitcher hides itself once there's only one active
// deck). Snap back to DEFAULT_DECK_ID whenever the saved selection isn't
// currently active.
function sanitizeSelectedDeck(progress) {
  if (ACTIVE_DECKS.some((d) => d.id === progress.selectedDeck)) return progress;
  return { ...progress, selectedDeck: DEFAULT_DECK_ID };
}

export function saveProgress(progress) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

// Pure: folds the result of one correct call into progress, returning a new
// object. `winStreak` is the current game's win-streak count at this call
// (its all-time max IS "reached an N-hand win streak in a single game").
// `trueProbs` is the real live-deck odds at the moment of the call (see
// round.js#prepareCall) — only consulted for Same, to track the
// longest-shot hit ever landed.
export function applyCorrectCall(progress, deckId, call, { winStreak, trueProbs }) {
  const prev = progress.deckProgress[deckId];
  const next = {
    bestWinStreak: Math.max(prev.bestWinStreak, winStreak),
    sameHit: prev.sameHit || call === "same",
    redBlackHit: prev.redBlackHit || call === "red" || call === "black",
    lowestOddsSameHit:
      call === "same"
        ? prev.lowestOddsSameHit === null
          ? trueProbs.pSame
          : Math.min(prev.lowestOddsSameHit, trueProbs.pSame)
        : prev.lowestOddsSameHit,
  };
  const deckProgress = { ...progress.deckProgress, [deckId]: next };
  return { ...progress, deckProgress, unlockedDecks: computeUnlockedDecks(deckProgress) };
}

export function selectDeck(progress, deckId) {
  if (!progress.unlockedDecks.includes(deckId)) return progress;
  return { ...progress, selectedDeck: deckId };
}

// `unlockedThemeIds` is passed in rather than recomputed here, since it's
// derived from unlockedDecks (see themes/registry.js#computeUnlockedThemes)
// and the caller already has it.
export function selectTheme(progress, themeId, unlockedThemeIds) {
  if (!unlockedThemeIds.includes(themeId)) return progress;
  return { ...progress, equippedTheme: themeId };
}
