import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { loadEngine, MODES, DEFAULT_MODE, ROUND_SECONDS, groupsForStreak, GROUP_LABEL } from "./engine.js";
import { fetchNameGameLeaderboard, submitNameGameStreak } from "./leaderboard.js";
import "./TeammateGame.css";

const ROUND_MS = ROUND_SECONDS * 1000;
const FEEDBACK_MS = 1200;

const yrs = (a, b) => (a === b ? `${a}` : `${a}–${String(b).slice(-2)}`);

export default function TeammateGame({ dataUrl = "/nfl-teammates.json", userId = null, profile = null }) {
  const [engine, setEngine] = useState(null);
  const [loadErr, setLoadErr] = useState("");
  const [phase, setPhase] = useState("menu"); // menu | play | correct | over
  const [mode, setMode] = useState(DEFAULT_MODE);
  const [mystery, setMystery] = useState(null);
  const [streak, setStreak] = useState(0);
  const [left, setLeft] = useState(ROUND_MS);
  const [query, setQuery] = useState("");
  const [hi, setHi] = useState(0);
  const [feedback, setFeedback] = useState(null);
  const [over, setOver] = useState(null);
  const seen = useRef(new Set());
  const streakRef = useRef(0);
  const deadline = useRef(0);
  const inputRef = useRef(null);

  useEffect(() => {
    loadEngine(dataUrl).then(setEngine).catch((e) => setLoadErr(e.message));
  }, [dataUrl]);

  const nextRound = useCallback(() => {
    const id = engine.randomMystery(seen.current, streakRef.current);
    seen.current.add(id);
    setMystery(id);
    setQuery("");
    setHi(0);
    setFeedback(null);
    deadline.current = performance.now() + ROUND_MS;
    setLeft(ROUND_MS);
    setPhase("play");
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [engine]);

  const start = (m) => {
    setMode(m);
    setStreak(0);
    streakRef.current = 0;
    setOver(null);
    seen.current = new Set();
    nextRound();
  };

  const endRun = useCallback((reason, guessName) => {
    setOver({
      reason,
      guessName,
      answers: engine.sampleAnswers(mystery, mode),
      mysteryName: engine.player(mystery).name,
      lines: engine.careerLines(engine.player(mystery), mode),
    });
    setPhase("over");
  }, [engine, mystery, mode]);

  // play clock
  useEffect(() => {
    if (phase !== "play") return;
    const t = setInterval(() => {
      const ms = Math.max(0, deadline.current - performance.now());
      setLeft(ms);
      if (ms <= 0) { clearInterval(t); endRun("time"); }
    }, 50);
    return () => clearInterval(t);
  }, [phase, endRun]);

  const suggestions = useMemo(
    () => (engine && phase === "play" ? engine.search(query) : []),
    [engine, query, phase]
  );

  const guess = (key, display) => {
    if (phase !== "play") return;
    const res = engine.check(mystery, key, mode);
    if (res.ok) {
      streakRef.current += 1;
      setStreak(streakRef.current);
      setFeedback({ name: res.guess.name, via: res.via });
      setPhase("correct");
      setTimeout(nextRound, FEEDBACK_MS);
    } else {
      endRun("wrong", display);
    }
  };

  const onKey = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setHi((h) => Math.min(h + 1, suggestions.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
    else if (e.key === "Enter") {
      e.preventDefault();
      const s = suggestions[hi] || suggestions[0];
      if (s) guess(s.key, s.name);
    }
  };

  if (loadErr) return <div className="tg"><p className="tg-msg">Couldn't load players: {loadErr}</p></div>;
  if (!engine) return <div className="tg"><p className="tg-msg">Loading every NFL roster since 1932…</p></div>;

  const p = mystery != null ? engine.player(mystery) : null;
  const secs = Math.ceil(left / 1000);

  return (
    <div className="tg">
      {(phase === "play" || phase === "correct") && (
        <header className="tg-board">
          <div className="tg-modechip">{MODES[mode].label}</div>
          <div className="tg-score">
            <div><b>{streak}</b><span>Streak</span></div>
            <div className={`tg-clock ${secs <= 3 && phase === "play" ? "hot" : ""}`}>
              <b>{phase === "correct" ? "✓" : secs}</b><span>Play clock</span>
            </div>
          </div>
        </header>
      )}

      {phase === "menu" && (
        <Menu engine={engine} signedIn={!!userId} onStart={start} />
      )}

      {(phase === "play" || phase === "correct") && p && (
        <section className="tg-field">
          <div className="tg-bar"><i style={{ width: `${(left / ROUND_MS) * 100}%` }} /></div>
          <MysteryCard info={engine.cardInfo(mystery)} mode={mode} streak={streak} />

          {phase === "correct" && feedback ? (
            <div className="tg-good">
              <b>{feedback.name}</b>
              <span>{mode === "franchise" ? "Both played for the" : "Teammates on the"} {feedback.via}</span>
            </div>
          ) : (
            <div className="tg-guess">
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => { setQuery(e.target.value); setHi(0); }}
                onKeyDown={onKey}
                placeholder="Type a teammate's name"
                autoComplete="off" autoCorrect="off" autoCapitalize="words" spellCheck={false}
                aria-label="Teammate name"
              />
              {suggestions.length > 0 && (
                <ul className="tg-sugg" role="listbox">
                  {suggestions.map((s, i) => (
                    <li key={s.key} role="option" aria-selected={i === hi}>
                      <button
                        type="button"
                        className={i === hi ? "on" : ""}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => guess(s.key, s.name)}
                      >
                        <span>{s.name}</span><small>{s.detail}</small>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>
      )}

      {phase === "over" && over && (
        <GameOver
          over={over} streak={streak} mode={mode} userId={userId} profile={profile}
          onAgain={() => start(mode)} onMenu={() => setPhase("menu")}
        />
      )}
    </div>
  );
}

function MysteryCard({ info, mode, streak }) {
  const groups = groupsForStreak(streak);
  return (
    <article className="tg-card">
      <div className="tg-pos">{info.pos || "—"}</div>
      <h2>{info.name}</h2>
      <p className="tg-span">Played {info.from === info.to ? info.from : `${info.from}–${info.to}`} · {MODES[mode].label}</p>
      <p className="tg-pool">Pro Bowl pool: {groups.map((g) => GROUP_LABEL[g]).join(" + ")}</p>
    </article>
  );
}

function Menu({ engine, signedIn, onStart }) {
  const [tab, setTab] = useState(DEFAULT_MODE);
  return (
    <section className="tg-menu">
      <p className="tg-lede">
        You get a random Pro Bowler. Name anyone who played with him before the
        {" "}{ROUND_SECONDS}-second play clock runs out. One miss ends the streak.
      </p>
      <div className="tg-modes">
        {Object.values(MODES).map((m) => (
          <button key={m.id} className="tg-mode" onClick={() => onStart(m.id)}>
            <b>{m.label}</b>
            <span>{m.blurb}</span>
          </button>
        ))}
      </div>
      <p className="tg-fine">
        Skill players first. Pro Bowl defenders join at a 20 streak, offensive linemen at 40.
        Any of {engine.playerCount.toLocaleString()} players since 1932 counts as an answer.
        {!signedIn && " Sign in (top right) to get on the leaderboard."}
      </p>
      <div className="tg-tabs" role="tablist">
        {Object.values(MODES).map((m) => (
          <button key={m.id} role="tab" aria-selected={tab === m.id} className={tab === m.id ? "on" : ""} onClick={() => setTab(m.id)}>
            {m.label}
          </button>
        ))}
      </div>
      <Board mode={tab} />
    </section>
  );
}

function Board({ mode, refresh = 0, highlight }) {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    let live = true;
    setRows(null); setErr("");
    const t = setTimeout(() => live && setErr("Leaderboard is slow to load."), 10000);
    fetchNameGameLeaderboard(mode, 10)
      .then((r) => { if (live) { clearTimeout(t); setRows(r); setErr(""); } })
      .catch(() => { if (live) { clearTimeout(t); setErr("Leaderboard unavailable."); } });
    return () => { live = false; clearTimeout(t); };
  }, [mode, refresh]);

  if (err && !rows) return <p className="tg-fine">{err}</p>;
  if (!rows) return <p className="tg-fine">Loading leaderboard…</p>;
  if (!rows.length) return <p className="tg-fine">No streaks yet. Be the first.</p>;
  return (
    <ol className="tg-lb">
      {rows.map((r, i) => (
        <li key={i} className={highlight && r.username === highlight ? "me" : ""}>
          <span className="n">{i + 1}</span>
          <span className="who">{r.avatar && <span className="av" aria-hidden="true">{r.avatar}</span>}{r.username}</span>
          <b>{r.streak}</b>
        </li>
      ))}
    </ol>
  );
}

function GameOver({ over, streak, mode, userId, profile, onAgain, onMenu }) {
  const [post, setPost] = useState(streak > 0 ? (userId ? "saving" : "signed_out") : "none");
  const [refresh, setRefresh] = useState(0);

  // Signed-in players' streaks post automatically; the server keeps only their best.
  useEffect(() => {
    if (!userId || streak < 1) return;
    let live = true;
    submitNameGameStreak({ userId, mode, streak })
      .then((r) => { if (live) { setPost(r.posted ? "saved" : "error"); setRefresh((n) => n + 1); } })
      .catch(() => live && setPost("error"));
    return () => { live = false; };
  }, [userId, mode, streak]);

  return (
    <section className="tg-over">
      <p className="tg-why">
        {over.reason === "time" ? "Delay of game." : `${over.guessName} never played with ${over.mysteryName}.`}
      </p>
      <div className="tg-final"><b>{streak}</b><span>in a row · {MODES[mode].label}</span></div>
      {over.answers.length > 0 && (
        <p className="tg-fine">You could have said {over.answers.join(", ")}.</p>
      )}
      <div className="tg-reveal">
        <h3>{over.mysteryName} played for</h3>
        <ul className="tg-teams">
          {over.lines.map((l, i) => (
            <li key={i}><span>{yrs(l.from, l.to)}</span>{l.team}</li>
          ))}
        </ul>
      </div>
      {post === "signed_out" && <p className="tg-note">Sign in (top right) to post your streaks to the leaderboard.</p>}
      {post === "saving" && <p className="tg-fine">Posting your streak…</p>}
      {post === "saved" && <p className="tg-fine">Posted as {profile?.username ?? "you"}. Only your best streak shows.</p>}
      {post === "error" && <p className="tg-fine">Couldn't post that streak.</p>}

      <div className="tg-actions">
        <button className="tg-primary" onClick={onAgain}>Play again</button>
        <button className="tg-ghost" onClick={onMenu}>Modes</button>
      </div>
      <h3 className="tg-h3">Top streaks · {MODES[mode].label}</h3>
      <Board mode={mode} refresh={refresh} highlight={post === "saved" ? profile?.username : null} />
    </section>
  );
}
