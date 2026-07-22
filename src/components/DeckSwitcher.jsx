import { useThemeTokens } from "../themes/ThemeContext";
import { ACTIVE_DECKS, UNLOCK_REQUIREMENTS, RANKS } from "../engine";

// Hides itself entirely when there's only one (or zero) active deck to
// choose from — no point showing a switcher with a single option. Reads
// ACTIVE_DECKS, not the full DECKS roster, so re-enabling more decks later
// makes this reappear automatically with no changes needed here.
export function DeckSwitcher({ selectedDeck, unlockedDecks, deckProgress, onSelect }) {
  const C = useThemeTokens();
  if (ACTIVE_DECKS.length <= 1) return null;

  return (
    <div className="w-full grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6">
      {ACTIVE_DECKS.map((deck) => {
        const unlocked = unlockedDecks.includes(deck.id);
        const selected = deck.id === selectedDeck;
        const requirement = UNLOCK_REQUIREMENTS[deck.id];
        const cardCount = deck.suits.length * RANKS.length * deck.deckCopies;

        const style = selected
          ? { border: `2px solid ${C.gold}`, background: C.goldSoft, color: C.gold }
          : unlocked
          ? { border: `2px solid ${C.border}`, color: C.textPrimary, background: "transparent" }
          : { border: `2px solid ${C.border}`, color: C.textMuted, background: "transparent", opacity: 0.55 };

        return (
          <button
            key={deck.id}
            onClick={() => unlocked && onSelect(deck.id)}
            disabled={!unlocked}
            title={!unlocked ? requirement?.description : undefined}
            className="rounded-xl px-3 py-2 text-left transition-transform active:scale-95 disabled:cursor-not-allowed"
            style={style}
          >
            <div className="flex items-center justify-between text-sm font-semibold">
              <span>{deck.name}</span>
              {!unlocked && <span aria-hidden="true">🔒</span>}
            </div>
            <div className="text-[10px]" style={{ fontFamily: "'IBM Plex Mono', monospace", opacity: 0.85 }}>
              ante {deck.ante.toLocaleString()} · {cardCount} cards
            </div>
            {!unlocked && requirement && (
              <div className="text-[10px] mt-1 leading-snug" style={{ color: C.textMuted }}>
                {requirement.description}
                {" — "}
                {deckProgress[ACTIVE_DECKS[ACTIVE_DECKS.findIndex((d) => d.id === deck.id) - 1].id].bestWinStreak}/10 best win streak
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
