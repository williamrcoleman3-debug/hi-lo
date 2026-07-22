import { useCallback, useEffect, useRef, useState } from "react";
import { loadProgress, saveProgress, applyCorrectCall, selectDeck, selectTheme } from "../persistence/progress.js";
import { fetchCloudDeckProgress, fetchEquippedTheme, pushEquippedTheme } from "../persistence/cloudProgress.js";
import { getDeck, computeUnlockedDecks } from "../engine/decks.js";
import { THEME_IDS, computeUnlockedThemes } from "../themes/registry.js";

// `userId` is null for anonymous play (localStorage only) or a signed-in
// user's id. Anonymous play tracks deckProgress/unlockedDecks purely
// locally via applyCorrectCall, same as always -- it never touches the
// server (see cloudProgress.js's header comment on why anonymous progress
// no longer migrates to a real account on sign-in). Signed-in play doesn't
// fold per-call state locally at all anymore: deck_progress is now server-
// authoritative, computed entirely from a game_sessions row at game-end
// (see supabase/schema.sql's finalize_session) -- refreshDeckProgress()
// below re-fetches it from the cloud after each game ends, rather than
// reconstructing it client-side.
export function useProgress(userId) {
  const [progress, setProgress] = useState(() => loadProgress());
  const syncedForUser = useRef(null);

  useEffect(() => {
    saveProgress(progress);
  }, [progress]);

  // On sign-in (once per user id): pull the authoritative cloud deck
  // progress and equipped theme down.
  useEffect(() => {
    if (!userId || syncedForUser.current === userId) return;
    syncedForUser.current = userId;
    let cancelled = false;
    (async () => {
      try {
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

  // Re-fetches deck_progress from the cloud and recomputes unlockedDecks --
  // called after a signed-in game finalizes (bust or bank), since that's
  // the only point at which best_win_streak/hands_won can have changed
  // server-side now.
  const refreshDeckProgress = useCallback(async () => {
    if (!userId) return;
    try {
      const cloudDeckProgress = await fetchCloudDeckProgress(userId);
      setProgress((p) => ({
        ...p,
        deckProgress: cloudDeckProgress,
        unlockedDecks: computeUnlockedDecks(cloudDeckProgress),
      }));
    } catch (err) {
      console.error("refreshDeckProgress failed:", err.message);
    }
  }, [userId]);

  // Anonymous-only: folds a correct call's result into local progress
  // immediately. Never called for signed-in play (see refreshDeckProgress).
  const recordCorrectCall = useCallback((deckId, call, meta) => {
    setProgress((p) => applyCorrectCall(p, deckId, call, meta));
  }, []);

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
    refreshDeckProgress,
    selectDeck: selectDeckById,
    setEquippedTheme,
  };
}
