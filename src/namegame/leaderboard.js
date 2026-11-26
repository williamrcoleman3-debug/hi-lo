import { supabase, isSupabaseConfigured } from "../supabase/client.js";

// Top streaks for one mode, best first: [{ username, avatar, streak }].
// Reads name_game_scores joined to the public profiles table, the same
// pattern as src/leaderboard/api.js.
export async function fetchNameGameLeaderboard(mode, limit = 10) {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from("name_game_scores")
    .select("best_streak, updated_at, profiles(username, avatar)")
    .eq("mode", mode)
    .order("best_streak", { ascending: false })
    .order("updated_at", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return data.map((r) => ({
    username: r.profiles?.username ?? "anonymous",
    avatar: r.profiles?.avatar ?? null,
    streak: r.best_streak,
  }));
}

// Only signed-in players post. The server function writes to the caller's
// own row (auth.uid()) and only ever raises their best -- see
// supabase/name_game.sql.
export async function submitNameGameStreak({ userId, mode, streak }) {
  if (!userId) return { posted: false, reason: "signed_out" };
  if (!(streak > 0)) return { posted: false, reason: "no_streak" };
  if (!isSupabaseConfigured) return { posted: false, reason: "offline" };
  const { error } = await supabase.rpc("submit_name_game_streak", { p_mode: mode, p_streak: streak });
  if (error) throw error;
  return { posted: true };
}
