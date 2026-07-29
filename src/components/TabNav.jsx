import { useEffect, useRef, useState } from "react";
import { useThemeTokens } from "../themes/ThemeContext";

const GAME_TAB = { id: "game", label: "Game" };
const LEADERBOARD_TAB = { id: "leaderboard", label: "Leaderboard" };

// Everything besides Game/Leaderboard always collapses into "More" -- new
// tabs should default in here rather than growing the primary row.
const BASE_OVERFLOW_TABS = [
  { id: "blackjack", label: "Blackjack" },
  { id: "unlocks", label: "Unlocks" },
  { id: "stats", label: "Stats" },
  { id: "referrals", label: "Referrals" },
  { id: "lifelines", label: "Lifelines" },
  { id: "rules", label: "Rules" },
  { id: "fairness", label: "Fairness" },
  { id: "contest-rules", label: "Contest Rules" },
  { id: "privacy", label: "Privacy" },
  { id: "feedback", label: "Feedback" },
];

// Below sm (640px), the primary row (Game/Leaderboard/More) plus a signed-in
// AuthWidget row (avatar, username, streak, Sign out) doesn't reliably fit
// side by side -- a max-length 16-char username overflows the viewport even
// with tightened spacing (measured 0px margin in testing). Folding
// Leaderboard into More specifically on mobile, while keeping it a top-level
// tab at sm and up, restores a healthy margin without touching desktop.
function useIsDesktopNav() {
  const [isDesktop, setIsDesktop] = useState(() => window.matchMedia("(min-width: 640px)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 640px)");
    const handler = (e) => setIsDesktop(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return isDesktop;
}

export function TabNav({ active, onChange }) {
  const C = useThemeTokens();
  const [menuOpen, setMenuOpen] = useState(false);
  const containerRef = useRef(null);
  const isDesktop = useIsDesktopNav();

  const primaryTabs = isDesktop ? [GAME_TAB, LEADERBOARD_TAB] : [GAME_TAB];
  const overflowTabs = isDesktop ? BASE_OVERFLOW_TABS : [LEADERBOARD_TAB, ...BASE_OVERFLOW_TABS];
  const isOverflowActive = overflowTabs.some((t) => t.id === active);

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

  const activeStyle = { border: `2px solid ${C.accent}`, color: C.accent, background: C.accentSoft };
  const inactiveStyle = { border: `2px solid ${C.border}`, color: C.textMuted, background: "transparent" };

  return (
    <div className="flex gap-1 sm:gap-2" ref={containerRef}>
      {primaryTabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className="px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-semibold transition-transform active:scale-95"
          style={active === t.id ? activeStyle : inactiveStyle}
        >
          {t.label}
        </button>
      ))}

      <div className="relative">
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-semibold transition-transform active:scale-95"
          style={isOverflowActive ? activeStyle : inactiveStyle}
        >
          More
        </button>
        {menuOpen && (
          <div
            className="absolute left-0 top-full mt-2 flex flex-col rounded-lg overflow-hidden z-10 min-w-[140px]"
            style={{ border: `2px solid ${C.border}`, background: C.bg }}
          >
            {overflowTabs.map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  onChange(t.id);
                  setMenuOpen(false);
                }}
                className="px-4 py-2 text-sm font-semibold text-left transition-colors"
                style={active === t.id ? { color: C.accent, background: C.accentSoft } : { color: C.textMuted, background: "transparent" }}
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
