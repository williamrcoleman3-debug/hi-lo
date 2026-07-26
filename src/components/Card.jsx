import { useThemeTokens } from "../themes/ThemeContext";

// Flat, borderless-shadow rebuild -- no box-shadow, no gradient card back, no
// trim/corner treatment, one card-face ink color plus a muted red for suits
// (distinct from the `lose` alert red -- see themes/registry.js).
export function Card({ card, hidden, pop }) {
  const C = useThemeTokens();
  if (!card || hidden) {
    // The Hi-Lo crosshair mark -- circle, four short lines extending
    // outward at the cardinal points, solid center dot. Card backs only
    // for now (see themes/registry.js#cardBackMark) -- not used anywhere
    // else in the app yet.
    return (
      <div
        className="w-36 h-52 sm:w-44 sm:h-64 rounded-lg flex items-center justify-center"
        style={{ border: `2px solid ${C.accent}`, background: C.panel }}
      >
        <svg width="56" height="56" viewBox="0 0 48 48" fill="none" stroke={C.cardBackMark} strokeWidth="2" strokeLinecap="round">
          <circle cx="24" cy="24" r="10" />
          <line x1="24" y1="2" x2="24" y2="10" />
          <line x1="24" y1="38" x2="24" y2="46" />
          <line x1="2" y1="24" x2="10" y2="24" />
          <line x1="38" y1="24" x2="46" y2="24" />
          <circle cx="24" cy="24" r="2.5" fill={C.cardBackMark} stroke="none" />
        </svg>
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
