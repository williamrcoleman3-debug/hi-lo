import { useThemeTokens } from "../themes/ThemeContext";

const TABS = [
  { id: "game", label: "Game" },
  { id: "leaderboard", label: "Leaderboard" },
  { id: "unlocks", label: "Unlocks" },
];

export function TabNav({ active, onChange }) {
  const C = useThemeTokens();
  return (
    <div className="flex gap-2">
      {TABS.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className="px-4 py-2 rounded-lg text-sm font-semibold transition-transform active:scale-95"
          style={
            active === t.id
              ? { border: `2px solid ${C.gold}`, color: C.gold, background: C.goldSoft }
              : { border: `2px solid ${C.border}`, color: C.textMuted, background: "transparent" }
          }
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
