import { useCallback, useEffect, useRef, useState } from "react";
import {
  freshDeck,
  calcProbs,
  growthFor,
  prepareCall,
  isCorrectCall,
  applyWin,
  TIMER_MS,
  AUTO_ADVANCE_MS,
} from "../engine";

const REVEAL_DELAY_MS = 500; // pause between draw and resolution, so the card can flip into view

export function useGame() {
  const initial = freshDeck();
  const [deck, setDeck] = useState(() => initial.slice(1));
  const [compareCard, setCompareCard] = useState(() => initial[0]);
  const [revealedCard, setRevealedCard] = useState(null);
  const [streak, setStreak] = useState(0);
  const [banked, setBanked] = useState(0);
  const [totalTokens, setTotalTokens] = useState(0);
  const [status, setStatus] = useState("playing");
  const [awaitingAdvance, setAwaitingAdvance] = useState(false);
  const [message, setMessage] = useState("Call it before the clock runs out.");
  const [revealing, setRevealing] = useState(false);
  const [flash, setFlash] = useState(null);
  const [shake, setShake] = useState(false);
  const [justClimbed, setJustClimbed] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [timeLeft, setTimeLeft] = useState(TIMER_MS);

  const toastId = useRef(0);
  const intervalRef = useRef(null);
  const autoAdvanceRef = useRef(null);

  const decisionPaused = status !== "playing" || revealing || awaitingAdvance;
  const probs = calcProbs(deck, compareCard.rank.value);
  const growths = {
    higher: growthFor(probs.pHigher),
    lower: growthFor(probs.pLower),
    same: growthFor(probs.pSame),
    red: growthFor(probs.pRed),
    black: growthFor(probs.pBlack),
  };

  const spawnToast = useCallback((text) => {
    const id = ++toastId.current;
    setToasts((t) => [...t, { id, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 900);
  }, []);

  const fireFlash = useCallback((type) => {
    setFlash(type);
    setTimeout(() => setFlash(null), 420);
  }, []);

  const resolveBust = useCallback(
    (reasonMsg) => {
      setStatus("busted");
      setMessage(reasonMsg);
      fireFlash("lose");
      setShake(true);
      setTimeout(() => setShake(false), 420);
    },
    [fireFlash]
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
    const d = freshDeck();
    setDeck(d.slice(1));
    setCompareCard(d[0]);
    setRevealedCard(null);
    setStreak(0);
    setBanked(0);
    setStatus("playing");
    setAwaitingAdvance(false);
    setMessage("Call it before the clock runs out.");
    setShake(false);
  }, []);

  const cashOut = useCallback(() => {
    if (banked <= 0 || status !== "playing") return;
    clearTimeout(autoAdvanceRef.current);
    setTotalTokens((t) => t + banked);
    setStatus("cashed");
    setMessage(`Banked ${banked.toLocaleString()} points. Locked in for good.`);
    fireFlash("win");
  }, [banked, status, fireFlash]);

  const makeCall = useCallback(
    (call) => {
      if (status !== "playing" || revealing || awaitingAdvance) return;

      const prepared = prepareCall(deck, compareCard, call);
      if (!prepared) return; // shouldn't happen — button is disabled when a call is impossible
      const { p, growth, drawn, rest } = prepared;

      clearInterval(intervalRef.current);
      setRevealing(true);
      setRevealedCard(drawn);
      setDeck(rest);

      setTimeout(() => {
        const correct = isCorrectCall(call, compareCard, drawn);

        if (correct) {
          const newStreak = streak + 1;
          const { newBanked, gain } = applyWin(banked, growth);
          setStreak(newStreak);
          setBanked(newBanked);
          setJustClimbed(true);
          setTimeout(() => setJustClimbed(false), 400);
          spawnToast(`+${gain.toLocaleString()}`);
          fireFlash("win");
          setAwaitingAdvance(true);
          setMessage(
            call === "same"
              ? `Same rank! True odds ${Math.round(p * 100)}% — +${gain.toLocaleString()} tokens. Tap to keep going.`
              : call === "red" || call === "black"
              ? `${call === "red" ? "Red" : "Black"}! True odds ${Math.round(p * 100)}% — +${gain.toLocaleString()} tokens. Tap to keep going.`
              : `Correct — streak ${newStreak}. +${gain.toLocaleString()} tokens. Tap to keep going.`
          );
        } else {
          resolveBust(`Busted on ${drawn.rank.key}${drawn.suit.symbol}. Lost ${banked.toLocaleString()} tokens.`);
        }
        setRevealing(false);
      }, REVEAL_DELAY_MS);
    },
    [deck, compareCard, streak, banked, status, revealing, awaitingAdvance, spawnToast, fireFlash, resolveBust]
  );

  const advanceRound = useCallback(() => {
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
      advanceRound();
    }, AUTO_ADVANCE_MS);
    return () => clearTimeout(autoAdvanceRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [awaitingAdvance]);

  return {
    deck,
    compareCard,
    revealedCard,
    streak,
    banked,
    totalTokens,
    status,
    awaitingAdvance,
    message,
    revealing,
    flash,
    shake,
    justClimbed,
    toasts,
    timeLeft,
    probs,
    growths,
    makeCall,
    advanceRound,
    cashOut,
    startNewGame,
  };
}
