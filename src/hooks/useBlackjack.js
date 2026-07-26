import { useCallback, useReducer } from "react";
import { freshShoe, handValue, isNatural, dealerShouldHit, resolveHand, canSplitPair } from "../blackjack/engine.js";

// Free-to-play, entertainment only -- no tokens, no betting, no stakes, no
// server. Every other game in this app is either server-authoritative
// (signed-in Hi-Lo) or feeds a client-side progress tracker (anonymous
// Hi-Lo); this one does neither, since there's nothing to protect or
// record -- a win here has no effect on anything else in the app. Pure
// client-side React state is sufficient.
const initialState = {
  deck: [],
  dealerCards: [],
  dealerHoleHidden: true,
  hands: [],
  activeHandIndex: 0,
  phase: "idle", // "idle" | "player-turn" | "round-over"
  message: "Deal to start.",
};

function draw(deck) {
  const [card, ...rest] = deck;
  return [card, rest];
}

function outcomeLabel(result) {
  if (result === "blackjack") return "Blackjack! You win.";
  if (result === "win") return "You win!";
  if (result === "lose") return "You lose.";
  return "Push.";
}

function summarize(hands) {
  if (hands.length === 1) return outcomeLabel(hands[0].result);
  const wins = hands.filter((h) => h.result === "win" || h.result === "blackjack").length;
  const losses = hands.filter((h) => h.result === "lose").length;
  const pushes = hands.filter((h) => h.result === "push").length;
  return `${wins} win${wins === 1 ? "" : "s"}, ${losses} loss${losses === 1 ? "" : "es"}, ${pushes} push${pushes === 1 ? "" : "es"}.`;
}

// Called once every player hand is either done or busted. Plays out the
// dealer (unless every hand already busted, in which case there's nothing
// left to resolve against) and resolves each hand that isn't already
// decided.
function advanceOrFinish(state) {
  const nextIndex = state.hands.findIndex((h, i) => i > state.activeHandIndex && !h.done);
  if (nextIndex !== -1) {
    return { ...state, activeHandIndex: nextIndex, message: "Your turn." };
  }

  const anyLive = state.hands.some((h) => !handValue(h.cards).busted);
  let dealerCards = state.dealerCards;
  let deck = state.deck;
  if (anyLive) {
    while (dealerShouldHit(dealerCards)) {
      const [card, rest] = draw(deck);
      dealerCards = [...dealerCards, card];
      deck = rest;
    }
  }

  const hands = state.hands.map((h) => ({
    ...h,
    done: true,
    result: h.result ?? resolveHand(h.cards, dealerCards),
  }));

  return {
    ...state,
    deck,
    dealerCards,
    dealerHoleHidden: false,
    hands,
    phase: "round-over",
    message: summarize(hands),
  };
}

function reducer(state, action) {
  switch (action.type) {
    case "DEAL": {
      let deck = freshShoe();
      let card;
      [card, deck] = draw(deck);
      let playerCards = [card];
      [card, deck] = draw(deck);
      let dealerCards = [card];
      [card, deck] = draw(deck);
      playerCards = [...playerCards, card];
      [card, deck] = draw(deck);
      dealerCards = [...dealerCards, card];

      const playerNatural = isNatural(playerCards);
      const dealerNatural = isNatural(dealerCards);

      if (playerNatural || dealerNatural) {
        const result = playerNatural && dealerNatural ? "push" : playerNatural ? "blackjack" : "lose";
        const hands = [{ cards: playerCards, done: true, result }];
        return {
          deck,
          dealerCards,
          dealerHoleHidden: false,
          hands,
          activeHandIndex: 0,
          phase: "round-over",
          message: outcomeLabel(result),
        };
      }

      return {
        deck,
        dealerCards,
        dealerHoleHidden: true,
        hands: [{ cards: playerCards, done: false, result: null }],
        activeHandIndex: 0,
        phase: "player-turn",
        message: "Your turn.",
      };
    }

    case "HIT": {
      if (state.phase !== "player-turn") return state;
      const hand = state.hands[state.activeHandIndex];
      const [card, rest] = draw(state.deck);
      const cards = [...hand.cards, card];
      const busted = handValue(cards).busted;
      const hands = state.hands.map((h, i) =>
        i === state.activeHandIndex ? { ...h, cards, done: busted, result: busted ? "lose" : null } : h
      );
      const next = { ...state, deck: rest, hands };
      return busted ? advanceOrFinish(next) : next;
    }

    case "STAND": {
      if (state.phase !== "player-turn") return state;
      const hands = state.hands.map((h, i) => (i === state.activeHandIndex ? { ...h, done: true } : h));
      return advanceOrFinish({ ...state, hands });
    }

    // Only ever available on an un-split hand's first two cards (see
    // useBlackjack's canDouble below, which the UI disables against) --
    // draws exactly one card, then that hand is done regardless of the
    // result.
    case "DOUBLE": {
      if (state.phase !== "player-turn") return state;
      const hand = state.hands[state.activeHandIndex];
      if (state.hands.length > 1 || hand.cards.length !== 2) return state;
      const [card, rest] = draw(state.deck);
      const cards = [...hand.cards, card];
      const busted = handValue(cards).busted;
      const hands = state.hands.map((h, i) =>
        i === state.activeHandIndex ? { ...h, cards, done: true, result: busted ? "lose" : null, doubled: true } : h
      );
      return advanceOrFinish({ ...state, deck: rest, hands });
    }

    // Single-level split only -- a matching starting pair becomes two
    // hands, each dealt one new card. Neither resulting hand can be
    // split again or doubled (see canSplit/canDouble below).
    case "SPLIT": {
      if (state.phase !== "player-turn" || state.hands.length > 1) return state;
      const hand = state.hands[state.activeHandIndex];
      if (!canSplitPair(hand.cards)) return state;
      let deck = state.deck;
      let card;
      [card, deck] = draw(deck);
      const handA = { cards: [hand.cards[0], card], done: false, result: null };
      [card, deck] = draw(deck);
      const handB = { cards: [hand.cards[1], card], done: false, result: null };
      return { ...state, deck, hands: [handA, handB], activeHandIndex: 0, message: "Your turn." };
    }

    default:
      return state;
  }
}

export function useBlackjack() {
  const [state, dispatch] = useReducer(reducer, initialState);

  const deal = useCallback(() => dispatch({ type: "DEAL" }), []);
  const hit = useCallback(() => dispatch({ type: "HIT" }), []);
  const stand = useCallback(() => dispatch({ type: "STAND" }), []);
  const doubleDown = useCallback(() => dispatch({ type: "DOUBLE" }), []);
  const split = useCallback(() => dispatch({ type: "SPLIT" }), []);

  const activeHand = state.hands[state.activeHandIndex] ?? null;
  const canDouble = state.phase === "player-turn" && state.hands.length === 1 && activeHand?.cards.length === 2;
  const canSplit = state.phase === "player-turn" && state.hands.length === 1 && !!activeHand && canSplitPair(activeHand.cards);

  return { ...state, activeHand, canDouble, canSplit, deal, hit, stand, doubleDown, split };
}
