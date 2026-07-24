import { useCallback, useEffect, useRef, useState } from "react";
import { loadProgress, saveProgress, applyCorrectCall, selectDeck, selectGameMode } from "../persistence/progress.js";
import { fetchCloudDeckProgress, fetchGameMode, pushGameMode } from "../persistence/cloudProgress.js";
import { getDeck, computeUnlockedDecks } from "../engine/decks.js";

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
  // progress and game mode preference down. The cloud value always wins once
  // fetched -- no unlock-gating to reconcile, Bank/Speed has none.
  useEffect(() => {
    if (!userId || syncedForUser.current === userId) return;
    syncedForUser.current = userId;
    let cancelled = false;
    (async () => {
      try {
        const cloudDeckProgress = await fetchCloudDeckProgress(userId);
        const cloudGameMode = await fetchGameMode(userId);
        if (cancelled) return;

        const gameMode = cloudGameMode ?? "speed";

        setProgress((p) => ({
          ...p,
          deckProgress: cloudDeckProgress,
          unlockedDecks: computeUnlockedDecks(cloudDeckProgress),
          gameMode,
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

  const setGameMode = useCallback(
    (mode) => {
      setProgress((p) => selectGameMode(p, mode));
      if (userId) pushGameMode(userId, mode);
    },
    [userId]
  );

  return {
    selectedDeck: progress.selectedDeck,
    selectedDeckConfig: getDeck(progress.selectedDeck),
    unlockedDecks: progress.unlockedDecks,
    deckProgress: progress.deckProgress,
    gameMode: progress.gameMode,
    recordCorrectCall,
    refreshDeckProgress,
    selectDeck: selectDeckById,
    setGameMode,
  };
}
