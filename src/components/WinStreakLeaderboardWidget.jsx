import { useEffect, useState } from "react";
import { useThemeTokens } from "../themes/ThemeContext";
import { fetchSingleDeckWinStreakLeaderboard, LEADERBOARD_BACKEND_READY } from "../leaderboard/api";

const MEDALS = ["🥇", "🥈", "🥉"];
const TOP_N = 10;

// Condensed home-screen widget for the Single Deck Win Streak board — the
// primary contest metric — so it's visible no matter which deck is
// currently selected, not just when the player is on Single Deck.
export function WinStreakLeaderboardWidget({ onViewFull }) {
  const C = useThemeTokens();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchSingleDeckWinStreakLeaderboard()
      .then((data) => {
        if (!cancelled) {
          setRows(data.slice(0, TOP_N));
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-widest" style={{ color: C.textMuted }}>
          Win Streak — Single Deck
        </span>
        {onViewFull && (
          <button onClick={onViewFull} className="text-[10px] uppercase tracking-widest underline" style={{ color: C.gold }}>
            Full board
          </button>
        )}
      </div>

      {!LEADERBOARD_BACKEND_READY ? (
        <div className="text-xs py-4 text-center" style={{ color: C.textMuted }}>
          Leaderboards go live once accounts are wired up.
        </div>
      ) : loading ? (
        <div className="text-xs py-4 text-center" style={{ color: C.textMuted }}>
          Loading…
        </div>
      ) : rows.length === 0 ? (
        <div className="text-xs py-4 text-center" style={{ color: C.textMuted }}>
          No streaks recorded yet — be the first.
        </div>
      ) : (
        rows.map((row, i) => (
          <div
            key={i}
            className="flex items-center justify-between px-3 py-1.5 rounded-lg text-xs"
            style={{ border: `1px solid ${C.border}`, fontFamily: "'IBM Plex Mono', monospace" }}
          >
            <span className="flex items-center gap-2">
              <span style={{ color: C.textMuted, minWidth: "1.5em", display: "inline-block" }}>
                {MEDALS[i] ?? `#${i + 1}`}
              </span>
              {row.avatar && <span aria-hidden="true">{row.avatar}</span>}
              <span style={{ color: C.textPrimary }}>{row.username}</span>
            </span>
            <span style={{ color: C.gold }}>{row.score.toLocaleString()}</span>
          </div>
        ))
      )}
    </div>
  );
}
