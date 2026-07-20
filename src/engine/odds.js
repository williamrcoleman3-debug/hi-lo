// True live odds for each call type, based on the actual cards left in the shoe.
export function calcProbs(deck, curVal) {
  const N = deck.length;
  if (N === 0) return { pHigher: 0, pLower: 0, pSame: 0, pRed: 0, pBlack: 0, N: 0 };
  let higher = 0, lower = 0, same = 0, red = 0, black = 0;
  for (const c of deck) {
    if (c.rank.value > curVal) higher++;
    else if (c.rank.value < curVal) lower++;
    else same++;
    if (c.suit.color === "red") red++;
    else black++;
  }
  return { pHigher: higher / N, pLower: lower / N, pSame: same / N, pRed: red / N, pBlack: black / N, N };
}

export function probForCall(probs, call) {
  switch (call) {
    case "higher": return probs.pHigher;
    case "lower": return probs.pLower;
    case "same": return probs.pSame;
    case "red": return probs.pRed;
    case "black": return probs.pBlack;
    default: return 0;
  }
}
