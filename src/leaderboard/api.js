import { supabase, isSupabaseConfigured } from "../supabase/client.js";

export const LEADERBOARD_BACKEND_READY = isSupabaseConfigured;

const COLUMN_BY_BOARD = {
  cumulative: "cumulative_banked",
  peak: "peak_score",
};

// Resolves to [{ username, score, achievedAt }], best-first, for the given
// level and board type ("cumulative" or "peak" — see supabase/schema.sql).
export async function fetchLeaderboard(levelId, board = "cumulative") {
  if (!LEADERBOARD_BACKEND_READY) return [];

  const column = COLUMN_BY_BOARD[board];
  const { data, error } = await supabase
    .from("leaderboard_scores")
    .select(`${column}, updated_at, profiles(username)`)
    .eq("level_id", levelId)
    .gt(column, 0)
    .order(column, { ascending: false })
    .limit(50);

  if (error) throw error;

  return data.map((row) => ({
    username: row.profiles?.username ?? "anonymous",
    score: row[column],
    achievedAt: row.updated_at,
  }));
}
