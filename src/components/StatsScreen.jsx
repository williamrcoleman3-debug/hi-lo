import { useEffect, useState } from "react";
import { useThemeTokens } from "../themes/ThemeContext";
import { fetchMyDeckStats } from "../stats/stats.js";

export function StatsScreen({ userId }) {
  const C = useThemeTokens();
  const [deckStats, setDeckStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    if (!userId) {
      setDeckStats(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    fetchMyDeckStats(userId)
      .then((data) => {
        if (!cancelled) {
          setDeckStats(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setLoadError(err.message);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return (
    <div className="w-full flex flex-col items-center">
      <div className="w-full max-w-4xl mb-6">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight" style={{ fontFamily: "'Fraunces', serif" }}>
          My Stats
        </h1>
        <p className="text-sm mt-1" style={{ color: C.textSecondary }}>
          Games Played and Hands Won are completed-game / correct-hand lifetime counts — the same numbers behind
          the Total Hands Won leaderboard.
        </p>
      </div>

      {!userId ? (
        <div className="w-full max-w-4xl rounded-xl p-6 text-sm text-center" style={{ border: `1px solid ${C.border}`, color: C.textMuted }}>
          Sign in to track your stats.
        </div>
      ) : loadError ? (
        <div className="w-full max-w-4xl rounded-xl p-6 text-sm text-center" style={{ border: `1px solid ${C.border}`, color: C.lose }}>
          Couldn't load your stats ({loadError}).
        </div>
      ) : loading || !deckStats ? (
        // Gated on `!deckStats` too, not just `loading` — `userId` can turn
        // truthy (once auth resolves) a render before this effect has had a
        // chance to flip `loading` back to true, and deckStats is the only
        // value that's actually never stale at that moment.
        <div className="w-full max-w-4xl rounded-xl p-6 text-sm text-center" style={{ border: `1px solid ${C.border}`, color: C.textMuted }}>
          Loading…
        </div>
      ) : (
        <div className="w-full max-w-4xl rounded-xl overflow-hidden" style={{ border: `1px solid ${C.border}` }}>
          <div
            className="grid grid-cols-3 gap-4 px-4 py-2 text-[10px] uppercase tracking-widest"
            style={{ background: C.panel, color: C.textMuted, fontFamily: "'IBM Plex Mono', monospace" }}
          >
            <span>Deck</span>
            <span>Games Played</span>
            <span>Hands Won</span>
          </div>
          {deckStats.perDeck.map((d) => (
            <div
              key={d.deckId}
              className="grid grid-cols-3 gap-4 px-4 py-2 text-sm"
              style={{ borderTop: `1px solid ${C.border}` }}
            >
              <span>{d.deckName}</span>
              <span style={{ color: C.textPrimary }}>{d.gamesPlayed.toLocaleString()}</span>
              <span style={{ color: C.gold }}>{d.handsWon.toLocaleString()}</span>
            </div>
          ))}
          <div
            className="grid grid-cols-3 gap-4 px-4 py-2 text-sm font-semibold"
            style={{ borderTop: `1px solid ${C.border}`, background: C.panel }}
          >
            <span>Lifetime total</span>
            <span style={{ color: C.textPrimary }}>{deckStats.totals.gamesPlayed.toLocaleString()}</span>
            <span style={{ color: C.gold }}>{deckStats.totals.handsWon.toLocaleString()}</span>
          </div>
        </div>
      )}
    </div>
  );
}
