import { useCallback, useEffect, useRef, useState } from "react";
import { loadProgress, saveProgress, applyCorrectCall, selectLevel } from "../persistence/progress.js";
import { fetchCloudLevelProgress, recordLevelProgressRemote, migrateLocalProgressToCloud } from "../persistence/cloudProgress.js";
import { getLevel, computeUnlockedLevels } from "../engine/levels.js";

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
        if (cancelled) return;
        setProgress((p) => ({
          ...p,
          levelProgress: cloudLevelProgress,
          unlockedLevels: computeUnlockedLevels(cloudLevelProgress),
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

  return {
    selectedLevel: progress.selectedLevel,
    selectedLevelConfig: getLevel(progress.selectedLevel),
    unlockedLevels: progress.unlockedLevels,
    levelProgress: progress.levelProgress,
    recordCorrectCall,
    selectLevel: selectLevelById,
  };
}
