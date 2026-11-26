import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../supabase/client.js", () => ({
  isSupabaseConfigured: true,
  supabase: { rpc: vi.fn(() => Promise.resolve({ error: null })), from: vi.fn() },
}));

import { supabase } from "../supabase/client.js";
import { submitNameGameStreak } from "./leaderboard.js";

beforeEach(() => supabase.rpc.mockClear());

describe("posting a streak", () => {
  it("needs sign-in: signed-out players can't post", async () => {
    const r = await submitNameGameStreak({ userId: null, mode: "season", streak: 7 });
    expect(r).toEqual({ posted: false, reason: "signed_out" });
    expect(supabase.rpc).not.toHaveBeenCalled();
  });
  it("skips a zero streak", async () => {
    const r = await submitNameGameStreak({ userId: "u1", mode: "season", streak: 0 });
    expect(r.posted).toBe(false);
    expect(supabase.rpc).not.toHaveBeenCalled();
  });
  it("signed-in players post through the server function", async () => {
    const r = await submitNameGameStreak({ userId: "u1", mode: "franchise", streak: 12 });
    expect(r).toEqual({ posted: true });
    expect(supabase.rpc).toHaveBeenCalledWith("submit_name_game_streak", { p_mode: "franchise", p_streak: 12 });
  });
});
