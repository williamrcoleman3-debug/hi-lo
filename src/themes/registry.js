// Single geometric sans-serif stack, used everywhere -- no web fonts, no
// serif headers, no monospace. Numbers that matter use font-variant-numeric:
// tabular-nums instead of a monospace family (see FONT_TABULAR).
export const FONT_STACK = '-apple-system, "Segoe UI", Roboto, sans-serif';
export const FONT_TABULAR = { fontFamily: FONT_STACK, fontVariantNumeric: "tabular-nums" };

// Dark, flat, fintech-dashboard palette. One theme -- there is no longer a
// Poker Table alternate (its felt-gradient/wooden-frame look was gradient-
// and-shadow-based, both banned by this redesign, and with only one theme
// left an equip/preview picker in Unlocks would just be clutter, so that UI
// was removed rather than kept for a single always-equipped entry).
const tokens = {
  bg: "#0B0E14",
  panel: "#151923",
  border: "#1E2430",
  borderStrong: "#2E3646",
  textPrimary: "#E7EAF0",
  textSecondary: "#A9B2C3",
  textMuted: "#7A8496",

  // Single accent -- replaces the old two-tier gold (primary)/teal
  // (secondary) split. Used for the streak number, links, active states,
  // and any primary CTA that isn't a game outcome.
  accent: "#2DD4BF",
  accentSoft: "rgba(45,212,191,0.12)",

  // Reserved exclusively for actual outcomes -- never used to pre-color a
  // call button, since correctness depends on the card drawn, not which
  // button was pressed.
  win: "#22C55E",
  winSoft: "rgba(34,197,94,0.12)",
  // Flat full-screen flash fill -- replaces the old radial-gradient flash
  // overlay (banned by the no-gradient rule), just a stronger flat alpha
  // than winSoft/loseSoft so it still reads as feedback in ~180ms.
  winFlash: "rgba(34,197,94,0.22)",
  lose: "#EF4444",
  loseSoft: "rgba(239,68,68,0.12)",
  loseFlash: "rgba(239,68,68,0.22)",

  // Caution/draft tone -- for notices that aren't a game outcome (daily
  // play-limit banner, legal-draft disclaimer) but shouldn't be neutral.
  caution: "#F59E0B",
  cautionSoft: "rgba(245,158,11,0.12)",

  cardFace: "#E7EAF0",
  cardInk: "#0B0E14",
  // Muted red for suit ink -- deliberately distinct from `lose` so a red
  // heart/diamond never reads as an alert.
  cardRedInk: "#B8464C",

  // The 5 call buttons each keep a distinct identity color, rendered as
  // solid fills. Same and Red are now the exact same hex as `win`/`lose`
  // respectively -- a deliberate choice (confirmed explicitly), not an
  // oversight; the earlier "never reuse the outcome colors on a button"
  // rule is intentionally relaxed here.
  callLower: "#F97316",
  callSame: "#22C55E", // same as win
  callHigher: "#A855F7",
  callRed: "#EF4444", // same as lose
  callBlack: "#111111",
  callBlackBorder: "#2C2C2A",
};

export const THEMES = [
  {
    id: "default",
    name: "Default",
    tokens,
  },
];

export function getTheme() {
  return THEMES[0];
}
