import { useEffect, useState } from "react";
import { useThemeTokens } from "../themes/ThemeContext";
import { LEVELS } from "../engine";
import { fetchLeaderboard, fetchStreakLeaderboard, LEADERBOARD_BACKEND_READY } from "../leaderboard/api";

const SECTIONS = [
  { id: "scores", label: "Scores" },
  { id: "streaks", label: "Streaks" },
];

const SCORE_BOARDS = [
  { id: "cumulative", label: "Cumulative Banked", blurb: "Lifetime total of everything actually locked in via Bank — busts don't count." },
  { id: "peak", label: "Highest Peak", blurb: "The biggest single-run banked value ever reached, even if that run ended in a bust." },
];

const STREAK_BOARDS = [
  { id: "current", label: "Current Streak", blurb: "Consecutive days banked on any level, right now — breaks and resets to 1 the next day you bank." },
  { id: "longest", label: "Longest Streak Ever", blurb: "Permanent bragging rights — doesn't disappear just because a current streak broke." },
];

function LeaderboardTable({ columns, rows, loading, loadError, emptyMessage }) {
  const C = useThemeTokens();
  return (
    <div className="w-full max-w-4xl rounded-xl overflow-hidden" style={{ border: `1px solid ${C.border}` }}>
      <div
        className="grid gap-4 px-4 py-2 text-[10px] uppercase tracking-widest"
        style={{
          gridTemplateColumns: columns.map((c) => c.width ?? "auto").join(" "),
          background: C.panel,
          color: C.textMuted,
          fontFamily: "'IBM Plex Mono', monospace",
        }}
      >
        {columns.map((c) => (
          <span key={c.header}>{c.header}</span>
        ))}
      </div>

      {!LEADERBOARD_BACKEND_READY ? (
        <div className="px-4 py-8 text-center text-sm" style={{ color: C.textMuted }}>
          Leaderboards go live once accounts are wired up.
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
          {emptyMessage}
        </div>
      ) : (
        rows.map((row, i) => (
          <div
            key={i}
            className="grid gap-4 px-4 py-2 text-sm"
            style={{ gridTemplateColumns: columns.map((c) => c.width ?? "auto").join(" "), borderTop: `1px solid ${C.border}` }}
          >
            {columns.map((c) => (
              <span key={c.header} style={c.color ? { color: c.color(row) } : undefined}>
                {c.render(row)}
              </span>
            ))}
          </div>
        ))
      )}
    </div>
  );
}

function ScoreSection() {
  const C = useThemeTokens();
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
  const boardMeta = SCORE_BOARDS.find((b) => b.id === board);

  return (
    <>
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
        {SCORE_BOARDS.map((b) => (
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

      <LeaderboardTable
        rows={rows}
        loading={loading}
        loadError={loadError}
        emptyMessage={`No scores yet on ${level.name} — be the first.`}
        columns={[
          { header: "Player", render: (r) => r.username, width: "1fr" },
          { header: "Score", render: (r) => r.score.toLocaleString(), color: () => C.gold },
          { header: "Achieved", render: (r) => new Date(r.achievedAt).toLocaleDateString(), color: () => C.textMuted },
        ]}
      />
    </>
  );
}

function StreakSection() {
  const C = useThemeTokens();
  const [board, setBoard] = useState("current");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    fetchStreakLeaderboard(board)
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
  }, [board]);

  const boardMeta = STREAK_BOARDS.find((b) => b.id === board);

  return (
    <>
      <div
        className="w-full max-w-4xl rounded-xl px-4 py-3 mb-4 text-xs"
        style={{ border: `1px solid ${C.ember}`, background: "rgba(232,118,60,0.08)", color: C.textSecondary }}
      >
        🔥 Account-wide — not tied to any one level. Banking on any level, any day, keeps this alive.
      </div>

      <div className="w-full max-w-4xl grid grid-cols-2 gap-2 mb-6">
        {STREAK_BOARDS.map((b) => (
          <button
            key={b.id}
            onClick={() => setBoard(b.id)}
            className="rounded-xl px-3 py-2 text-left transition-transform active:scale-95"
            style={
              b.id === board
                ? { border: `2px solid ${C.ember}`, background: "rgba(232,118,60,0.12)", color: C.ember }
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

      <LeaderboardTable
        rows={rows}
        loading={loading}
        loadError={loadError}
        emptyMessage="No streaks yet — be the first to bank two days in a row."
        columns={[
          { header: "Player", render: (r) => r.username, width: "1fr" },
          { header: "Streak", render: (r) => `${r.score.toLocaleString()} day${r.score === 1 ? "" : "s"}`, color: () => C.ember },
        ]}
      />
    </>
  );
}

export function LeaderboardScreen() {
  const C = useThemeTokens();
  const [section, setSection] = useState("scores");

  return (
    <div className="w-full flex flex-col items-center">
      <div className="w-full max-w-4xl mb-6">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight" style={{ fontFamily: "'Fraunces', serif" }}>
          Leaderboard
        </h1>
        <p className="text-sm mt-1" style={{ color: C.textSecondary }}>
          Scores are per level — ante scales by level, so they aren't compared across tiers. Streaks are account-wide.
        </p>
      </div>

      <div className="w-full max-w-4xl flex gap-2 mb-6">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            onClick={() => setSection(s.id)}
            className="px-4 py-2 rounded-lg text-sm font-semibold transition-transform active:scale-95"
            style={
              section === s.id
                ? { border: `2px solid ${C.gold}`, color: C.gold, background: C.goldSoft }
                : { border: `2px solid ${C.border}`, color: C.textMuted, background: "transparent" }
            }
          >
            {s.label}
          </button>
        ))}
      </div>

      {section === "scores" ? <ScoreSection /> : <StreakSection />}
    </div>
  );
}
