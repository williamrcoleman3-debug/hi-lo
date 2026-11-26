import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { skipsLeft } from "./engine.js";

vi.mock("./leaderboard.js", () => ({
  fetchNameGameLeaderboard: vi.fn(() => Promise.resolve([])),
  submitNameGameStreak: vi.fn(() => Promise.resolve({ posted: false })),
}));

describe("skips per game", () => {
  it("every game starts with 2", () => expect(skipsLeft(0, 0)).toBe(2));
  it("using one leaves 1", () => expect(skipsLeft(0, 1)).toBe(1));
  it("one more for every 10 correct in the same game", () => {
    expect(skipsLeft(9, 0)).toBe(2);
    expect(skipsLeft(10, 0)).toBe(3);
    expect(skipsLeft(25, 1)).toBe(3);
  });
  it("never below zero", () => expect(skipsLeft(0, 5)).toBe(0));
});

const DATA = {
  teams: [["Dallas Cowboys", "DAL", 1995], ["Green Bay Packers", "GB", 1990], ["Miami Dolphins", "MIA", 1985]],
  players: [
    ["Troy Aikman", "QB", [0], "S"],
    ["Brett Favre", "QB", [1], "S"],
    ["Dan Marino", "QB", [2], "S"],
  ],
};
globalThis.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve(DATA) }));
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
import TeammateGame from "./TeammateGame.jsx";

let root, el;
afterEach(() => { if (root) act(() => root.unmount()); el?.remove(); root = el = undefined; });

describe("skip button", () => {
  it("swaps the player, keeps the streak, and counts down", async () => {
    el = document.createElement("div");
    document.body.appendChild(el);
    root = createRoot(el);
    await act(async () => { root.render(<TeammateGame />); });
    await act(async () => {});
    await act(async () => el.querySelector(".tg-mode").click());

    const skip = () => el.querySelector(".tg-skip");
    const first = el.querySelector(".tg-card h2").textContent;
    expect(skip().textContent).toContain("2");

    await act(async () => skip().click());
    expect(el.querySelector(".tg-card h2").textContent).not.toBe(first);
    expect(el.querySelector(".tg-score b").textContent).toBe("0");
    expect(el.querySelector(".tg-over")).toBeNull();
    expect(skip().textContent).toContain("1");

    await act(async () => skip().click());
    expect(skip().disabled).toBe(true);
  });
});
