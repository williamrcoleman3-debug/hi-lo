import { describe, expect, it } from "vitest";
import { buildEngine, normalize } from "./engine.js";

// Tiny fixture: team-seasons and four players.
const data = {
  teams: [
    ["New England Patriots", "NE", 2010], // 0
    ["New England Patriots", "NE", 1980], // 1
    ["San Francisco 49ers", "SF", 1985], // 2
    ["Tampa Bay Buccaneers", "TB", 2020], // 3
  ],
  players: [
    ["Tom Brady", "QB", [0, 3]], // 0
    ["Randy Moss", "WR", [0]], // 1
    ["Steve Grogan", "QB", [1]], // 2
    ["Joe Montana", "QB", [2]], // 3
    ["Mike Williams", "WR", [3]], // 4
    ["Mike Williams", "OT", [2]], // 5
  ],
};
const e = buildEngine(data);

describe("teammate matching", () => {
  it("same season: accepts a real teammate and names the team", () => {
    const r = e.check(0, normalize("Randy Moss"), "season");
    expect(r.ok).toBe(true);
    expect(r.via).toBe("2010 New England Patriots");
  });
  it("same season: rejects same franchise in a different year", () => {
    expect(e.check(0, normalize("Steve Grogan"), "season").ok).toBe(false);
  });
  it("same franchise: accepts any year", () => {
    expect(e.check(0, normalize("Steve Grogan"), "franchise").ok).toBe(true);
  });
  it("rejects a player who never shared a team", () => {
    expect(e.check(0, normalize("Joe Montana"), "franchise").ok).toBe(false);
  });
  it("does not accept the mystery player himself", () => {
    expect(e.check(0, normalize("Tom Brady"), "season").ok).toBe(false);
  });
  it("same-name players: any of them can count", () => {
    expect(e.check(3, normalize("Mike Williams"), "season").ok).toBe(true);
    expect(e.check(0, normalize("Mike Williams"), "season").ok).toBe(true);
  });
  it("search groups same-name players into one suggestion", () => {
    const s = e.search("mike wil");
    expect(s).toHaveLength(1);
    expect(s[0].detail).toBe("2 players");
  });
});
