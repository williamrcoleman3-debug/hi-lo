// Teammate game engine: loads the roster dataset and answers
// "search", "random mystery player" and "are these two teammates?".
//
// Dataset shape (public/nfl-teammates.json):
//   teams:   [[displayName, franchiseKey, season], ...]   one row per team-season
//   players: [[name, position, [teamSeasonIdx, ...]], ...]

export const MODES = {
  season: {
    id: "season",
    label: "Same season",
    blurb: "Name someone who was on his team in the same season.",
  },
  franchise: {
    id: "franchise",
    label: "Same franchise",
    blurb: "Name anyone who ever played for one of his franchises.",
  },
};

export const MYSTERY_FROM_YEAR = 1970; // mystery players come from the merger era
export const ROUND_SECONDS = 25;

// Who can be the mystery player, by current streak. Only Pro Bowlers are
// prompted: S = skill (QB/RB/FB/WR/TE), D = defense, O = offensive line.
// Anyone at all can be typed as an answer.
export function groupsForStreak(streak) {
  if (streak >= 40) return ["S", "D", "O"];
  if (streak >= 20) return ["S", "D"];
  return ["S"];
}
export const GROUP_LABEL = { S: "Skill players", D: "Defense", O: "O-line" };

export function normalize(s) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export async function loadEngine(url = "/nfl-teammates.json") {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Could not load player data");
  const raw = await res.json();
  return buildEngine(raw);
}

export function buildEngine({ teams, players }) {
  const P = players.map(([name, pos, stints, pb = ""], id) => {
    const years = stints.map((s) => teams[s][2]);
    const seasons = new Set(years);
    const norm = normalize(name);
    return {
      id,
      name,
      pos,
      pb,
      stints,
      franchises: new Set(stints.map((s) => teams[s][1])),
      from: Math.min(...years),
      to: Math.max(...years),
      nSeasons: seasons.size,
      norm,
      tokens: norm.split(" "),
    };
  });

  const byNorm = new Map();
  for (const p of P) {
    if (!byNorm.has(p.norm)) byNorm.set(p.norm, []);
    byNorm.get(p.norm).push(p);
  }

  const rosterByTeam = teams.map(() => []);
  for (const p of P) for (const s of p.stints) rosterByTeam[s].push(p.id);

  const rosterByFranchise = new Map();
  for (const p of P)
    for (const f of p.franchises) {
      if (!rosterByFranchise.has(f)) rosterByFranchise.set(f, []);
      rosterByFranchise.get(f).push(p.id);
    }

  const franchiseName = new Map(); // latest display name per franchise
  teams.forEach(([name, f, y]) => {
    const cur = franchiseName.get(f);
    if (!cur || cur.y < y) franchiseName.set(f, { name, y });
  });

  const pools = { S: [], D: [], O: [] };
  for (const p of P) if (p.pb && p.to >= MYSTERY_FROM_YEAR) pools[p.pb].push(p.id);

  /** Teams list for the mystery card, grouped into runs: "2000–19 New England Patriots". */
  function careerLines(p, mode) {
    if (mode === "franchise") {
      const out = [];
      for (const f of p.franchises) {
        const ys = p.stints.filter((s) => teams[s][1] === f).map((s) => teams[s][2]);
        out.push({ team: franchiseName.get(f).name, from: Math.min(...ys), to: Math.max(...ys) });
      }
      return out.sort((a, b) => a.from - b.from);
    }
    const rows = p.stints
      .map((s) => ({ team: teams[s][0], y: teams[s][2] }))
      .sort((a, b) => a.y - b.y || a.team.localeCompare(b.team));
    const runs = [];
    for (const r of rows) {
      const last = runs[runs.length - 1];
      if (last && last.team === r.team && last.to === r.y - 1) last.to = r.y;
      else runs.push({ team: r.team, from: r.y, to: r.y });
    }
    return runs;
  }

  function search(query, limit = 6) {
    const q = normalize(query);
    if (q.length < 2) return [];
    const qt = q.split(" ");
    const hits = [];
    for (const p of P) {
      let ok = true;
      for (const t of qt) {
        if (!p.tokens.some((pt) => pt.startsWith(t))) { ok = false; break; }
      }
      if (!ok) continue;
      const score =
        (p.norm.startsWith(q) ? 2000 : 0) +
        (p.tokens[p.tokens.length - 1].startsWith(qt[qt.length - 1]) ? 500 : 0) +
        p.nSeasons * 10 + (p.to >= 1970 ? 50 : 0);
      hits.push([score, p]);
    }
    hits.sort((a, b) => b[0] - a[0] || a[1].name.localeCompare(b[1].name));
    // collapse same-name players into one row (any of them can count)
    const seen = new Set();
    const out = [];
    for (const [, p] of hits) {
      if (seen.has(p.norm)) continue;
      seen.add(p.norm);
      const same = byNorm.get(p.norm);
      out.push({
        key: p.norm,
        name: p.name,
        detail:
          same.length > 1
            ? `${same.length} players`
            : `${p.pos || "—"} · ${p.from === p.to ? p.from : `${p.from}–${p.to}`}`,
      });
      if (out.length >= limit) break;
    }
    return out;
  }

  /** Returns {ok, guess, via} — via is the shared team ("2007 New England Patriots"). */
  function check(mysteryId, guessNorm, mode) {
    const m = P[mysteryId];
    const candidates = (byNorm.get(guessNorm) || []).filter((g) => g.id !== m.id);
    for (const g of candidates) {
      if (mode === "franchise") {
        for (const f of g.franchises)
          if (m.franchises.has(f)) return { ok: true, guess: g, via: franchiseName.get(f).name };
      } else {
        const ms = new Set(m.stints);
        const shared = g.stints.filter((s) => ms.has(s));
        if (shared.length) {
          const s = shared[shared.length - 1];
          return { ok: true, guess: g, via: `${teams[s][2]} ${teams[s][0]}` };
        }
      }
    }
    return { ok: false, guess: candidates[0] || null };
  }

  /** A few well-known valid answers to show after a miss. */
  function sampleAnswers(mysteryId, mode, n = 3) {
    const m = P[mysteryId];
    const ids = new Set();
    if (mode === "franchise") for (const f of m.franchises) for (const id of rosterByFranchise.get(f)) ids.add(id);
    else for (const s of m.stints) for (const id of rosterByTeam[s]) ids.add(id);
    ids.delete(m.id);
    return [...ids]
      .map((id) => P[id])
      .sort((a, b) => b.nSeasons - a.nSeasons)
      .slice(0, n)
      .map((p) => p.name);
  }

  function randomMystery(exclude = new Set(), streak = 0) {
    const pool = groupsForStreak(streak).flatMap((g) => pools[g]);
    for (let i = 0; i < 50; i++) {
      const id = pool[Math.floor(Math.random() * pool.length)];
      if (!exclude.has(id)) return id;
    }
    return pool[0];
  }

  /** What the mystery card shows before the guess -- no teams. */
  function cardInfo(id) {
    const p = P[id];
    return { name: p.name, pos: p.pos, from: p.from, to: p.to };
  }

  return {
    player: (id) => P[id],
    playerCount: P.length,
    search,
    check,
    careerLines,
    sampleAnswers,
    randomMystery,
    cardInfo,
  };
}
