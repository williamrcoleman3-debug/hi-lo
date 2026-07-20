import { getTheme } from "../themes/registry";
import { ThemeProvider, useThemeTokens } from "../themes/ThemeContext";
import { Card } from "./Card";

// A fixed example card — this is a static mock, not a real round, so there's
// no compareCard/deck to reflect.
const EXAMPLE_CARD = { suit: { key: "spades", symbol: "♠", color: "mono" }, rank: { key: "K", value: 13 } };

// Deliberately renders plain <div>s where the real game has buttons — no
// onClick at all, not even a no-op — so there is no way to interact with a
// round here, structurally, not just by convention. No useGame, no
// useProgress: there is no game state for this component to touch.
function PreviewContent({ themeName, unlockDescription, onClose }) {
  const C = useThemeTokens();
  return (
    <div className="w-full flex flex-col items-center" style={{ background: C.bg, borderRadius: 16, padding: "2rem 1rem" }}>
      <div
        className="w-full max-w-4xl rounded-xl px-4 py-3 mb-6 text-center text-sm font-semibold"
        style={{ background: C.goldSoft, border: `1px solid ${C.gold}`, color: C.gold }}
      >
        Preview — {unlockDescription} to unlock
      </div>

      <div className="w-full max-w-4xl flex items-center justify-between mb-6 px-4">
        <h1 className="text-2xl font-bold" style={{ fontFamily: "'Fraunces', serif", color: C.textPrimary }}>
          {themeName}
        </h1>
        <button onClick={onClose} className="text-sm underline" style={{ color: C.textMuted }}>
          Close preview
        </button>
      </div>

      <div
        className="w-full max-w-4xl flex flex-col items-center py-8"
        style={{ border: C.tableFrameBorder, boxShadow: C.tableFrameShadow, borderRadius: 16 }}
      >
        <div className="flex items-center gap-6 mb-6">
          <Card card={EXAMPLE_CARD} />
          <Card hidden />
        </div>

        <div
          className="w-full text-center rounded-xl px-4 py-3 mb-6 text-sm max-w-md"
          style={{ border: `1px solid ${C.border}`, background: C.panel, color: C.textSecondary, fontFamily: "'IBM Plex Mono', monospace" }}
        >
          Call it before the clock runs out.
        </div>

        <div className="w-full max-w-md grid grid-cols-3 gap-3 mb-3 px-4">
          {["Lower", "Same", "Higher"].map((label) => (
            <div
              key={label}
              className="rounded-xl font-semibold py-3 text-center"
              style={{ border: `2px solid ${C.border}`, color: C.textMuted }}
            >
              {label}
            </div>
          ))}
        </div>
        <div className="w-full max-w-md grid grid-cols-2 gap-3 px-4">
          {["Red", "Black"].map((label) => (
            <div
              key={label}
              className="rounded-xl font-semibold py-3 text-center"
              style={{ border: `2px solid ${C.border}`, color: C.textMuted }}
            >
              {label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ThemePreviewOverlay({ themeId, onClose }) {
  const theme = getTheme(themeId);
  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 overflow-y-auto"
      style={{ background: "rgba(0,0,0,0.75)" }}
    >
      <div className="w-full max-w-4xl">
        <ThemeProvider themeId={themeId}>
          <PreviewContent themeName={theme.name} unlockDescription={theme.unlockDescription} onClose={onClose} />
        </ThemeProvider>
      </div>
    </div>
  );
}
