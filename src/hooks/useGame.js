import { useCallback, useEffect, useRef, useState } from "react";
import {
  freshDeck,
  getActiveProbs,
  growthFor,
  prepareCall,
  isCorrectCall,
  applyWin,
  TIMER_MS,
  AUTO_ADVANCE_MS,
  DEFAULT_PRICING_MODE,
  RANKS,
} from "../engine";
import { MAX_LIFELINES_PER_GAME } from "../lifelines/lifelines.js";
import { playClickTone, playWinTone, playLoseTone } from "../audio/sound.js";

const FLASH_MS = 180;
const SHAKE_MS = 180;
const WIN_POP_MS = 180;

// Mirrors supabase/schema.sql's full_clear_target() -- suits x 13 ranks x
// copies, minus 1 (the very first card is already in play as the starting
// compare card, never drawn as a "call"). Anonymous play has no server to
// enforce this, but the math has to match or a Speed Mode full clear here
// would never trigger at the same point the server-authoritative version
// does.
function fullClearTarget(deckConfig) {
  return deckConfig.suits.length * RANKS.length * deckConfig.deckCopies - 1;
}

// `deckConfig` is a deck config from engine/decks.js ({ id, suits, deckCopies, ante, ... }).
// `onCorrectCall(deckId, call, { winStreak, trueProbs })` fires after every
// correct call (hand), before the next hand — lets a progress tracker record
// achievements live, without this hook knowing anything about persistence.
// `onGameEnd(deckId, { amount, wasBanked })` fires once a game is over, via
// either an actual Bank or a Bust — `amount` is just whatever `banked`
// equals at that moment, since it only ever grows before a game's terminal
// event. Skipped entirely when amount is 0 (nothing worth recording).
// `lifelineBalance` (account-wide, from the caller's profile) and
// `onUseLifeline` (async () => Promise<{ success }>, spends one from the
// account) together gate the in-game "Save the Game" offer — the per-game
// cap of 2 is tracked here, separately from the persistent account balance.
//
// `speedMode` -- see useServerGame.js's header comment for the full
// rationale (this hook mirrors that one closely, just without a server).
// Captured into speedModeRef at the start of each game, not read live, so
// changing the preference mid-game never affects the game in progress.
// Speed Mode here means: no win-pause (advance instantly), no voluntary
// banking (cashOut is only ever called from the UI when the Bank button is
// shown, which GameScreenView hides for Speed Mode -- but a Speed Mode
// full clear still needs some way to actually collect the payout, so that
// case auto-finalizes here exactly like the lifelines_used > 0 case
// already did, mirroring make_call's server-side equivalent).
export function useGame(deckConfig, { onCorrectCall, onGameEnd, lifelineBalance = 0, onUseLifeline, speedMode = false } = {}) {
  const buildGame = useCallback(() => {
    const d = freshDeck(deckConfig);
    return { deck: d.slice(1), compareCard: d[0] };
  }, [deckConfig]);

  const [deck, setDeck] = useState(() => buildGame().deck);
  const [compareCard, setCompareCard] = useState(() => buildGame().compareCard);
  const [revealedCard, setRevealedCard] = useState(null);
  const [winStreak, setWinStreak] = useState(0);
  const [banked, setBanked] = useState(0);
  const [totalTokens, setTotalTokens] = useState(0);
  const [status, setStatus] = useState("playing");
  const [awaitingAdvance, setAwaitingAdvance] = useState(false);
  const [message, setMessage] = useState("Call it before the clock runs out.");
  const [revealing, setRevealing] = useState(false);
  const [flash, setFlash] = useState(null);
  const [shake, setShake] = useState(false);
  const [justWon, setJustWon] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [timeLeft, setTimeLeft] = useState(TIMER_MS);
  const [lifelinesUsedThisGame, setLifelinesUsedThisGame] = useState(0);
  const [pendingBustCard, setPendingBustCard] = useState(null);
  const [sessionSpeedMode, setSessionSpeedMode] = useState(false);
  // Last 5 resolved hands, most recent first -- reflects whether the call
  // itself was right or wrong, independent of a lifeline later forgiving a
  // wrong one (the guess was still factually wrong). Reset each new game.
  const [history, setHistory] = useState([]);

  const toastId = useRef(0);
  const intervalRef = useRef(null);
  const autoAdvanceRef = useRef(null);
  const isFirstDeckRender = useRef(true);
  const speedModeRef = useRef(speedMode);

  const decisionPaused = status !== "playing" || revealing || awaitingAdvance;
  const probs = getActiveProbs(DEFAULT_PRICING_MODE, { deck, compareCard, deckConfig });
  const growths = {
    higher: growthFor(probs.pHigher),
    lower: growthFor(probs.pLower),
    same: growthFor(probs.pSame),
    red: growthFor(probs.pRed),
    black: growthFor(probs.pBlack),
  };
  const lifelineAvailable = lifelineBalance > 0 && lifelinesUsedThisGame < MAX_LIFELINES_PER_GAME && !!onUseLifeline;

  const spawnToast = useCallback((text) => {
    const id = ++toastId.current;
    setToasts((t) => [...t, { id, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 900);
  }, []);

  const fireFlash = useCallback((type) => {
    setFlash(type);
    setTimeout(() => setFlash(null), FLASH_MS);
  }, []);

  const resolveBust = useCallback(
    (reasonMsg) => {
      setStatus("busted");
      setMessage(reasonMsg);
      fireFlash("lose");
      setShake(true);
      setTimeout(() => setShake(false), SHAKE_MS);
      playLoseTone();
      if (banked > 0) onGameEnd?.(deckConfig.id, { amount: banked, wasBanked: false });
    },
    [fireFlash, banked, deckConfig, onGameEnd]
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
        resolveBust("Too slow — the window closed. Tokens lost.");
      } else {
        setTimeLeft(left);
      }
    }, 50);
    return () => clearInterval(intervalRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compareCard, status, revealing, awaitingAdvance]);

  const startNewGame = useCallback(() => {
    speedModeRef.current = speedMode;
    const { deck: d, compareCard: c } = buildGame();
    setDeck(d);
    setCompareCard(c);
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
  }, [buildGame, speedMode]);

  // Switching decks abandons the current game (like letting the timer run
  // out) and deals a fresh shoe for the new deck. Skipped on mount, since
  // the initial state above already set up the starting deck's game.
  // Deliberately keyed only on deckConfig.id, not speedMode -- see
  // useServerGame.js's matching comment for why.
  useEffect(() => {
    if (isFirstDeckRender.current) {
      isFirstDeckRender.current = false;
      return;
    }
    startNewGame();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deckConfig.id]);

  const cashOut = useCallback(() => {
    if (banked <= 0 || status !== "playing") return;
    clearTimeout(autoAdvanceRef.current);
    setTotalTokens((t) => t + banked);
    setStatus("cashed");
    setMessage(`Banked ${banked.toLocaleString()} points. Locked in for good.`);
    fireFlash("win");
    onGameEnd?.(deckConfig.id, { amount: banked, wasBanked: true });
  }, [banked, status, fireFlash, deckConfig, onGameEnd]);

  const makeCall = useCallback(
    (call) => {
      if (status !== "playing" || revealing || awaitingAdvance) return;

      const prepared = prepareCall(deck, compareCard, call, { deckConfig, mode: DEFAULT_PRICING_MODE });
      if (!prepared) return; // shouldn't happen — button is disabled when a call is impossible
      const { p, growth, drawn, rest, trueProbs } = prepared;

      clearInterval(intervalRef.current);
      playClickTone();
      setRevealing(true);
      setRevealedCard(drawn);
      setDeck(rest);

      // Applied the instant the call is resolved -- no artificial
      // pre-delay (there used to be one; removed for speed).
      const correct = isCorrectCall(call, compareCard, drawn);
      setHistory((h) => [{ card: drawn, correct }, ...h].slice(0, 5));

      if (correct) {
        const newWinStreak = winStreak + 1;
        const { newBanked, gain } = applyWin(banked, growth, deckConfig.ante);
        setWinStreak(newWinStreak);
        setBanked(newBanked);
        setJustWon(true);
        setTimeout(() => setJustWon(false), WIN_POP_MS);
        spawnToast(`+${gain.toLocaleString()}`);
        fireFlash("win");
        playWinTone();
        onCorrectCall?.(deckConfig.id, call, { winStreak: newWinStreak, trueProbs });

        const bankingDisabled = lifelinesUsedThisGame > 0 || speedModeRef.current;
        if (bankingDisabled && newWinStreak >= fullClearTarget(deckConfig)) {
          // No voluntary banking available (lifeline used, or Speed Mode)
          // and the deck is fully cleared -- the only way this payout can
          // ever be collected is to finalize right here, mirroring
          // make_call's server-side auto-finalize for the same two cases.
          setTotalTokens((t) => t + newBanked);
          setStatus("cashed");
          setMessage(`Cleared the deck! Banked ${newBanked.toLocaleString()} points.`);
          onGameEnd?.(deckConfig.id, { amount: newBanked, wasBanked: true });
        } else if (speedModeRef.current) {
          // Speed Mode: advance to the next hand immediately -- same
          // effect as advanceHand() below, just automatic instead of
          // gated behind a tap or timer.
          setCompareCard(drawn);
          setRevealedCard(null);
          setMessage("Call it before the clock runs out.");
        } else {
          setAwaitingAdvance(true);
          setMessage(
            call === "same"
              ? `Same rank! Priced at ${Math.round(p * 100)}% — +${gain.toLocaleString()} tokens. Tap to keep going.`
              : call === "red" || call === "black"
              ? `${call === "red" ? "Red" : "Black"}! Priced at ${Math.round(p * 100)}% — +${gain.toLocaleString()} tokens. Tap to keep going.`
              : `Correct — win streak ${newWinStreak}. +${gain.toLocaleString()} tokens. Tap to keep going.`
          );
        }
      } else if (lifelineAvailable) {
        setPendingBustCard(drawn);
        setStatus("lifeline-offer");
        setMessage(
          `Wrong — drew ${drawn.rank.key}${drawn.suit.symbol}. Use a Save the Game lifeline to keep your ${winStreak}-hand streak alive?`
        );
      } else {
        resolveBust(`Busted on ${drawn.rank.key}${drawn.suit.symbol}. Lost ${banked.toLocaleString()} tokens.`);
      }
      setRevealing(false);
    },
    [
      deck,
      compareCard,
      winStreak,
      banked,
      status,
      revealing,
      awaitingAdvance,
      deckConfig,
      lifelineAvailable,
      lifelinesUsedThisGame,
      spawnToast,
      fireFlash,
      resolveBust,
      onCorrectCall,
      onGameEnd,
    ]
  );

  // Spends one lifeline (account balance, atomic server-side) to forgive the
  // pending wrong hand: the Win Streak is neither incremented nor reset —
  // it just holds — and the wrongly-called card becomes the new compare
  // card, same as a normal hand advancing.
  const useLifeline = useCallback(async () => {
    if (status !== "lifeline-offer" || !pendingBustCard) return;
    const result = await onUseLifeline?.();
    if (result?.success) {
      setLifelinesUsedThisGame((n) => n + 1);
      setCompareCard(pendingBustCard);
      setPendingBustCard(null);
      setStatus("playing");
      setMessage("Call it before the clock runs out.");
    } else {
      // Lost a race with another tab/device, or balance changed underneath
      // us — fall back to busting on the same card that triggered the offer.
      const card = pendingBustCard;
      setPendingBustCard(null);
      resolveBust(`Busted on ${card.rank.key}${card.suit.symbol}. Lost ${banked.toLocaleString()} tokens.`);
    }
  }, [status, pendingBustCard, onUseLifeline, banked, resolveBust]);

  const declineLifeline = useCallback(() => {
    if (status !== "lifeline-offer" || !pendingBustCard) return;
    const card = pendingBustCard;
    setPendingBustCard(null);
    resolveBust(`Busted on ${card.rank.key}${card.suit.symbol}. Lost ${banked.toLocaleString()} tokens.`);
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
    deck,
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
