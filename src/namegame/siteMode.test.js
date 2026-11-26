import { describe, expect, it } from "vitest";
import { getHomeMode } from "./siteMode.js";

describe("getHomeMode (the on/off switch)", () => {
  it("shows The Name Game by default", () => {
    expect(getHomeMode({})).toBe("namegame");
  });
  it("switches back to Hi-Lo when VITE_HOME_GAME=hilo", () => {
    expect(getHomeMode({ VITE_HOME_GAME: "hilo" })).toBe("hilo");
  });
  it("ignores case and spaces", () => {
    expect(getHomeMode({ VITE_HOME_GAME: " HiLo " })).toBe("hilo");
  });
  it("treats unknown values as The Name Game", () => {
    expect(getHomeMode({ VITE_HOME_GAME: "something" })).toBe("namegame");
  });
});
