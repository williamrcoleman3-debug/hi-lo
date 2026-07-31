import { useCallback, useEffect, useRef, useState } from "react";
import { getActiveProbs, growthFor, TIMER_MS, AUTO_ADVANCE_MS, DEFAULT_PRICING_MODE } from "../engine";
import { MAX_LIFELINES_PER_GAME } from "../lifelines/lifelines.js";
import { startGame, makeServerCall, useLifelineInSession, bustSession, bankSession } from "../session/gameSession.js";
import { playClickTone, playWinTone, playLoseTone } from "../audio/sound.js";
import { hapticTap, hapticWin, hapticBust } from "../haptics/haptics.js";

const FLASH_MS = 180;
const SHAKE_MS = 180;
const WIN_POP_MS = 180;

// Server-authoritative counterpart to hooks/useGame.js, same return shape
// (see that file's header comment), used for signed-in play. The deck
// itself never exists here — only `cardsLeft` (a count) and `compareCard`
// (the one card the server has revealed). Every call, lifeline use, bust,
// and bank goes through a Supabase RPC (see src/session/gameSession.js)
// that owns the actual shoe; this hook only tracks what the server told it
// plus purely cosmetic pacing state (the timer, flashes/toasts) that has
// no bearing on the outcome. Results apply the instant the network
// response arrives -- no artificial delay layered on top of it (there used
// to be one; removed for speed, see the "feel instant" pass this hook was
// rewritten for).
//
// speedMode is captured into a ref at the moment each game starts (see
// speedModeRef below), not read live from the prop during an active game --
// this mirrors game_sessions.speed_mode on the server, which is fixed for
// a session's whole lifetime. Changing your Bank/Speed preference mid-game
// only affects the *next* game you start, never the one in progress.
//
// The displayed odds/payout multiplier (`probs`/`growths`) still uses the
// same client-side calcBaselineProbs/growthFor as the local engine — that
// formula only ever depends on the current compare card and the deck's
// public config (suits/copies), never the actual remaining deck, so there's
// no secret to protect and no need to round-trip to the server just to
// show a number. The server independently recomputes the same formula
// when it actually resolves a call, rather than trusting anything sent to it.
export function useServerGame(deckConfig, { onGameEnd, lifelineBalance = 0, speedMode = false } = {}) {
  const [sessionId, setSessionId] = useState(null);
  const [compareCard, setCompareCard] = useState(null);
  const [revealedCard, setRevealedCard] = useState(null);
  const [cardsLeft, setCardsLeft] = useState(0);
  const [winStreak, setWinStreak] = useState(0);
  const [banked, setBanked] = useState(0);
  const [totalTokens, setTotalTokens] = useState(0);
  const [status, setStatus] = useState("loading");
  const [awaitingAdvance, setAwaitingAdvance] = useState(false);
  const [message, setMessage] = useState("Dealing…");
  const [revealing, setRevealing] = useState(false);
  const [flash, setFlash] = useState(null);
  const [shake, setShake] = useState(false);
  const [justWon, setJustWon] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [timeLeft, setTimeLeft] = useState(TIMER_MS);
  const [lifelinesUsedThisGame, setLifelinesUsedThisGame] = useState(0);
  const [pendingBustCard, setPendingBustCard] = useState(null);
  // Matches speedModeRef's initializer below -- avoids a brief incorrect
  // value during the initial "Dealing…" loading state, before the first
  // startNewGame() call resolves and sets this properly.
  const [sessionSpeedMode, setSessionSpeedMode] = useState(() => speedMode);
  // Last 5 resolved hands, most recent first -- see useGame.js's matching
  // comment for why this reflects the call's correctness independent of a
  // later lifeline forgiving it.
  const [history, setHistory] = useState([]);

  const toastId = useRef(0);
  const intervalRef = useRef(null);
  const autoAdvanceRef = useRef(null);
  const isFirstDeckRender = useRef(true);
  const speedModeRef = useRef(speedMode);

  const decisionPaused = status !== "playing" || revealing || awaitingAdvance;
  const probs = compareCard
    ? getActiveProbs(DEFAULT_PRICING_MODE, { deck: [], compareCard, deckConfig })
    : { pHigher: 0, pLower: 0, pSame: 0, pRed: 0, pBlack: 0 };
  const growths = {
    higher: growthFor(probs.pHigher),
    lower: growthFor(probs.pLower),
    same: growthFor(probs.pSame),
    red: growthFor(probs.pRed),
    black: growthFor(probs.pBlack),
  };
  const lifelineAvailable = lifelineBalance > 0 && lifelinesUsedThisGame < MAX_LIFELINES_PER_GAME;

  const spawnToast = useCallback((text) => {
    const id = ++toastId.current;
    setToasts((t) => [...t, { id, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 900);
  }, []);

  const fireFlash = useCallback((type) => {
    setFlash(type);
    setTimeout(() => setFlash(null), FLASH_MS);
  }, []);

  const startNewGame = useCallback(async () => {
    setStatus("loading");
    setMessage("Dealing…");
    try {
      // Captured once per game, not read live -- see the header comment on
      // why this can't just reference the `speedMode` prop directly inside
      // makeCall below.
      speedModeRef.current = speedMode;
      const result = await startGame(deckConfig.id, speedMode);
      setSessionId(result.sessionId);
      setCompareCard(result.compareCard);
      setCardsLeft(result.cardsLeft);
      setRevealedCard(null);
      setWinStreak(0);
      setBanked(0);
      setStatus("playing");
      setAwaitingAdvance(false);
      setMessage("Call it before the clock runs out.");
      setShake(false);
      setLifelinesUsedThisGame(0);
      setPendingBustCard(null);
      setSessionSpeedMode(speedMode);
      setHistory([]);
    } catch (err) {
      console.error("startGame failed:", err.message);
      setMessage(
        err.message?.includes("daily play limit")
          ? "You've hit today's play limit (101 games). Come back after midnight UTC."
          : "Couldn't start a new game — try again."
      );
      setStatus("busted");
    }
  }, [deckConfig.id, speedMode]);

  // Switching decks abandons the current game (like letting the timer run
  // out) and deals a fresh shoe for the new deck. Skipped on mount --
  // startNewGame() below already covers the initial deal. Deliberately
  // keyed only on deckConfig.id, not speedMode -- changing your Bank/Speed
  // preference mid-game must never interrupt a game already in progress
  // (see the header comment on speedModeRef); it only takes effect the
  // next time startNewGame() is actually called.
  useEffect(() => {
    if (isFirstDeckRender.current) {
      isFirstDeckRender.current = false;
      startNewGame();
      return;
    }
    startNewGame();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deckConfig.id]);

  const finishGame = useCallback(
    async (finalizer, wasBanked, finalBanked) => {
      try {
        const result = await finalizer(sessionId);
        onGameEnd?.(deckConfig.id, { amount: finalBanked, wasBanked, isNewPeak: result.isNewPeak });
      } catch (err) {
        console.error("finalize session failed:", err.message);
      }
    },
    [sessionId, deckConfig, onGameEnd]
  );

  // Always finalizes server-side, even when nothing was ever banked (a
  // bust on the very first hand). The old local-engine hook skipped calling
  // the server entirely in that case (`if (banked > 0) onGameEnd?.(...)`),
  // which meant games_played/daily_activity/the referral first-game reward
  // never fired for an immediate first-hand bust -- silently undermining
  // the "any completed game, bust or bank" rule elsewhere in this app.
  // Finalizing unconditionally here fixes that.
  const resolveBust = useCallback(
    (reasonMsg, finalBanked) => {
      setStatus("busted");
      setMessage(reasonMsg);
      fireFlash("lose");
      setShake(true);
      setTimeout(() => setShake(false), SHAKE_MS);
      playLoseTone();
      hapticBust();
      finishGame(bustSession, false, finalBanked);
    },
    [fireFlash, finishGame]
  );

  useEffect(() => {
    if (decisionPaused) {
      clearInterval(intervalRef.current);
      return;
    }
    setTimeLeft(TIMER_MS);
    const start = Date.now();
    intervalRef.current = setInterval(() => {
      const left = TIMER_MS - (Date.now() - start);
      if (left <= 0) {
        clearInterval(intervalRef.current);
        setTimeLeft(0);
        resolveBust("Too slow — the window closed. Tokens lost.", banked);
      } else {
        setTimeLeft(left);
      }
    }, 50);
    return () => clearInterval(intervalRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compareCard, status, revealing, awaitingAdvance]);

  const cashOut = useCallback(() => {
    if (banked <= 0 || status !== "playing") return;
    clearTimeout(autoAdvanceRef.current);
    setTotalTokens((t) => t + banked);
    setStatus("cashed");
    setMessage(`Banked ${banked.toLocaleString()} points. Locked in for good.`);
    fireFlash("win");
    finishGame(bankSession, true, banked);
  }, [banked, status, fireFlash, finishGame]);

  const makeCall = useCallback(
    (call) => {
      if (status !== "playing" || revealing || awaitingAdvance || !sessionId) return;

      playClickTone();
      hapticTap();
      setRevealing(true);

      (async () => {
        try {
          const result = await makeServerCall(sessionId, call);
          // Applied the instant the network response arrives -- no
          // artificial pre-delay. `revealing` (which gates input) drops
          // in this same synchronous block too, so the only thing that
          // ever blocked the next guess was the network round trip itself.
          setRevealedCard(result.drawnCard);
          setCardsLeft(result.cardsLeft);
          setHistory((h) => [{ card: result.drawnCard, correct: result.correct }, ...h].slice(0, 5));

          if (result.correct) {
            setWinStreak(result.winStreak);
            setBanked(result.banked);
            setJustWon(true);
            setTimeout(() => setJustWon(false), WIN_POP_MS);
            spawnToast(`+${result.gain.toLocaleString()}`);
            fireFlash("win");
            playWinTone();
            hapticWin();

            if (result.status === "cashed") {
              // The server already auto-finalized this session as a win --
              // either a lifeline-used game or a Speed Mode game that just
              // cleared the full deck (see make_call's full-clear check).
              // Voluntary banking isn't available in either case, so this
              // is the only way that payout could ever be collected.
              // Nothing left to call here -- reflect the result directly,
              // don't fire bankSession() again (nothing left to finalize).
              setTotalTokens((t) => t + result.banked);
              setStatus("cashed");
              setMessage(`Cleared the deck! Banked ${result.banked.toLocaleString()} points.`);
              onGameEnd?.(deckConfig.id, { amount: result.banked, wasBanked: true, isNewPeak: result.isNewPeak });
            } else if (speedModeRef.current) {
              // Speed Mode: the just-revealed card becomes the new compare
              // card immediately -- same effect as advanceHand() below,
              // just automatic instead of gated behind a tap or timer. The
              // win-pop plays on the card as pure decoration; nothing
              // waits on it.
              setCompareCard(result.drawnCard);
              setRevealedCard(null);
              setMessage("Call it before the clock runs out.");
            } else {
              setAwaitingAdvance(true);
              setMessage(
                call === "same"
                  ? `Same rank! +${result.gain.toLocaleString()} tokens. Tap to keep going.`
                  : call === "red" || call === "black"
                  ? `${call === "red" ? "Red" : "Black"}! +${result.gain.toLocaleString()} tokens. Tap to keep going.`
                  : `Correct — win streak ${result.winStreak}. +${result.gain.toLocaleString()} tokens. Tap to keep going.`
              );
            }
          } else if (lifelineAvailable) {
            setPendingBustCard(result.drawnCard);
            setStatus("lifeline-offer");
            setMessage(
              `Wrong — drew ${result.drawnCard.rank.key}${result.drawnCard.suit.symbol}. Use a Save the Game lifeline to keep your ${winStreak}-hand streak alive?`
            );
          } else {
            // Not eligible for a lifeline (none left, or already used the
            // per-game cap) -- the server already parked the session in
            // 'lifeline-offer', so finalize it as a bust right away
            // rather than showing an offer the player can't act on.
            resolveBust(`Busted on ${result.drawnCard.rank.key}${result.drawnCard.suit.symbol}. Lost ${banked.toLocaleString()} tokens.`, banked);
          }
          setRevealing(false);
        } catch (err) {
          console.error("makeCall failed:", err.message);
          setRevealing(false);
          setMessage("Something went wrong — try again.");
        }
      })();
    },
    [status, revealing, awaitingAdvance, sessionId, lifelineAvailable, winStreak, banked, spawnToast, fireFlash, resolveBust, deckConfig, onGameEnd]
  );

  const useLifeline = useCallback(async () => {
    if (status !== "lifeline-offer" || !pendingBustCard || !sessionId) return;
    try {
      const result = await useLifelineInSession(sessionId);
      if (result.success) {
        setLifelinesUsedThisGame((n) => n + 1);
        setCompareCard(result.compareCard);
        setRevealedCard(null);
        setPendingBustCard(null);
        setStatus("playing");
        setMessage("Call it before the clock runs out.");
      } else {
        const card = pendingBustCard;
        setPendingBustCard(null);
        resolveBust(`Busted on ${card.rank.key}${card.suit.symbol}. Lost ${banked.toLocaleString()} tokens.`, banked);
      }
    } catch (err) {
      console.error("useLifeline failed:", err.message);
      const card = pendingBustCard;
      setPendingBustCard(null);
      resolveBust(`Busted on ${card.rank.key}${card.suit.symbol}. Lost ${banked.toLocaleString()} tokens.`, banked);
    }
  }, [status, pendingBustCard, sessionId, banked, resolveBust]);

  const declineLifeline = useCallback(() => {
    if (status !== "lifeline-offer" || !pendingBustCard) return;
    const card = pendingBustCard;
    setPendingBustCard(null);
    resolveBust(`Busted on ${card.rank.key}${card.suit.symbol}. Lost ${banked.toLocaleString()} tokens.`, banked);
  }, [status, pendingBustCard, banked, resolveBust]);

  const advanceHand = useCallback(() => {
    if (!awaitingAdvance || !revealedCard) return;
    clearTimeout(autoAdvanceRef.current);
    setCompareCard(revealedCard);
    setRevealedCard(null);
    setAwaitingAdvance(false);
    setMessage("Call it before the clock runs out.");
  }, [awaitingAdvance, revealedCard]);

  useEffect(() => {
    if (!awaitingAdvance) return;
    autoAdvanceRef.current = setTimeout(() => {
      advanceHand();
    }, AUTO_ADVANCE_MS);
    return () => clearTimeout(autoAdvanceRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [awaitingAdvance]);

  return {
    cardsLeft,
    compareCard,
    revealedCard,
    winStreak,
    banked,
    totalTokens,
    status,
    awaitingAdvance,
    message,
    revealing,
    flash,
    shake,
    justWon,
    toasts,
    timeLeft,
    probs,
    growths,
    lifelinesUsedThisGame,
    sessionSpeedMode,
    history,
    makeCall,
    advanceHand,
    cashOut,
    startNewGame,
    useLifeline,
    declineLifeline,
  };
}
