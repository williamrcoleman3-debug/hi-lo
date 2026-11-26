import { describe, expect, it } from "vitest";
import { buildEngine, ROUND_SECONDS, groupsForStreak } from "./engine.js";

// players: [name, pos, stints, proBowlGroup]  ("S" skill, "D" defense, "O" o-line, "" none)
const data = {
  teams: [["Dallas Cowboys", "DAL", 1995], ["Dallas Cowboys", "DAL", 1996]],
  players: [
    ["Troy Aikman", "QB", [0, 1], "S"],
    ["Deion Sanders", "CB", [0, 1], "D"],
    ["Larry Allen", "G", [0, 1], "O"],
    ["Joe Backup", "QB", [0, 1], ""],
    ["Some Kicker", "K", [0, 1], ""],
  ],
};
const e = buildEngine(data);
const sample = (streak) => {
  const names = new Set();
  for (let i = 0; i < 300; i++) names.add(e.player(e.randomMystery(new Set(), streak)).name);
  return names;
};

describe("play clock", () => {
  it("is 25 seconds", () => expect(ROUND_SECONDS).toBe(25));
});

describe("who gets prompted, by streak", () => {
  it("streak 0-19: only Pro Bowl skill players", () => {
    expect(groupsForStreak(0)).toEqual(["S"]);
    expect(groupsForStreak(19)).toEqual(["S"]);
    expect([...sample(0)]).toEqual(["Troy Aikman"]);
  });
  it("streak 20-39: adds Pro Bowl defensive players", () => {
    expect(groupsForStreak(20)).toEqual(["S", "D"]);
    expect(sample(25)).toEqual(new Set(["Troy Aikman", "Deion Sanders"]));
  });
  it("streak 40+: adds Pro Bowl offensive linemen", () => {
    expect(groupsForStreak(40)).toEqual(["S", "D", "O"]);
    expect(sample(45)).toEqual(new Set(["Troy Aikman", "Deion Sanders", "Larry Allen"]));
  });
  it("non-Pro Bowlers are never prompted but can still be guessed", () => {
    expect(sample(45).has("Joe Backup")).toBe(false);
    expect(e.check(0, "joe backup", "season").ok).toBe(true);
    expect(e.check(0, "some kicker", "season").ok).toBe(true);
  });
});

describe("mystery card", () => {
  it("does not list his teams before the guess", () => {
    expect(e.cardInfo(0)).toEqual({ name: "Troy Aikman", pos: "QB", from: 1995, to: 1996 });
  });
});
