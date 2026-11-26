import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";

vi.mock("./leaderboard.js", () => ({
  fetchNameGameLeaderboard: vi.fn(() => Promise.resolve([])),
  submitNameGameStreak: vi.fn(() => Promise.resolve({ posted: false })),
}));

const DATA = {
  teams: [["Dallas Cowboys", "DAL", 1995], ["Green Bay Packers", "GB", 1990]],
  players: [
    ["Troy Aikman", "QB", [0], "S"],
    ["Brett Favre", "QB", [1], "S"],
  ],
};
globalThis.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve(DATA) }));
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

import TeammateGame from "./TeammateGame.jsx";
import { DEFAULT_MODE } from "./engine.js";

let root, el;
afterEach(() => { if (root) act(() => root.unmount()); el?.remove(); root = el = undefined; });

async function mount() {
  el = document.createElement("div");
  document.body.appendChild(el);
  root = createRoot(el);
  await act(async () => { root.render(<TeammateGame />); });
  await act(async () => {});
  return el;
}

describe("defaults", () => {
  it("default mode is Same franchise", () => {
    expect(DEFAULT_MODE).toBe("franchise");
  });
  it("Same franchise is listed first on the start screen", async () => {
    const page = await mount();
    expect(page.querySelector(".tg-mode").textContent).toContain("Same franchise");
  });
});

describe("after a wrong answer", () => {
  it("shows the mystery player's teams automatically", async () => {
    const page = await mount();
    await act(async () => page.querySelector(".tg-mode").click());
    const name = page.querySelector(".tg-card h2").textContent;
    const wrong = name === "Troy Aikman" ? "Brett Favre" : "Troy Aikman";
    const team = name === "Troy Aikman" ? "Dallas Cowboys" : "Green Bay Packers";
    const input = page.querySelector(".tg-guess input");
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    await act(async () => {
      setter.call(input, wrong);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => page.querySelector(".tg-sugg button").click());
    const reveal = page.querySelector(".tg-reveal");
    expect(reveal).not.toBeNull();
    expect(reveal.tagName).not.toBe("DETAILS"); // not hidden behind a tap
    expect(reveal.textContent).toContain(team);
  });
});
