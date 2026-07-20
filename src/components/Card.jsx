import { useThemeTokens } from "../themes/ThemeContext";

export function Card({ card, hidden, pop }) {
  const C = useThemeTokens();
  if (!card || hidden) {
    return (
      <div
        className="w-36 h-52 sm:w-44 sm:h-64 rounded-2xl flex items-center justify-center"
        style={{
          border: `2px solid ${C.border}`,
          background: `linear-gradient(to bottom right, ${C.cardBack1}, ${C.cardBack2})`,
          boxShadow: "0 0 40px rgba(0,0,0,0.5)",
        }}
      >
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center"
          style={{ border: `1px solid ${C.borderStrong}` }}
        >
          <span className="text-3xl" style={{ color: C.borderStrong, fontFamily: "'Fraunces', serif" }}>
            ?
          </span>
        </div>
      </div>
    );
  }
  const isRed = card.suit.color === "red";
  const ink = isRed ? C.cardRed : C.cardBlack;
  return (
    <div
      className={`w-36 h-52 sm:w-44 sm:h-64 rounded-2xl flex flex-col justify-between p-4 ${pop ? "card-pop" : ""}`}
      style={{
        background: C.cardFace,
        border: `2px solid ${C.cardTrim}`,
        boxShadow: "0 10px 40px rgba(0,0,0,0.55)",
      }}
    >
      <div className="text-2xl font-bold" style={{ color: ink, fontFamily: "'Fraunces', serif" }}>
        {card.rank.key}
        <div className="text-xl leading-none">{card.suit.symbol}</div>
      </div>
      <div className="self-center text-6xl" style={{ color: ink }}>
        {card.suit.symbol}
      </div>
      <div
        className="text-2xl font-bold self-end"
        style={{ color: ink, fontFamily: "'Fraunces', serif", transform: "rotate(180deg)" }}
      >
        {card.rank.key}
        <div className="text-xl leading-none">{card.suit.symbol}</div>
      </div>
    </div>
  );
}
