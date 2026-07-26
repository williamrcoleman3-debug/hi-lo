import { useThemeTokens } from "../themes/ThemeContext";
import { FONT_TABULAR } from "../themes/registry.js";
import { useBlackjack } from "../hooks/useBlackjack.js";
import { handValue } from "../blackjack/engine.js";
import { Card } from "./Card";

function PlusIcon({ color }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function StopHandIcon({ color }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V12" />
      <path d="M11 12V4.5a1.5 1.5 0 0 1 3 0V12" />
      <path d="M14 12V5.5a1.5 1.5 0 0 1 3 0V13" />
      <path d="M17 13V8.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-2a6 6 0 0 1-5.6-4L5 12" />
    </svg>
  );
}

function SplitIcon({ color }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20V13" />
      <path d="M12 13L6 7" />
      <path d="M12 13L18 7" />
      <path d="M6 7h4" />
      <path d="M6 7v4" />
      <path d="M18 7h-4" />
      <path d="M18 7v4" />
    </svg>
  );
}

function ActionButton({ enabled, onClick, bg, ink, label, children }) {
  const C = useThemeTokens();
  const style = enabled
    ? { background: bg, color: ink }
    : { background: C.panel, color: C.textMuted, border: `1px solid ${C.border}` };
  return (
    <button
      onClick={onClick}
      disabled={!enabled}
      className="rounded-lg font-semibold py-3 flex flex-col items-center gap-1 transition-transform active:scale-95 disabled:cursor-not-allowed"
      style={style}
    >
      {children}
      <span className="text-sm">{label}</span>
    </button>
  );
}

function resultStyle(C, result) {
  if (result === "win" || result === "blackjack") return { border: `1px solid ${C.win}`, color: C.win };
  if (result === "lose") return { border: `1px solid ${C.lose}`, color: C.lose };
  return { border: `1px solid ${C.border}`, color: C.textMuted };
}

function resultText(result) {
  if (result === "blackjack") return "Blackjack";
  if (result === "win") return "Win";
  if (result === "lose") return "Lose";
  return "Push";
}

export function BlackjackScreen() {
  const C = useThemeTokens();
  const { dealerCards, dealerHoleHidden, hands, activeHandIndex, phase, message, canDouble, canSplit, deal, hit, stand, doubleDown, split } =
    useBlackjack();

  const dealerVisibleValue = dealerHoleHidden
    ? dealerCards.length
      ? handValue([dealerCards[0]]).total
      : null
    : handValue(dealerCards).total;

  return (
    <div className="w-full flex flex-col items-center">
      <div className="w-full max-w-4xl mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Blackjack</h1>
        <p className="text-sm mt-1" style={{ color: C.textSecondary }}>
          Standard rules, entertainment only — no tokens, no betting, no stakes.
        </p>
      </div>

      <div className="w-full max-w-2xl flex flex-col items-center gap-6">
        <div className="flex flex-col items-center gap-2">
          <span className="text-xs uppercase tracking-widest" style={{ color: C.textMuted }}>
            dealer{dealerVisibleValue != null ? <span style={FONT_TABULAR}> · {dealerVisibleValue}</span> : null}
          </span>
          <div className="flex gap-3">
            {dealerCards.map((c, i) => (
              <Card key={i} card={c} hidden={i === 1 && dealerHoleHidden} />
            ))}
          </div>
        </div>

        {phase !== "idle" && (
          <div className="w-full text-center rounded-lg px-4 py-3 text-sm" style={{ border: `1px solid ${C.border}`, background: C.panel, color: C.textSecondary }}>
            {message}
          </div>
        )}

        {hands.length > 0 && (
          <div className="flex gap-6 justify-center flex-wrap">
            {hands.map((hand, i) => {
              const isActive = phase === "player-turn" && i === activeHandIndex;
              const dimmed = phase === "player-turn" && hands.length > 1 && !isActive;
              return (
                <div key={i} className="flex flex-col items-center gap-2" style={{ opacity: dimmed ? 0.5 : 1 }}>
                  <span className="text-xs uppercase tracking-widest" style={{ color: isActive ? C.accent : C.textMuted, ...FONT_TABULAR }}>
                    {hands.length > 1 ? `hand ${i + 1} · ` : ""}
                    {handValue(hand.cards).total}
                  </span>
                  <div className="flex gap-3">
                    {hand.cards.map((c, j) => (
                      <Card key={j} card={c} />
                    ))}
                  </div>
                  {hand.result && (
                    <span className="text-xs font-semibold rounded-lg px-3 py-1" style={resultStyle(C, hand.result)}>
                      {resultText(hand.result)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {phase === "player-turn" ? (
          <div className="w-full grid grid-cols-4 gap-3">
            <ActionButton enabled onClick={hit} bg={C.bjHit} ink={C.bjHitInk} label="Hit">
              <PlusIcon color={C.bjHitInk} />
            </ActionButton>
            <ActionButton enabled onClick={stand} bg={C.bjStand} ink={C.bjStandInk} label="Stand">
              <StopHandIcon color={C.bjStandInk} />
            </ActionButton>
            <ActionButton enabled={canSplit} onClick={split} bg={C.bjSplit} ink={C.bjSplitInk} label="Split">
              <SplitIcon color={canSplit ? C.bjSplitInk : C.textMuted} />
            </ActionButton>
            <ActionButton enabled={canDouble} onClick={doubleDown} bg={C.bjDouble} ink={C.bjDoubleInk} label="Double">
              <span className="text-sm font-bold">&times;2</span>
            </ActionButton>
          </div>
        ) : (
          <button
            onClick={deal}
            className="w-full rounded-lg font-semibold py-3 transition-transform active:scale-95"
            style={{ background: C.accent, color: C.cardInk }}
          >
            {phase === "idle" ? "Deal" : "New hand"}
          </button>
        )}
      </div>
    </div>
  );
}
