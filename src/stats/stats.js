import { supabase } from "../supabase/client.js";
import { ACTIVE_DECKS } from "../engine/decks.js";

// Games Played / Hands Won are the same deck_progress columns that already
// feed the unlock-gating logic and the Total Hands Won leaderboard — no
// separate counters, per Phase 5's "don't build two counters for the same
// thing." This just reads them back out for a personal stats display.
// Reads ACTIVE_DECKS, not the full roster, so hidden decks' (zeroed) rows
// don't clutter the breakdown while only Single Deck is reachable.
export async function fetchMyDeckStats(userId) {
  const { data, error } = await supabase
    .from("deck_progress")
    .select("deck_id, games_played, hands_won")
    .eq("user_id", userId);
  if (error) throw error;

  const perDeck = ACTIVE_DECKS.map((deck) => {
    const row = data.find((r) => r.deck_id === deck.id);
    return { deckId: deck.id, deckName: deck.name, gamesPlayed: row?.games_played ?? 0, handsWon: row?.hands_won ?? 0 };
  });

  const totals = perDeck.reduce(
    (acc, d) => ({ gamesPlayed: acc.gamesPlayed + d.gamesPlayed, handsWon: acc.handsWon + d.handsWon }),
    { gamesPlayed: 0, handsWon: 0 }
  );

  return { perDeck, totals };
}
