export const THEME_IDS = {
  CLASSIC: "classic",
  POKER_TABLE: "poker-table",
};

// Same token shape as the original src/theme.js — every component still does
// style={{ color: C.gold }} etc, only the source of C changes now.
const classicTokens = {
  bg: "#0e0e12",
  panel: "#14161f",
  cardBack1: "#1a1d29",
  cardBack2: "#12141c",
  border: "#3a3f4f",
  borderStrong: "#6a7086",
  textPrimary: "#ffffff",
  textSecondary: "#c3c8d6",
  textMuted: "#9096a8",
  gold: "#d4af6a",
  goldSoft: "rgba(212,175,106,0.12)",
  teal: "#2fa8a0",
  tealSoft: "rgba(47,168,160,0.12)",
  ember: "#e8763c",
  emberBorder: "#7a2b28",
  cardFace: "#ffffff",
  cardTrim: "#1e2a4a",
  cardRed: "#a3231d",
  cardBlack: "#0f1115",
  win: "#3ddc84",
  lose: "#ff4d4d",
  // Frames the table area — invisible for Classic, which never had this.
  tableFrameBorder: "none",
  tableFrameShadow: "none",
  winFlashOverlay: "radial-gradient(circle at 50% 30%, rgba(61,220,132,0.25), transparent 70%)",
  loseFlashOverlay: "radial-gradient(circle at 50% 30%, rgba(255,77,77,0.28), transparent 70%)",
};

// Deep matte felt green, mahogany rail, and a gold pushed slightly brighter
// than Classic's so it stays legible against green instead of near-black.
// Win flash moves to gold/white here — green-on-green wouldn't read at all.
const pokerTableTokens = {
  ...classicTokens,
  bg: "radial-gradient(ellipse at center, #1c5b43 0%, #0f4429 100%)",
  panel: "rgba(8, 30, 22, 0.55)",
  border: "#2f6b52",
  borderStrong: "#4f8d70",
  textSecondary: "#dce9e2",
  textMuted: "#a9c4b7",
  gold: "#f2c96b",
  goldSoft: "rgba(242, 201, 107, 0.16)",
  emberBorder: "#5c2420",
  tableFrameBorder: "10px solid #4a2c1a",
  tableFrameShadow: "inset 0 0 0 3px #7a5230, 0 8px 24px rgba(0,0,0,0.5)",
  winFlashOverlay: "radial-gradient(circle at 50% 30%, rgba(255,215,120,0.35), transparent 70%)",
};

export const THEMES = [
  {
    id: THEME_IDS.CLASSIC,
    name: "Classic",
    preview: { colors: ["#0e0e12", "#14161f", "#d4af6a"] },
    isUnlocked: () => true,
    unlockDescription: null,
    tokens: classicTokens,
  },
  {
    id: THEME_IDS.POKER_TABLE,
    name: "Poker Table",
    preview: { colors: ["#1c5b43", "#4a2c1a", "#f2c96b"] },
    // Piggybacks directly on the existing Single Deck unlock condition — one
    // achievement (10-hand win streak + Same + Red/Black at Double Suit), two rewards.
    isUnlocked: (ctx) => ctx.unlockedDecks.includes("single-deck"),
    unlockDescription: "Unlocks at Single Deck",
    tokens: pokerTableTokens,
  },
];

export function getTheme(id) {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

export function computeUnlockedThemes(ctx) {
  return THEMES.filter((t) => t.isUnlocked(ctx)).map((t) => t.id);
}
