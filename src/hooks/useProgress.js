import { useCallback, useEffect, useRef, useState } from "react";
import { loadProgress, saveProgress, applyCorrectCall, selectLevel, selectTheme } from "../persistence/progress.js";
import {
  fetchCloudLevelProgress,
  recordLevelProgressRemote,
  migrateLocalProgressToCloud,
  fetchEquippedTheme,
  pushEquippedTheme,
} from "../persistence/cloudProgress.js";
import { getLevel, computeUnlockedLevels } from "../engine/levels.js";
import { THEME_IDS, computeUnlockedThemes } from "../themes/registry.js";

// `userId` is null for anonymous play (localStorage only, as in Phase 2) or
// a signed-in user's id (localStorage stays the always-on optimistic cache,
// with a best-effort background sync to Supabase layered on top — see
// persistence/cloudProgress.js).
export function useProgress(userId) {
  const [progress, setProgress] = useState(() => loadProgress());
  const migratedForUser = useRef(null);

  useEffect(() => {
    saveProgress(progress);
  }, [progress]);

  // On sign-in (once per user id): push any anonymous local progress up to
  // Supabase, then pull the merged, authoritative cloud state back down —
  // this is what makes progress follow the player across devices.
  useEffect(() => {
    if (!userId || migratedForUser.current === userId) return;
    migratedForUser.current = userId;
    let cancelled = false;
    (async () => {
      try {
        await migrateLocalProgressToCloud(progress.levelProgress);
        const cloudLevelProgress = await fetchCloudLevelProgress(userId);
        const cloudEquippedTheme = await fetchEquippedTheme(userId);
        if (cancelled) return;

        // The cloud's last-known equipped theme wins (it may reflect another
        // device) — unless this is a fresh profile still on the default and
        // the player had equipped something else anonymously, in which case
        // that anonymous choice is what gets pushed up.
        let equippedTheme = cloudEquippedTheme ?? THEME_IDS.CLASSIC;
        if (progress.equippedTheme !== THEME_IDS.CLASSIC && cloudEquippedTheme === THEME_IDS.CLASSIC) {
          equippedTheme = progress.equippedTheme;
          await pushEquippedTheme(userId, equippedTheme);
        }

        setProgress((p) => ({
          ...p,
          levelProgress: cloudLevelProgress,
          unlockedLevels: computeUnlockedLevels(cloudLevelProgress),
          equippedTheme,
        }));
      } catch (err) {
        console.error("Cloud progress sync failed, staying on local progress:", err.message);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const recordCorrectCall = useCallback(
    (levelId, call, meta) => {
      setProgress((p) => applyCorrectCall(p, levelId, call, meta));
      if (userId) {
        recordLevelProgressRemote(levelId, {
          streak: meta.streak,
          sameHit: call === "same",
          redBlackHit: call === "red" || call === "black",
          sameOdds: call === "same" ? meta.trueProbs.pSame : undefined,
        });
      }
    },
    [userId]
  );

  const selectLevelById = useCallback((levelId) => {
    setProgress((p) => selectLevel(p, levelId));
  }, []);

  const setEquippedTheme = useCallback(
    (themeId) => {
      setProgress((p) => selectTheme(p, themeId, computeUnlockedThemes({ unlockedLevels: p.unlockedLevels })));
      if (userId && computeUnlockedThemes({ unlockedLevels: progress.unlockedLevels }).includes(themeId)) {
        pushEquippedTheme(userId, themeId);
      }
    },
    [userId, progress.unlockedLevels]
  );

  return {
    selectedLevel: progress.selectedLevel,
    selectedLevelConfig: getLevel(progress.selectedLevel),
    unlockedLevels: progress.unlockedLevels,
    levelProgress: progress.levelProgress,
    equippedTheme: progress.equippedTheme,
    unlockedThemeIds: computeUnlockedThemes({ unlockedLevels: progress.unlockedLevels }),
    recordCorrectCall,
    selectLevel: selectLevelById,
    setEquippedTheme,
  };
}
