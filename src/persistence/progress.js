import { LEVELS, DEFAULT_LEVEL_ID, computeUnlockedLevels } from "../engine/levels.js";

const STORAGE_KEY = "hilo:progress:v1";

function emptyLevelProgress() {
  return { bestStreak: 0, sameHit: false, redBlackHit: false, lowestOddsSameHit: null };
}

export function defaultProgress() {
  const levelProgress = {};
  for (const level of LEVELS) levelProgress[level.id] = emptyLevelProgress();
  return {
    version: 1,
    selectedLevel: DEFAULT_LEVEL_ID,
    unlockedLevels: computeUnlockedLevels(levelProgress),
    levelProgress,
  };
}

export function loadProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultProgress();
    const parsed = JSON.parse(raw);
    if (parsed?.version !== 1) return defaultProgress();
    return parsed;
  } catch {
    return defaultProgress();
  }
}

export function saveProgress(progress) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

// Pure: folds the result of one correct call into progress, returning a new
// object. `streak` is the current run's streak count at this call (its
// all-time max IS "reached an N-streak in a single run"). `trueProbs` is the
// real live-deck odds at the moment of the call (see round.js#prepareCall) —
// only consulted for Same, to track the longest-shot hit ever landed.
export function applyCorrectCall(progress, levelId, call, { streak, trueProbs }) {
  const prev = progress.levelProgress[levelId];
  const next = {
    bestStreak: Math.max(prev.bestStreak, streak),
    sameHit: prev.sameHit || call === "same",
    redBlackHit: prev.redBlackHit || call === "red" || call === "black",
    lowestOddsSameHit:
      call === "same"
        ? prev.lowestOddsSameHit === null
          ? trueProbs.pSame
          : Math.min(prev.lowestOddsSameHit, trueProbs.pSame)
        : prev.lowestOddsSameHit,
  };
  const levelProgress = { ...progress.levelProgress, [levelId]: next };
  return { ...progress, levelProgress, unlockedLevels: computeUnlockedLevels(levelProgress) };
}

export function selectLevel(progress, levelId) {
  if (!progress.unlockedLevels.includes(levelId)) return progress;
  return { ...progress, selectedLevel: levelId };
}
