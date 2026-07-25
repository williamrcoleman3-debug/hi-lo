import { useThemeTokens } from "../themes/ThemeContext";

// Flat, borderless-shadow rebuild -- no box-shadow, no gradient card back, no
// trim/corner treatment, one card-face ink color plus a muted red for suits
// (distinct from the `lose` alert red -- see themes/registry.js).
export function Card({ card, hidden, pop }) {
  const C = useThemeTokens();
  if (!card || hidden) {
    return (
      <div
        className="w-36 h-52 sm:w-44 sm:h-64 rounded-lg flex items-center justify-center"
        style={{ border: `2px solid ${C.border}`, background: C.panel }}
      >
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center"
          style={{ border: `1px solid ${C.borderStrong}` }}
        >
          <span className="text-3xl" style={{ color: C.textMuted }}>
            ?
          </span>
        </div>
      </div>
    );
  }
  const ink = card.suit.color === "red" ? C.cardRedInk : C.cardInk;
  return (
    <div
      className={`w-36 h-52 sm:w-44 sm:h-64 rounded-lg flex flex-col items-center justify-center ${pop ? "card-pop" : ""}`}
      style={{ background: C.cardFace, border: `2px solid ${C.border}` }}
    >
      <div className="text-5xl sm:text-6xl font-bold leading-none" style={{ color: ink }}>
        {card.rank.key}
      </div>
      <div className="text-3xl sm:text-4xl leading-none mt-2" style={{ color: ink }}>
        {card.suit.symbol}
      </div>
    </div>
  );
}
