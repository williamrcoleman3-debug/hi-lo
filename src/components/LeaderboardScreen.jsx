import { useEffect, useState } from "react";
import { C } from "../theme";
import { LEVELS } from "../engine";
import { fetchLeaderboard, LEADERBOARD_BACKEND_READY } from "../leaderboard/api";

const BOARDS = [
  { id: "cumulative", label: "Cumulative Banked", blurb: "Lifetime total of everything actually locked in via Bank — busts don't count." },
  { id: "peak", label: "Highest Peak", blurb: "The biggest single-run banked value ever reached, even if that run ended in a bust." },
];

export function LeaderboardScreen() {
  const [levelId, setLevelId] = useState(LEVELS[0].id);
  const [board, setBoard] = useState("cumulative");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    fetchLeaderboard(levelId, board)
      .then((data) => {
        if (!cancelled) {
          setRows(data);
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
  }, [levelId, board]);

  const level = LEVELS.find((l) => l.id === levelId);
  const boardMeta = BOARDS.find((b) => b.id === board);

  return (
    <div className="w-full flex flex-col items-center">
      <div className="w-full max-w-4xl mb-6">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight" style={{ fontFamily: "'Fraunces', serif" }}>
          Leaderboard
        </h1>
        <p className="text-sm mt-1" style={{ color: C.textSecondary }}>
          Top scores, per level — ante scales by level, so scores aren't compared across tiers.
        </p>
      </div>

      <div className="w-full max-w-4xl grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        {LEVELS.map((l) => (
          <button
            key={l.id}
            onClick={() => setLevelId(l.id)}
            className="rounded-xl px-3 py-2 text-sm font-semibold transition-transform active:scale-95"
            style={
              l.id === levelId
                ? { border: `2px solid ${C.gold}`, background: C.goldSoft, color: C.gold }
                : { border: `2px solid ${C.border}`, color: C.textPrimary, background: "transparent" }
            }
          >
            {l.name}
          </button>
        ))}
      </div>

      <div className="w-full max-w-4xl grid grid-cols-2 gap-2 mb-6">
        {BOARDS.map((b) => (
          <button
            key={b.id}
            onClick={() => setBoard(b.id)}
            className="rounded-xl px-3 py-2 text-left transition-transform active:scale-95"
            style={
              b.id === board
                ? { border: `2px solid ${C.teal}`, background: C.tealSoft, color: C.teal }
                : { border: `2px solid ${C.border}`, color: C.textMuted, background: "transparent" }
            }
          >
            <div className="text-sm font-semibold">{b.label}</div>
          </button>
        ))}
      </div>

      <p className="w-full max-w-4xl text-xs mb-3" style={{ color: C.textMuted }}>
        {boardMeta.blurb}
      </p>

      <div className="w-full max-w-4xl rounded-xl overflow-hidden" style={{ border: `1px solid ${C.border}` }}>
        <div
          className="grid grid-cols-[1fr_auto_auto] gap-4 px-4 py-2 text-[10px] uppercase tracking-widest"
          style={{ background: C.panel, color: C.textMuted, fontFamily: "'IBM Plex Mono', monospace" }}
        >
          <span>Player</span>
          <span>Score</span>
          <span>Achieved</span>
        </div>

        {!LEADERBOARD_BACKEND_READY ? (
          <div className="px-4 py-8 text-center text-sm" style={{ color: C.textMuted }}>
            Leaderboards go live once accounts are wired up — nothing to show yet on {level.name}.
          </div>
        ) : loadError ? (
          <div className="px-4 py-8 text-center text-sm" style={{ color: C.lose }}>
            Couldn't load the leaderboard ({loadError}).
          </div>
        ) : loading ? (
          <div className="px-4 py-8 text-center text-sm" style={{ color: C.textMuted }}>
            Loading…
          </div>
        ) : rows.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm" style={{ color: C.textMuted }}>
            No scores yet on {level.name} — be the first.
          </div>
        ) : (
          rows.map((row, i) => (
            <div
              key={i}
              className="grid grid-cols-[1fr_auto_auto] gap-4 px-4 py-2 text-sm"
              style={{ borderTop: `1px solid ${C.border}` }}
            >
              <span>{row.username}</span>
              <span style={{ color: C.gold }}>{row.score.toLocaleString()}</span>
              <span style={{ color: C.textMuted }}>{new Date(row.achievedAt).toLocaleDateString()}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
