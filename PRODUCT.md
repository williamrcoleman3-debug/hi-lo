# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Two audiences, roughly equal weight, sharing the same core loop:
- **Casual players** — play the free Higher/Lower/Same card game for its own sake: build streaks, bank tokens, chase the leaderboard, unlock avatars/decks.
- **Skill-focused players** — came for the $25,000 Win Streak contest and treat the game as an advantage-play challenge, actively card-counting to beat the static-baseline pricing.

Design and copy should serve both without splitting into two separate experiences (see Product Principles).

## Product Purpose

A free-to-play card-guessing game (call each dealt card Higher, Lower, or Same) with an ante/payout loop, a Blackjack side game, and a real skill-based cash contest layered on top. Success looks different per audience: an engaging, low-friction replay loop for casual players, and a legitimate, verifiably fair skill competition for players chasing the Grand Prize.

## Positioning

Skill-based, not chance-based: payouts price every call off a fresh full shoe (`static-baseline` pricing, see [src/engine/constants.js](src/engine/constants.js)), not the actual remaining deck — the gap between that price and the true remaining-deck odds is the exploitable skill (card counting). This is the mechanism a "spin the wheel" competitor couldn't truthfully copy.

Explicitly positioned against real-money gambling: tokens have no cash value and can never be purchased with real money under any circumstance (legal term of the contest — see project CLAUDE.md hard rules). The shuffle itself is provably fair (server-side CSPRNG, independently chi-square tested at scale) and that testing process is disclosed in-app rather than just asserted (Fairness screen) — transparency about randomness is part of the product's credibility, since the entire skill claim depends on the shuffle being fair and the edge coming only from memory/tracking.

## Operating Context

Vite/React/Supabase/Netlify web app, also shipped as an iOS app via a Capacitor wrapper around the same web build (not a native redesign — see [ios/](ios/), [capacitor.config.json](capacitor.config.json)).

Core loop: sign in → pick a deck → call each card against a countdown timer → build a Win Streak → bank tokens at an ante-scaled payout. Only "Single Deck" is currently active; Single Suit, Double Suit, and Double Deck exist fully built but are feature-flagged off ([src/engine/decks.js](src/engine/decks.js)). Deck unlocks require a 10-hand win streak on the prior deck.

Surrounding systems: Blackjack mini-game, Leaderboard (win-streak based; Single Deck specifically is the contest-eligible board), Lifelines (spend tokens to survive a miss, capped at 2/game), Unlocks (avatars, decks, Remove Ads IAP), Referrals, Stats, avatar/badge collection, an interstitial ad system, and legal/trust screens (Rules, Contest Rules, Fairness, Privacy).

Deck shuffling and outcome resolution run server-side only, never client-side — both a fairness guarantee and an anti-cheat requirement, since the contest's entire premise (skill, not chance) depends on the server being the sole source of truth for what was dealt.

## Capabilities and Constraints

- Tokens can never be bought with real money, directly or indirectly — a legal term of the $25,000 contest, not a product-team choice.
- Deck and outcome logic run on the server, never the browser.
- Rate limit: 10 requests/second/user, tied to the account, not IP. Daily limit: 100 games per deck per day.
- Contest period: August 24, 2026 – March 31, 2027 (11:59 PM ET). Win via (a) a full clear — 51 consecutive correct hands on Single Deck — or (b) holding the highest Win Streak at the deadline if no one clears. Ties split the prize equally.
- Contest eligibility is Single Deck only; the other three decks don't count toward the Grand Prize even when re-enabled.
- Any qualifying Win Streak triggers mandatory manual review (gameplay patterns, timing, account/referral history) before payout; bots/automation and multi-account referral farming are explicitly prohibited and enforced at review time, not just by technical blocking.
- Remove Ads is a separate real-money IAP (App Store/Play billing) — unrelated to and not in tension with the tokens-can't-be-purchased rule, since it grants no tokens, lifelines, or contest advantage.
- No purchase of any kind is required to enter, play, or win the contest.

## Brand Commitments

- Public-facing brand name: **Hi-Lo Same**. The repo/package name (`hilo-stakes`) and the current `index.html` title/meta ("Higher · Lower · Same") predate this confirmation and should not be treated as canonical for new work.
- "Halifax Water Co., DBA Hi-Lo-Stakes" is the legal contest-sponsor entity name used only in official contest-rules/legal text (see [src/components/ContestRulesScreen.jsx](src/components/ContestRulesScreen.jsx)) — it is not the consumer-facing brand and shouldn't surface in product UI/marketing copy.
- Existing logo asset at [assets/logo.png](assets/logo.png).

## Evidence on Hand

None yet — pre-launch/early stage. No real user counts, testimonials, press, or payout screenshots exist. Future design and copy work must not fabricate any of these.

## Product Principles

1. **Skill over chance, provably.** The pricing gap and the shuffle's fairness are the entire premise — keep both transparent and independently verifiable rather than just asserted.
2. **Never read as a real-money wager.** Tokens, ante, and payout language must stay unambiguously distinct from gambling, since that distinction is a legal requirement of the contest, not a style choice.
3. **One product, two audiences.** Casual replay value and serious contest pursuit share the same core loop and screens — don't fork the experience to serve one at the other's expense.
4. **Server is the sole authority.** Deck state and outcomes are never computed or trusted client-side; this is both a fairness and an anti-cheat requirement.
5. **Contest integrity is load-bearing.** Anti-bot, anti-multi-account, and manual-review mechanics are core product surface (Rules, Contest Rules, Fairness screens), not legal boilerplate bolted on.
