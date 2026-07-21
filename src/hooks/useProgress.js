import { useCallback, useEffect, useRef, useState } from "react";
import { loadProgress, saveProgress, applyCorrectCall, selectDeck, selectTheme } from "../persistence/progress.js";
import {
  fetchCloudDeckProgress,
  recordDeckProgressRemote,
  migrateLocalProgressToCloud,
  fetchEquippedTheme,
  pushEquippedTheme,
} from "../persistence/cloudProgress.js";
import { getDeck, computeUnlockedDecks } from "../engine/decks.js";
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
        await migrateLocalProgressToCloud(progress.deckProgress);
        const cloudDeckProgress = await fetchCloudDeckProgress(userId);
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
          deckProgress: cloudDeckProgress,
          unlockedDecks: computeUnlockedDecks(cloudDeckProgress),
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
    (deckId, call, meta) => {
      setProgress((p) => applyCorrectCall(p, deckId, call, meta));
      if (userId) {
        recordDeckProgressRemote(deckId, {
          winStreak: meta.winStreak,
          sameHit: call === "same",
          redBlackHit: call === "red" || call === "black",
          sameOdds: call === "same" ? meta.trueProbs.pSame : undefined,
        });
      }
    },
    [userId]
  );

  const selectDeckById = useCallback((deckId) => {
    setProgress((p) => selectDeck(p, deckId));
  }, []);

  const setEquippedTheme = useCallback(
    (themeId) => {
      setProgress((p) => selectTheme(p, themeId, computeUnlockedThemes({ unlockedDecks: p.unlockedDecks })));
      if (userId && computeUnlockedThemes({ unlockedDecks: progress.unlockedDecks }).includes(themeId)) {
        pushEquippedTheme(userId, themeId);
      }
    },
    [userId, progress.unlockedDecks]
  );

  return {
    selectedDeck: progress.selectedDeck,
    selectedDeckConfig: getDeck(progress.selectedDeck),
    unlockedDecks: progress.unlockedDecks,
    deckProgress: progress.deckProgress,
    equippedTheme: progress.equippedTheme,
    unlockedThemeIds: computeUnlockedThemes({ unlockedDecks: progress.unlockedDecks }),
    recordCorrectCall,
    selectDeck: selectDeckById,
    setEquippedTheme,
  };
}
