import { supabase, isSupabaseConfigured } from "../supabase/client.js";

export const LEADERBOARD_BACKEND_READY = isSupabaseConfigured;
const LEADERBOARD_DEPTH = 25;

// Total Token Score — resolves to [{ username, score, achievedAt }],
// best-first, for the given deck's lifetime cumulative_banked. Per deck,
// not combined — ante scales by deck, so combining would favor whoever
// plays the highest-ante deck rather than whoever plays best.
export async function fetchLeaderboard(deckId) {
  if (!LEADERBOARD_BACKEND_READY) return [];

  const { data, error } = await supabase
    .from("leaderboard_scores")
    .select("cumulative_banked, updated_at, profiles(username)")
    .eq("deck_id", deckId)
    .gt("cumulative_banked", 0)
    .order("cumulative_banked", { ascending: false })
    .limit(LEADERBOARD_DEPTH);

  if (error) throw error;

  return data.map((row) => ({
    username: row.profiles?.username ?? "anonymous",
    score: row.cumulative_banked,
    achievedAt: row.updated_at,
  }));
}

// Hands Won in a Row — Single Deck only, the primary/contest-tracked board.
// Reads the leaderboard_single_deck_win_streak view (see supabase/schema.sql),
// which already excludes is_contest_banned users.
export async function fetchSingleDeckWinStreakLeaderboard() {
  if (!LEADERBOARD_BACKEND_READY) return [];

  const { data, error } = await supabase
    .from("leaderboard_single_deck_win_streak")
    .select("username, best_win_streak, updated_at")
    .order("best_win_streak", { ascending: false })
    .limit(LEADERBOARD_DEPTH);

  if (error) throw error;

  return data.map((row) => ({ username: row.username, score: row.best_win_streak, achievedAt: row.updated_at }));
}

// Total Hands Won — combined across all four decks (a raw count, safe to
// combine unlike the deck-scaled token score). Reads the
// leaderboard_total_hands_won view.
export async function fetchTotalHandsWonLeaderboard() {
  if (!LEADERBOARD_BACKEND_READY) return [];

  const { data, error } = await supabase
    .from("leaderboard_total_hands_won")
    .select("username, total_hands_won")
    .order("total_hands_won", { ascending: false })
    .limit(LEADERBOARD_DEPTH);

  if (error) throw error;

  return data.map((row) => ({ username: row.username, score: row.total_hands_won }));
}

const STREAK_COLUMN_BY_BOARD = {
  current: "current_streak",
  longest: "longest_streak",
};

// Account-wide (not per-deck) — resolves to [{ username, score }], best-first,
// for "current" (Leaderboard C) or "longest" (Leaderboard D) Daily Streak.
export async function fetchStreakLeaderboard(board = "current") {
  if (!LEADERBOARD_BACKEND_READY) return [];

  const column = STREAK_COLUMN_BY_BOARD[board];
  const { data, error } = await supabase
    .from("profiles")
    .select(`username, ${column}`)
    .gt(column, 0)
    .order(column, { ascending: false })
    .limit(LEADERBOARD_DEPTH);

  if (error) throw error;

  return data.map((row) => ({ username: row.username, score: row[column] }));
}
