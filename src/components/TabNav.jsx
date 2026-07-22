import { useEffect, useRef, useState } from "react";
import { useThemeTokens } from "../themes/ThemeContext";

// Game and Leaderboard are the primary contest-facing tabs and always get
// their own button. Everything else collapses into a single "More" tab so
// the primary row can never overflow/wrap on mobile — new tabs should
// default into OVERFLOW_TABS rather than growing this row.
const PRIMARY_TABS = [
  { id: "game", label: "Game" },
  { id: "leaderboard", label: "Leaderboard" },
];

const OVERFLOW_TABS = [
  { id: "unlocks", label: "Unlocks" },
  { id: "stats", label: "Stats" },
  { id: "rules", label: "Rules" },
  { id: "feedback", label: "Feedback" },
];

export function TabNav({ active, onChange }) {
  const C = useThemeTokens();
  const [menuOpen, setMenuOpen] = useState(false);
  const containerRef = useRef(null);
  const isOverflowActive = OVERFLOW_TABS.some((t) => t.id === active);

  useEffect(() => {
    if (!menuOpen) return;
    function handleOutsideClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [menuOpen]);

  const activeStyle = { border: `2px solid ${C.gold}`, color: C.gold, background: C.goldSoft };
  const inactiveStyle = { border: `2px solid ${C.border}`, color: C.textMuted, background: "transparent" };

  return (
    <div className="flex gap-2" ref={containerRef}>
      {PRIMARY_TABS.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className="px-4 py-2 rounded-lg text-sm font-semibold transition-transform active:scale-95"
          style={active === t.id ? activeStyle : inactiveStyle}
        >
          {t.label}
        </button>
      ))}

      <div className="relative">
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="px-4 py-2 rounded-lg text-sm font-semibold transition-transform active:scale-95"
          style={isOverflowActive ? activeStyle : inactiveStyle}
        >
          More
        </button>
        {menuOpen && (
          <div
            className="absolute left-0 top-full mt-2 flex flex-col rounded-lg overflow-hidden z-10 min-w-[140px]"
            style={{ border: `2px solid ${C.border}`, background: C.bg }}
          >
            {OVERFLOW_TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  onChange(t.id);
                  setMenuOpen(false);
                }}
                className="px-4 py-2 text-sm font-semibold text-left transition-colors"
                style={active === t.id ? { color: C.gold, background: C.goldSoft } : { color: C.textMuted, background: "transparent" }}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
