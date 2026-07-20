import { useState } from "react";
import { useThemeTokens } from "../themes/ThemeContext";
import { HOUSE_EDGE, TIMER_MS, RANKS } from "../engine";
import { useGame } from "../hooks/useGame";
import { recordRunEndRemote } from "../persistence/cloudProgress";
import { buildShareText, buildShareUrl, shareResult } from "../share/share";
import { Card } from "./Card";
import { ReferenceLadder } from "./ReferenceLadder";
import { LevelSwitcher } from "./LevelSwitcher";

export function GameScreen({
  userId,
  profile,
  refreshProfile,
  selectedLevelConfig,
  unlockedLevels,
  levelProgress,
  recordCorrectCall,
  selectLevel,
}) {
  const C = useThemeTokens();
  const [isNewPeak, setIsNewPeak] = useState(false);
  const [shareNotice, setShareNotice] = useState(null);

  const {
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
  } = useGame(selectedLevelConfig, {
    onCorrectCall: recordCorrectCall,
    onRunEnd: userId
      ? async (levelId, { amount, wasBanked }) => {
          const result = await recordRunEndRemote(levelId, amount, wasBanked);
          setIsNewPeak(result.isNewPeak);
          // A Bank may have just advanced the daily streak server-side —
          // pull the fresh value so the UI (and share text) is current.
          if (wasBanked) refreshProfile();
        }
      : undefined,
  });

  const handleStartNewGame = () => {
    setIsNewPeak(false);
    setShareNotice(null);
    startNewGame();
  };

  const handleShare = async () => {
    const text = buildShareText({
      status,
      amount: banked,
      levelName: selectedLevelConfig.name,
      currentStreak: profile?.current_streak ?? 0,
      isNewPeak,
    });
    const url = buildShareUrl(profile?.username);
    const result = await shareResult(text, url);
    if (result === "copied") {
      setShareNotice("Copied to clipboard!");
      setTimeout(() => setShareNotice(null), 2000);
    } else if (result === "unsupported") {
      setShareNotice("Sharing isn't supported in this browser.");
      setTimeout(() => setShareNotice(null), 2500);
    }
  };

  const shoeSize = selectedLevelConfig.suits.length * RANKS.length * selectedLevelConfig.deckCopies;
  const timerPct = Math.max(0, (timeLeft / TIMER_MS) * 100);
  const timerColor = timerPct > 50 ? C.teal : timerPct > 20 ? C.gold : C.lose;

  const messageStyle =
    status === "busted"
      ? { border: `1px solid ${C.emberBorder}`, background: "rgba(122,43,40,0.15)", color: C.ember }
      : status === "cashed"
      ? { border: `1px solid ${C.teal}`, background: C.tealSoft, color: C.teal }
      : awaitingAdvance
      ? { border: `1px solid ${C.win}`, background: "rgba(61,220,132,0.1)", color: C.win }
      : { border: `1px solid ${C.border}`, background: C.panel, color: C.textSecondary };

  const callDisabled = (p) => revealing || p <= 0;

  return (
    <div
      className={`w-full flex flex-col items-center relative overflow-hidden ${shake ? "screen-shake" : ""}`}
    >
      {flash && (
        <div
          className="pointer-events-none fixed inset-0 z-50"
          style={{
            background: flash === "win" ? C.winFlashOverlay : C.loseFlashOverlay,
            transition: "opacity 0.42s ease-out",
          }}
        />
      )}

      <div className="pointer-events-none fixed top-24 right-6 z-50 flex flex-col items-end gap-1">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="float-toast text-lg font-bold"
            style={{ color: C.win, fontFamily: "'IBM Plex Mono', monospace" }}
          >
            {t.text}
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="w-full max-w-4xl flex items-center justify-between mb-6">
        <div>
          <h1
            className="text-3xl sm:text-4xl font-bold tracking-tight"
            style={{ fontFamily: "'Fraunces', serif", color: C.textPrimary }}
          >
            Higher · Lower <span style={{ color: C.gold }}>· Same</span>
          </h1>
          <p className="text-sm mt-1" style={{ color: C.textSecondary }}>
            Payouts are priced off a fresh shoe, not the one in front of you. One miss — or one hesitation — wipes the run.
          </p>
        </div>
        <div className="text-right" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
          <div className="text-[10px] uppercase tracking-widest" style={{ color: C.textMuted }}>
            vault
          </div>
          <div className="text-2xl font-semibold" style={{ color: C.gold }}>
            {totalTokens.toLocaleString()}
          </div>
        </div>
      </div>

      <div className="w-full max-w-4xl">
        <LevelSwitcher
          selectedLevel={selectedLevelConfig.id}
          unlockedLevels={unlockedLevels}
          levelProgress={levelProgress}
          onSelect={selectLevel}
        />
      </div>

      {/* The table itself — this is what gets the wooden-rail frame in Poker
          Table (tableFrameBorder/tableFrameShadow are "none" for Classic). */}
      <div
        className="w-full max-w-4xl p-4 sm:p-6"
        style={{ border: C.tableFrameBorder, boxShadow: C.tableFrameShadow, borderRadius: 16 }}
      >
        <div className="w-full grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-8">
          {/* Table */}
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-6 mb-2">
              <div className="flex flex-col items-center gap-2">
                <span className="text-[10px] uppercase tracking-widest" style={{ color: C.textMuted }}>
                  current
                </span>
                <Card card={compareCard} />
              </div>
              <div className="flex flex-col items-center gap-2">
                <span className="text-[10px] uppercase tracking-widest" style={{ color: C.textMuted }}>
                  next
                </span>
                <Card card={revealedCard} hidden={!revealedCard} pop={revealing || !!revealedCard} />
              </div>
            </div>

            <div
              className="text-[11px] uppercase tracking-widest mb-3"
              style={{ color: C.textMuted, fontFamily: "'IBM Plex Mono', monospace" }}
            >
              {deck.length} cards left in the shoe · ante {selectedLevelConfig.ante.toLocaleString()}
            </div>

            {status === "playing" && !awaitingAdvance && (
              <div className="w-full mb-4">
                <div
                  className="w-full h-2 rounded-full overflow-hidden"
                  style={{ background: C.panel, border: `1px solid ${C.border}` }}
                >
                  <div
                    style={{
                      width: `${timerPct}%`,
                      height: "100%",
                      background: timerColor,
                      transition: "width 0.05s linear, background 0.2s ease",
                    }}
                  />
                </div>
              </div>
            )}

            <div
              className="w-full text-center rounded-xl px-4 py-3 mb-6 text-sm"
              style={{ ...messageStyle, fontFamily: "'IBM Plex Mono', monospace" }}
            >
              {message}
            </div>

            {/* Controls — priced per hand off the level's static baseline */}
            {status === "playing" && !awaitingAdvance && (
              <div className="w-full grid grid-cols-3 gap-3 mb-4">
                <button
                  onClick={() => makeCall("lower")}
                  disabled={callDisabled(probs.pLower)}
                  className="rounded-xl font-semibold py-3 transition-transform active:scale-95 disabled:opacity-30"
                  style={{ border: `2px solid ${C.teal}`, color: C.teal, background: "transparent" }}
                >
                  Lower
                  <div className="text-[10px]" style={{ fontFamily: "'IBM Plex Mono', monospace", opacity: 0.85 }}>
                    {probs.pLower > 0 ? `${Math.round(probs.pLower * 100)}% · ×${growths.lower.toFixed(2)}` : "—"}
                  </div>
                </button>
                <button
                  onClick={() => makeCall("same")}
                  disabled={callDisabled(probs.pSame)}
                  className="rounded-xl font-semibold py-3 transition-transform active:scale-95 disabled:opacity-30"
                  style={{ border: `2px solid ${C.gold}`, color: C.gold, background: "transparent" }}
                >
                  Same
                  <div className="text-[10px]" style={{ fontFamily: "'IBM Plex Mono', monospace", opacity: 0.85 }}>
                    {probs.pSame > 0 ? `${Math.round(probs.pSame * 100)}% · ×${growths.same.toFixed(2)}` : "—"}
                  </div>
                </button>
                <button
                  onClick={() => makeCall("higher")}
                  disabled={callDisabled(probs.pHigher)}
                  className="rounded-xl font-semibold py-3 transition-transform active:scale-95 disabled:opacity-30"
                  style={{ border: `2px solid ${C.ember}`, color: C.ember, background: "transparent" }}
                >
                  Higher
                  <div className="text-[10px]" style={{ fontFamily: "'IBM Plex Mono', monospace", opacity: 0.85 }}>
                    {probs.pHigher > 0 ? `${Math.round(probs.pHigher * 100)}% · ×${growths.higher.toFixed(2)}` : "—"}
                  </div>
                </button>
              </div>
            )}

            {status === "playing" && !awaitingAdvance && (
              <div className="w-full grid grid-cols-2 gap-3 mb-4">
                <button
                  onClick={() => makeCall("red")}
                  disabled={callDisabled(probs.pRed)}
                  className="rounded-xl font-semibold py-3 transition-transform active:scale-95 disabled:opacity-30"
                  style={{ border: `2px solid ${C.cardRed}`, color: C.cardRed, background: "transparent" }}
                >
                  Red
                  <div className="text-[10px]" style={{ fontFamily: "'IBM Plex Mono', monospace", opacity: 0.85 }}>
                    {probs.pRed > 0 ? `${Math.round(probs.pRed * 100)}% · ×${growths.red.toFixed(2)}` : "—"}
                  </div>
                </button>
                <button
                  onClick={() => makeCall("black")}
                  disabled={callDisabled(probs.pBlack)}
                  className="rounded-xl font-semibold py-3 transition-transform active:scale-95 disabled:opacity-30"
                  style={{ border: `2px solid ${C.textPrimary}`, color: C.textPrimary, background: "transparent" }}
                >
                  Black
                  <div className="text-[10px]" style={{ fontFamily: "'IBM Plex Mono', monospace", opacity: 0.85 }}>
                    {probs.pBlack > 0 ? `${Math.round(probs.pBlack * 100)}% · ×${growths.black.toFixed(2)}` : "—"}
                  </div>
                </button>
              </div>
            )}

            {status === "playing" && awaitingAdvance && (
              <button
                onClick={advanceRound}
                className="w-full rounded-xl font-semibold py-3.5 transition-transform active:scale-95 mb-3"
                style={{ background: C.win, color: "#0e0e12" }}
              >
                Skip →
              </button>
            )}

            {status === "playing" && banked > 0 && (
              <button
                onClick={cashOut}
                className="w-full rounded-xl font-semibold py-3 transition-transform active:scale-95 mb-2"
                style={{ background: C.gold, color: "#14161f" }}
              >
                Bank {banked.toLocaleString()} points
              </button>
            )}

            {(status === "busted" || status === "cashed") && (
              <>
                {(status === "cashed" || banked > 0) && (
                  <>
                    <button
                      onClick={handleShare}
                      className="w-full rounded-xl font-semibold py-3 transition-transform active:scale-95 mb-2"
                      style={{ background: C.teal, color: "#0e0e12" }}
                    >
                      Share
                    </button>
                    {shareNotice && (
                      <div className="w-full text-center text-xs mb-2" style={{ color: C.textMuted }}>
                        {shareNotice}
                      </div>
                    )}
                  </>
                )}
                <button
                  onClick={handleStartNewGame}
                  className="w-full rounded-xl font-semibold py-3 transition-transform active:scale-95"
                  style={{ border: `2px solid ${C.borderStrong}`, color: C.textPrimary, background: "transparent" }}
                >
                  Start new run
                </button>
              </>
            )}
          </div>

          {/* Ladder + stats */}
          <div className="flex flex-col items-center gap-4">
            <ReferenceLadder streak={streak} justClimbed={justClimbed} ante={selectedLevelConfig.ante} />
            <div
              className="w-full flex flex-col gap-2 text-xs pt-3"
              style={{ color: C.textSecondary, borderTop: `1px solid ${C.border}`, fontFamily: "'IBM Plex Mono', monospace" }}
            >
              <div className="flex justify-between">
                <span>cards left</span>
                <span style={{ color: C.textPrimary }}>{deck.length} / {shoeSize}</span>
              </div>
              <div className="flex justify-between">
                <span>streak</span>
                <span className={justClimbed ? "streak-punch" : ""} style={{ color: C.textPrimary }}>
                  {streak}
                </span>
              </div>
              <div className="flex justify-between">
                <span>at risk</span>
                <span style={{ color: C.gold }}>{banked.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>house edge</span>
                <span style={{ color: C.textPrimary }}>{Math.round(HOUSE_EDGE * 100)}% · every call</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <p className="max-w-4xl text-xs mt-8 text-center leading-relaxed" style={{ color: C.textMuted }}>
        Rules: guess whether the next card ranks higher, lower, or the same as the card shown — or skip rank
        entirely and call its color, red or black. Aces are high. Every call is priced off a fresh, full
        shoe for that rank — the price doesn't shrink as matching cards run out, so if you're tracking
        what's gone, you can spot when the real odds beat the price on the button. A call is greyed out
        only when it's structurally impossible (e.g. calling "Higher" on an Ace) — a call that's actually
        dead because of what's been dealt still lights up. Bank your points anytime to lock in your score
        for this run.
      </p>
    </div>
  );
}
