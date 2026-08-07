---
name: Hi-Lo Same
description: A flat, near-black trading-terminal console for a skill-based Higher/Lower/Same card game
colors:
  signal-teal: "#2DD4BF"
  signal-teal-soft: "rgba(45,212,191,0.12)"
  void: "#0B0E14"
  panel-ink: "#151923"
  hairline: "#1E2430"
  hairline-strong: "#2E3646"
  text-primary: "#E7EAF0"
  text-secondary: "#A9B2C3"
  text-muted: "#7A8496"
  ticker-green: "#22C55E"
  ticker-green-soft: "rgba(34,197,94,0.12)"
  ticker-green-flash: "rgba(34,197,94,0.22)"
  ticker-red: "#EF4444"
  ticker-red-soft: "rgba(239,68,68,0.12)"
  ticker-red-flash: "rgba(239,68,68,0.22)"
  warning-amber: "#F59E0B"
  warning-amber-soft: "rgba(245,158,11,0.12)"
  card-face: "#E7EAF0"
  card-ink: "#0B0E14"
  card-red-ink: "#B8464C"
  call-lower: "#F97316"
  call-same: "#22C55E"
  call-higher: "#A855F7"
  call-red: "#EF4444"
  call-black: "#111111"
  call-black-border: "#2C2C2A"
  bj-hit: "#2DD4BF"
  bj-hit-ink: "#00272E"
  bj-stand: "#378ADD"
  bj-stand-ink: "#042C53"
  bj-split: "#7F77DD"
  bj-split-ink: "#26215C"
  bj-double: "#EF9F27"
  bj-double-ink: "#412402"
typography:
  display:
    fontFamily: '-apple-system, "Segoe UI", Roboto, sans-serif'
    fontSize: "clamp(3rem, 8vw, 3.75rem)"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "normal"
  headline:
    fontFamily: '-apple-system, "Segoe UI", Roboto, sans-serif'
    fontSize: "clamp(1.5rem, 4vw, 1.875rem)"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  title:
    fontFamily: '-apple-system, "Segoe UI", Roboto, sans-serif'
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontFamily: '-apple-system, "Segoe UI", Roboto, sans-serif'
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: '-apple-system, "Segoe UI", Roboto, sans-serif'
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "0.1em"
rounded:
  sm: "8px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  container: "896px"
components:
  button-primary:
    backgroundColor: "{colors.signal-teal}"
    textColor: "{colors.card-ink}"
    rounded: "{rounded.sm}"
    padding: "12px 16px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.sm}"
    padding: "12px 16px"
  card-face:
    backgroundColor: "{colors.card-face}"
    textColor: "{colors.card-ink}"
    rounded: "{rounded.sm}"
  input-field:
    backgroundColor: "{colors.void}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.sm}"
    padding: "8px 12px"
---

# Design System: Hi-Lo Same

## Overview

**Creative North Star: "The Trading Terminal"**

Hi-Lo Same reads as a dense, flat, dark console built for someone executing a fast decision under real stakes — not a game skin, not a casino face. Numbers move like live prices: every value that can change (streak, vault, timer, ante, odds) renders in tabular numerals so nothing jitters as digits shift. Uppercase micro-labels ("streak," "cards left in the shoe," "house edge") sit above the numbers they describe, exactly like a terminal's status strip.

The mood is tense, alert, high-stakes. A six-second countdown bar shifts from Signal Teal through Warning Amber to Ticker Red as time runs out; the streak number's glow intensifies with each consecutive win (capped at streak 10 so it never runs away); a bust triggers an instant full-screen red flash plus a screen-shake, a win an instant green flash — feedback lands in under 200ms so a player never loses the thread of the shoe mid-decision. Every control confirms a tap by scaling to 95%, the system's one interactive motion beyond color and opacity.

This is a confirmed rejection, not a gap: an earlier "Poker Table" theme (felt-gradient background, wooden-frame chrome) was removed outright. No gradients, no felt, no wood grain, no drop shadows exist anywhere in the current system — depth comes from flat surface layering and border weight only, never from simulated light.

**Key Characteristics:**
- Near-black flat surfaces, one signal-teal accent used sparingly
- Tabular numerals on every value that can change
- Solid-fill, fixed-identity color coding (outcomes vs. call buttons vs. status)
- Tactile tap-down confirmation (active:scale-95) on every control, no hover-only affordances
- Zero gradients, zero shadows, by explicit design history

## Colors

A near-black, single-accent palette where color is a signal, not decoration: most of the screen stays inert dark neutral so the few colors that do appear — the teal accent, the outcome green/red, the five fixed call-button identities — read instantly as meaningful.

### Primary
- **Signal Teal** (`#2DD4BF`): the app's one "alive" accent — the streak/vault number, primary CTAs (Bank, Share, Redeem lifeline), active/selected states (selected deck chip, active tab, focused card-back mark). Paired with **Signal Teal Soft** (`rgba(45,212,191,0.12)`) as its low-opacity fill behind selected chips and the site banner.

### Neutral
- **Void** (`#0B0E14`): page background; also the ink color on solid-fill buttons.
- **Panel Ink** (`#151923`): every card/panel surface, one flat step off Void.
- **Hairline** (`#1E2430`): default 1px/2px border — the primary way surfaces separate from each other.
- **Hairline Strong** (`#2E3646`): emphasized border for ghost buttons and the ante/ratio strip.
- **Text Primary** (`#E7EAF0`) / **Text Secondary** (`#A9B2C3`) / **Text Muted** (`#7A8496`): a three-step text hierarchy, each one step quieter.

### Semantic (Outcome & Status)
- **Ticker Green** (`#22C55E`) / Soft (`rgba(34,197,94,0.12)`) / Flash (`rgba(34,197,94,0.22)`): reserved exclusively for a confirmed outcome (a hand won, a game cashed) — never used to pre-color a call button, since correctness depends on the card drawn, not which button was pressed.
- **Ticker Red** (`#EF4444`) / Soft / Flash (mirrored): the bust/loss counterpart, same rule.
- **Warning Amber** (`#F59E0B`) / Soft (`rgba(245,158,11,0.12)`): caution notices that aren't a game outcome — the daily play-limit banner, legal-draft disclaimers.

### Call Identity Colors
Each of the five call buttons carries a fixed, distinct solid-fill identity, decided before any card is drawn: **Call Lower** (`#F97316`), **Call Same** (`#22C55E`, intentionally identical to Ticker Green), **Call Higher** (`#A855F7`), **Call Red** (`#EF4444`, intentionally identical to Ticker Red), **Call Black** (`#111111` on a `#2C2C2A` border). The Same/Red reuse of the outcome hexes is a deliberate, confirmed exception to the outcome-only rule below — the other three colors never appear elsewhere. Playing-card ink splits into **Card Face** (`#E7EAF0`) / **Card Ink** (`#0B0E14`) for rank/suit glyphs, with a separate **Card Red Ink** (`#B8464C`) for hearts/diamonds so a red suit is never mistaken for the Ticker Red alert color.

### Named Rules
**The Outcome-Only Rule.** Ticker Green and Ticker Red mean "this hand is resolved" — never a preview or a prediction. A call button's color is fixed identity, not a hint about whether it will win.

**The One Signal Rule.** Signal Teal is the only color that means "alive / actionable." Everything else is inert neutral, a fixed outcome color, or a fixed identity color — never a second free-floating accent.

## Typography

**Display / Body / Label Font:** `-apple-system, "Segoe UI", Roboto, sans-serif` — one system sans stack, no web fonts loaded anywhere in the app.

**Character:** A single geometric system sans carries the entire product; the only typographic "voice" shifts are weight, case, and tracking — display headlines are tight and heavy, labels are wide-tracked uppercase caps, and every number that matters renders with `font-variant-numeric: tabular-nums` so it holds its column width like a price ticker as digits change.

### Hierarchy
- **Display** (700, ~48–60px clamp, leading-none): the dealt card's rank and suit — the single largest thing on any screen.
- **Headline** (700, ~24–30px, tight tracking): screen titles ("Hi-Lo", "Rules," "Fairness & Randomness").
- **Title** (600, 14px): panel/section sub-headers, button labels.
- **Body** (400, 14px, relaxed leading): descriptive copy and rules paragraphs (capped near 65–75ch on the desktop rules text).
- **Label** (600, 12px, 0.1em tracking, uppercase): stat labels ("streak," "cards left in the shoe," "house edge") and the odds percentage under each call button.

### Named Rules
**The Tabular Numerals Rule.** Every number that can change in place — streak, vault, timer, ante, odds, cards-left — renders with tabular numerals, so surrounding layout never shifts as digits change width.

## Layout

Every screen sits in a centered `max-w-4xl` (896px) container with consistent `mb-6`-scale vertical rhythm between major blocks. The game screen's core is a two-column grid (`1fr auto`) splitting the table from the leaderboard/stats rail on desktop, collapsing to one stacked column below the 640px breakpoint. Control rows (call buttons, deck chips) are always CSS grid (`grid-cols-2` / `grid-cols-3`), never flex-wrap, so button sizing stays uniform regardless of label length. The outer shell carries safe-area-aware padding (`env(safe-area-inset-*)`) for the native iOS wrapper, and a fixed 320×100 ad slot is reserved on mobile specifically to guarantee zero layout shift once ads load.

## Elevation & Depth

Flat, by explicit design history: no `box-shadow` and no gradient exist anywhere in the current system — an earlier "Poker Table" theme with a felt gradient and wooden-frame chrome was removed specifically because both are banned by this redesign. Depth is conveyed only through flat surface layering (Void → Panel Ink) and border weight (1px Hairline for passive containers vs. 2px Hairline Strong for anything that needs to command more attention), never through simulated light. The one deliberate exception is a soft `text-shadow` glow on the streak number that intensifies with consecutive wins — a single-purpose momentum cue, not a general elevation device.

### Named Rules
**The Flat-By-Default Rule.** No box-shadow, no gradient, anywhere, under any circumstance. State and hierarchy are communicated with color, border weight, and flat layering only.

## Shapes

Two radii, system-wide: **8px** (`rounded-lg`) on every button, card, panel, chip, and input, and a **full pill** radius on the timer/progress-bar track only. Borders are the primary form language rather than corners or shadows — 1px for passive/informational surfaces (message strips, mini history cards), 2px for anything interactive or emphasized (ghost-button outlines, the live card's frame, a selected deck chip, the active tab). No clipping, no cut corners, no asymmetric silhouettes anywhere in the system.

## Components

### Buttons
- **Shape:** 8px radius everywhere; ghost buttons keep the same radius, trading a fill for a 2px Hairline Strong outline.
- **Primary:** Signal Teal fill, Card Ink text — Bank, Share, Redeem lifeline, and any CTA that isn't a game outcome.
- **Ghost:** transparent background, 2px Hairline Strong border, Text Primary — "Start new game," "No, bust," any secondary path out of a decision.
- **Call identity:** solid fill in the button's fixed Call Identity Color, Card Ink text (Call Black uses Text Primary instead, since its own fill is near-black); each shows a small tabular-num odds percentage beneath its label, greyed to 30% opacity only when the call is structurally impossible.
- **Tap feedback:** every button scales to 95% on `:active` — the only interactive motion besides color/opacity change, and the sole affordance the system relies on, since the product runs inside a touch-first native wrapper with no hover state.

### Cards (playing cards)
- **Corner Style:** 8px radius, matching buttons.
- **Background:** Card Face with a 2px Hairline border for a live card; Panel Ink with a 2px Signal Teal border plus the crosshair mark for a card back.
- **Shadow Strategy:** none (see Elevation & Depth) — a brief scale/opacity "pop" animation on deal is the only depth cue.
- **Ink:** Card Ink for black suits, Card Red Ink for red suits — deliberately distinct from Ticker Red so a heart or diamond never reads as an alert.

### Chips (deck switcher, tab nav)
- **Style:** 2px border, transparent background at rest; the selected state fills with Signal Teal Soft behind Signal Teal text and border.
- **State:** a locked chip drops to 55% opacity, shows a lock glyph, and prints its unlock requirement as a caption line beneath the label.

### Inputs / Fields
- **Style:** 1px Hairline border, Void background, Text Primary value text, 8px radius.
- **Validation:** an inline caption line beneath the field switches to Ticker Red text on a taken or invalid value; the border color itself never changes.

### Navigation
- Same chip language as everywhere else: the active tab gets 2px Signal Teal + Signal Teal Soft; inactive tabs get 2px Hairline + Text Muted. Overflow items collapse into a bordered "More" dropdown on a Void background.

### Panels & Messages (signature pattern)
Every informational surface — rules sections, contest-rules sections, the in-game status strip, the site banner — shares one template: a 1px border in a state-appropriate color, a matching `*-soft` background tint, and the same color again for its text. Border, background, and text move together as one matched trio; the system never introduces a state color in only one of the three.

## Do's and Don'ts

### Do:
- **Do** keep Signal Teal to the "one live thing" role — CTA, selection, and positive momentum only. If a screen has two teal elements competing for attention, one of them is wrong.
- **Do** pair every state color as a matched border + soft-background + text trio in the same hue, rather than introducing a fourth new tint.
- **Do** render every number that can change with tabular numerals (The Tabular Numerals Rule).
- **Do** keep every button's radius at 8px and its tap feedback at `active:scale-95` — the tactile, confident feel depends on that consistency, not on per-button flourish.
- **Do** reserve Ticker Green and Ticker Red for confirmed outcomes only, never as a preview of an unresolved call.

### Don't:
- **Don't** add `box-shadow` or a gradient anywhere — both are explicitly banned by this system's own redesign history (the felt/gradient "Poker Table" theme was removed for exactly this reason).
- **Don't** introduce a second accent color alongside Signal Teal; anything new that needs emphasis borrows Signal Teal or gets a fixed semantic/identity color, never a new hue.
- **Don't** color a call button to hint at whether it's likely to win — its color is fixed identity, chosen before any card is drawn.
- **Don't** rely on a hover-only affordance as the sole way to discover a control — the product ships inside a touch-first native wrapper with no hover state.
- **Don't** render a heart or diamond suit in Ticker Red — Card Red Ink exists specifically so a red card is never mistaken for an alert.
