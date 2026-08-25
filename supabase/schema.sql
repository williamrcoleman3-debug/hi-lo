-- Hi-Lo Stakes — Phase 4 schema.
-- Run this once in the Supabase Dashboard: your project -> SQL Editor -> New query -> paste -> Run.

-- =============================================================================
-- CONTEST INTEGRITY — LEGALLY REQUIRED, NOT A DESIGN PREFERENCE
--
-- The $25,000 contest is legally approved ONLY on the condition that players
-- never pay real money for anything that improves their chances of winning.
-- This means:
--
--   * Tokens must NEVER be purchasable with real currency, under any
--     circumstance, present or future.
--   * Any future monetization feature (ads, purchases, subscriptions, etc.)
--     must be reviewed against this constraint BEFORE implementation, not
--     after.
--   * This applies even to indirect paths (e.g. "buy tokens, redeem for
--     lifelines" violates this just as much as buying lifelines directly).
--
-- If in doubt whether a proposed feature crosses this line, treat it as
-- BLOCKED pending explicit legal review, not as a judgment call to make
-- unilaterally.
-- =============================================================================

-- profiles: one row per authenticated user, created on first sign-in.
-- Username uniqueness is enforced case-insensitively (see the index below)
-- so "Will" and "will" can't both exist as distinct, confusable usernames.
--
-- current_streak/longest_streak/last_banked_date track the account-wide
-- Daily Streak (not tied to any one deck) — consecutive UTC calendar days
-- on which the player banked at least once, on any deck. Maintained only by
-- record_game_end() below, computed from the server clock, never trusted
-- from the client.
--
-- equipped_theme is a plain preference (last write wins, no concurrent
-- arithmetic like the streak/score columns) — updated via a direct client
-- update to this table, covered by the existing "update their own profile"
-- policy below, no RPC needed. Which themes are UNLOCKED is never stored:
-- it's derived from unlockedDecks (already synced via deck_progress), so
-- there's nothing here that could drift out of sync with deck progress.
--
-- is_contest_banned is a manually-set admin flag (set directly via SQL,
-- no detection logic or admin UI in this pass) — excludes a user from the
-- Single Deck Win Streak leaderboard specifically (see the view below),
-- without otherwise restricting their account.
--
-- Referral + lifeline columns:
--   referred_by             — set once, at signup, via attribute_referral()
--                             below. First attribution wins; never overwritten.
--   has_banked_ever         — flips true on this account's first-ever Bank.
--                             Informational only — NOT what gates the
--                             referral reward (see has_played_ever below).
--   has_played_ever         — flips true on this account's first-ever
--                             COMPLETED GAME (bust or bank, whichever comes
--                             first). This is what gates the referral
--                             reward — a referred user only ever pays out
--                             their referrer once, on their very first
--                             game, regardless of outcome.
--   referral_reward_granted — guards that one-time payout specifically (set
--                             on the REFERRED user's own row).
--   referred_signups_count  — raw count of accounts created via this user's
--                             referral link, qualified or not.
--   qualified_referral_count — count of those signups that went on to
--                             complete at least one game, bust or bank
--                             (email verification is implicit under our
--                             OTP-only auth — there's no unverified-email
--                             state to check separately).
--                             DELIBERATE TRADEOFF: this bar used to require
--                             an actual Bank (at least one correct call).
--                             Loosened to "any completed game" so a single
--                             tap-and-bust now qualifies — meaningfully
--                             easier to farm with throwaway accounts than
--                             before, which the bank requirement was
--                             specifically there to prevent. Accepted for
--                             now; revisit if farming is actually observed,
--                             not engineered against preemptively. See
--                             record_game_end() below for where this is
--                             enforced, and referrer_engagement further
--                             down for a way to manually spot-check it.
--   lifeline_balance        — spendable "Save the Game" lifeline count.
--                             New accounts start with 10, free.
--   is_admin                — manually-set admin flag, same pattern as
--                             is_contest_banned above (set directly via SQL,
--                             no detection logic or admin UI). Exempts the
--                             account from the daily play limit (see
--                             check_daily_play_limit() below) entirely.
--                             Deliberately NOT wired into anything else
--                             (leaderboard display, lifelines, etc.) --
--                             contest-winner eligibility for admin accounts
--                             is enforced manually during the review
--                             process, not in code.
--   spendable_tokens        — a SEPARATE pooled balance from
--                             leaderboard_scores.cumulative_banked (which
--                             must never decrease — it's the permanent
--                             Total Token Score record). This one increases
--                             on the same Bank event, but decreases by
--                             10,000 when redeem_lifeline() is called;
--                             spending it never touches any leaderboard.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  -- 2-16 chars, English letters only -- client mirrors this pattern for
  -- instant feedback (see AuthWidget.jsx), but this constraint is the real
  -- gate. avatar is one of the curated AVATARS list (src/avatars/
  -- registry.js), not free-choice -- not worth enforcing membership in that
  -- exact list server-side, since an off-list value is harmless (just an
  -- unexpected emoji rendered back to the same account that set it).
  username text not null check (char_length(username) between 2 and 16 and username ~ '^[A-Za-z]+$'),
  avatar text not null default '😀',
  -- Pacing/mechanic preference, not a race-sensitive value -- same "direct
  -- client update, no RPC" pattern as equipped_theme below. 'bank' is
  -- today's game unchanged (Bank anytime, win pauses briefly). 'speed' has
  -- no pause and no voluntary banking -- a game can only end by busting or
  -- fully clearing the deck. Read by start_game() to set game_sessions.
  -- speed_mode, which is what actually enforces the no-banking restriction
  -- server-side -- this column alone is just the player's stored preference.
  game_mode text not null default 'bank' check (game_mode in ('bank', 'speed')),
  current_streak integer not null default 0,
  longest_streak integer not null default 0,
  last_banked_date date,
  equipped_theme text not null default 'classic',
  is_contest_banned boolean not null default false,
  is_admin boolean not null default false,
  referred_by uuid references public.profiles (id),
  has_banked_ever boolean not null default false,
  has_played_ever boolean not null default false,
  referral_reward_granted boolean not null default false,
  referred_signups_count integer not null default 0,
  qualified_referral_count integer not null default 0,
  lifeline_balance integer not null default 10,
  spendable_tokens bigint not null default 0,
  created_at timestamptz not null default now()
);

create unique index profiles_username_lower_idx on public.profiles (lower(username));

alter table public.profiles enable row level security;

create policy "profiles are publicly readable"
  on public.profiles for select
  using (true);

create policy "users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- deck_progress: per-user, per-deck unlock-gating state (best win streak,
-- Same/Red-Black hits, longest-shot odds), plus games_played/hands_won —
-- lifetime counters, not "bests" — which feed the Games Played stat and the
-- Total Hands Won leaderboard (summed across decks, see the view below).
-- Not public — only its own owner can read it. All writes go through
-- record_deck_progress()/record_game_end() below, never direct table
-- access, so there are no insert/update policies at all.
create table public.deck_progress (
  user_id uuid not null references public.profiles (id) on delete cascade,
  deck_id text not null,
  best_win_streak integer not null default 0,
  same_hit boolean not null default false,
  red_black_hit boolean not null default false,
  lowest_odds_same_hit double precision,
  games_played integer not null default 0,
  hands_won integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, deck_id)
);

alter table public.deck_progress enable row level security;

create policy "users can read their own deck progress"
  on public.deck_progress for select
  using (auth.uid() = user_id);

-- leaderboard_scores: per-user, per-deck. Two independent metrics:
--   cumulative_banked — lifetime sum of amounts actually locked in via Bank.
--                       Only ever increases; busted games never add to it.
--   peak_score        — the highest `banked` value any single game of theirs
--                       ever reached, whether that game ended in a Bank or a
--                       Bust. Updates in both cases — that's the point of it.
-- Publicly readable (the leaderboard itself needs no account to view). All
-- writes go through record_game_end() below, never direct table access, so
-- there are no insert/update policies at all.
create table public.leaderboard_scores (
  user_id uuid not null references public.profiles (id) on delete cascade,
  deck_id text not null,
  cumulative_banked bigint not null default 0,
  peak_score bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, deck_id)
);

alter table public.leaderboard_scores enable row level security;

create policy "leaderboard scores are publicly readable"
  on public.leaderboard_scores for select
  using (true);

-- daily_activity: one row per user per UTC calendar day they completed at
-- least one Game (Bank OR Bust — unlike the Daily Streak above, which only
-- advances on Bank). Pure backend retention logging — no client reads this,
-- no UI surfaces it. Populated by record_game_end() below (unconditionally,
-- on every completed game), on conflict do nothing so repeat completions the
-- same day are a no-op. Query D1/D7/D30 retention via the views further down
-- (user_first_activity, retention_by_cohort) straight from the SQL editor.
create table public.daily_activity (
  user_id uuid not null references public.profiles (id) on delete cascade,
  activity_date date not null,
  primary key (user_id, activity_date)
);

alter table public.daily_activity enable row level security;
revoke all on public.daily_activity from anon, authenticated;

-- Atomically records one game's end (Bank or Bust). SECURITY DEFINER lets
-- this bypass RLS to perform the upsert, but it always operates on
-- auth.uid() internally — never a client-supplied user id — so a caller can
-- only ever affect their own row despite the function's elevated privilege.
--
-- On an actual Bank (not a Bust), this also advances the account-wide Daily
-- Streak, using the server's own clock (UTC calendar date) — never a
-- client-reported date, which would be trivially fakeable. Same-day repeat
-- banks are a no-op; a gap of exactly one day increments the streak; any
-- bigger gap (or no prior record) resets it to 1 for today.
--
-- Returns whether this game's amount was a new personal peak for the deck
-- (Leaderboard B territory) — the share feature leans on this to pick
-- peak-framed text over the default bank/bust text, without a separate
-- client-side read-then-compare (which could race).
--
-- On an actual Bank, this also adds to spendable_tokens (the lifeline-
-- redemption pool — separate from cumulative_banked, which must never
-- decrease). And, regardless of Bank or Bust, the FIRST time this account
-- ever completes a game at all, pays out a one-time referral reward (5
-- lifelines + a qualified-referral credit) to whoever referred them, if
-- anyone did and it hasn't already been paid — deliberately not gated on
-- banking, just on having played one game, ever.
create function public.record_game_end(
  p_deck_id text,
  p_amount bigint,
  p_was_banked boolean
) returns table (is_new_peak boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'utc')::date;
  v_last date;
  v_current int;
  v_longest int;
  v_gap int;
  v_prev_peak bigint;
  v_had_played_before boolean;
  v_referred_by uuid;
  v_reward_granted boolean;
begin
  if auth.uid() is null then
    raise exception 'must be signed in';
  end if;

  -- Retention logging: every completed game (bust or bank) counts as this
  -- user being "active" today, regardless of what happens below.
  insert into public.daily_activity (user_id, activity_date)
  values (auth.uid(), v_today)
  on conflict (user_id, activity_date) do nothing;

  select peak_score into v_prev_peak
    from public.leaderboard_scores
   where user_id = auth.uid() and deck_id = p_deck_id;

  -- Games Played counts every completed game (bust or bank) — increment
  -- regardless of outcome. deck_progress may not have a row yet for this
  -- deck if the player has never landed a correct hand on it.
  insert into public.deck_progress (user_id, deck_id, games_played, updated_at)
  values (auth.uid(), p_deck_id, 1, now())
  on conflict (user_id, deck_id) do update set
    games_played = public.deck_progress.games_played + 1,
    updated_at = now();

  insert into public.leaderboard_scores (user_id, deck_id, cumulative_banked, peak_score, updated_at)
  values (
    auth.uid(),
    p_deck_id,
    case when p_was_banked then p_amount else 0 end,
    p_amount,
    now()
  )
  on conflict (user_id, deck_id) do update set
    cumulative_banked = public.leaderboard_scores.cumulative_banked
      + (case when p_was_banked then p_amount else 0 end),
    peak_score = greatest(public.leaderboard_scores.peak_score, p_amount),
    updated_at = now();

  -- One-time referral payout: on this account's very first completed game
  -- EVER (bust or bank, whichever comes first) — independent of the
  -- p_was_banked branch below, which only handles Daily Streak /
  -- spendable_tokens.
  --
  -- DELIBERATE TRADEOFF, going forward only (not retroactive — this only
  -- ever evaluates a given account's own first game, whenever that happens
  -- to occur): this used to require a Bank specifically. Gating on ANY
  -- completed game instead is a known, accepted loosening — busting takes
  -- zero skill and one tap, so this reopens some of the throwaway-account
  -- referral-farming risk the bank requirement was there to prevent. Not
  -- engineered against preemptively; revisit only if farming is actually
  -- observed. See referrer_engagement (further down) for a way to manually
  -- spot-check a referrer's signups-vs-qualified ratio.
  --
  -- `for update` locks this user's own row for the has_played_ever /
  -- referral_reward_granted check — without it, two concurrent calls for
  -- the same account's first-ever game (e.g. the same account open in two
  -- tabs, each finishing a game at nearly the same moment) could both read
  -- the flags as not-yet-set before either commits, and both pay out the
  -- referrer. The lock serializes them: the second call blocks until the
  -- first commits, then correctly sees the flags already set and no-ops.
  select has_played_ever, referred_by, referral_reward_granted
    into v_had_played_before, v_referred_by, v_reward_granted
    from public.profiles
   where id = auth.uid()
   for update;

  if not coalesce(v_had_played_before, false) then
    update public.profiles set has_played_ever = true where id = auth.uid();

    if v_referred_by is not null and not coalesce(v_reward_granted, false) then
      update public.profiles set referral_reward_granted = true where id = auth.uid();
      update public.profiles
         set lifeline_balance = lifeline_balance + 5,
             qualified_referral_count = qualified_referral_count + 1
       where id = v_referred_by;
    end if;
  end if;

  if p_was_banked then
    select last_banked_date, current_streak, longest_streak
      into v_last, v_current, v_longest
      from public.profiles
     where id = auth.uid();

    -- spendable_tokens/has_banked_ever always update on any bank, regardless
    -- of the daily-streak gap below.
    update public.profiles
       set spendable_tokens = spendable_tokens + p_amount,
           has_banked_ever = true
     where id = auth.uid();

    v_gap := case when v_last is null then null else v_today - v_last end;

    if v_gap = 0 then
      null; -- already banked today; streak unchanged
    else
      v_current := case when v_gap = 1 then coalesce(v_current, 0) + 1 else 1 end;
      v_longest := greatest(coalesce(v_longest, 0), v_current);

      update public.profiles
         set current_streak = v_current,
             longest_streak = v_longest,
             last_banked_date = v_today
       where id = auth.uid();
    end if;
  end if;

  return query select (p_amount > coalesce(v_prev_peak, 0));
end;
$$;

revoke all on function public.record_game_end(text, bigint, boolean) from public;
grant execute on function public.record_game_end(text, bigint, boolean) to authenticated;

-- Atomically folds one correct call (hand)'s result into deck_progress,
-- mirroring the pure fold in src/persistence/progress.js#applyCorrectCall.
-- Same SECURITY DEFINER + auth.uid()-only pattern as record_game_end above.
create function public.record_deck_progress(
  p_deck_id text,
  p_win_streak integer,
  p_same_hit boolean,
  p_red_black_hit boolean,
  p_same_odds double precision
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'must be signed in';
  end if;

  insert into public.deck_progress (user_id, deck_id, best_win_streak, same_hit, red_black_hit, lowest_odds_same_hit, hands_won, updated_at)
  values (
    auth.uid(),
    p_deck_id,
    p_win_streak,
    p_same_hit,
    p_red_black_hit,
    case when p_same_hit then p_same_odds else null end,
    1,
    now()
  )
  on conflict (user_id, deck_id) do update set
    best_win_streak = greatest(public.deck_progress.best_win_streak, p_win_streak),
    same_hit = public.deck_progress.same_hit or p_same_hit,
    red_black_hit = public.deck_progress.red_black_hit or p_red_black_hit,
    lowest_odds_same_hit = case
      when p_same_hit and public.deck_progress.lowest_odds_same_hit is null then p_same_odds
      when p_same_hit then least(public.deck_progress.lowest_odds_same_hit, p_same_odds)
      else public.deck_progress.lowest_odds_same_hit
    end,
    hands_won = public.deck_progress.hands_won + 1,
    updated_at = now();
end;
$$;

revoke all on function public.record_deck_progress(text, integer, boolean, boolean, double precision) from public;
grant execute on function public.record_deck_progress(text, integer, boolean, boolean, double precision) to authenticated;

-- Attributes a new signup to whoever referred them, via the referrer's
-- username (captured from the ?ref= link at signup time — see
-- src/referral/referral.js). First attribution wins: a no-op if this
-- account's referred_by is already set, so it can't be re-triggered to
-- inflate a referrer's count. Self-referral is rejected. Does not require
-- being signed in via a special role — any authenticated user can attribute
-- their OWN signup (auth.uid()), never someone else's.
--
-- The check-then-act here (read referred_by, decide, then write) would race
-- if this ever fired twice concurrently for the same account — both calls
-- could read referred_by as still null before either commits, and both
-- would then increment referred_signups_count on a referrer. `for update`
-- locks this user's own row for the check, so a second concurrent call
-- blocks until the first commits, then correctly sees referred_by already
-- set and no-ops.
--
-- Also pays the REFERRED account a one-time +10 lifeline signup bonus on
-- success — separate from, and not gated on, the referrer's own one-time
-- reward (paid later, on the referred account's first completed game, by
-- finalize_session). Guarded by the same v_already_referred / `for update`
-- lock as referred_by itself, so it can never be granted twice.
create function public.attribute_referral(p_referrer_username text) returns table (success boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_referrer_id uuid;
  v_already_referred boolean;
begin
  if auth.uid() is null then
    raise exception 'must be signed in';
  end if;
  perform public.check_rate_limit();

  select referred_by is not null into v_already_referred
    from public.profiles
   where id = auth.uid()
   for update;
  if coalesce(v_already_referred, false) then
    return query select false;
    return;
  end if;

  select id into v_referrer_id from public.profiles where lower(username) = lower(p_referrer_username);
  if v_referrer_id is null or v_referrer_id = auth.uid() then
    return query select false;
    return;
  end if;

  update public.profiles set referred_by = v_referrer_id where id = auth.uid();
  update public.profiles set lifeline_balance = lifeline_balance + 10 where id = auth.uid();
  update public.profiles set referred_signups_count = referred_signups_count + 1 where id = v_referrer_id;

  return query select true;
end;
$$;

revoke all on function public.attribute_referral(text) from public, anon, authenticated;
grant execute on function public.attribute_referral(text) to authenticated;

-- Lets the Sign Up flow (AuthWidget's Instructions screen) ask "has this
-- email actually been confirmed yet?" without establishing a session --
-- see useAuth.js's signUpWithEmail, which deliberately never tries to
-- complete a session from the confirmation-link tap itself (confirmed
-- unreliable on-device, see referral.js). There is no session at this
-- point (auth.uid() is null), so this can't be gated the way
-- attribute_referral is -- it has to be callable by the anon role, keyed
-- on the plain email address instead.
--
-- Returns a bare boolean, nothing else -- deliberately the same false for
-- "no account with this email" and "account exists but not confirmed yet,"
-- so a caller can't use this to enumerate which emails have accounts, only
-- whether a specific given email is confirmed. There is no rate limiting
-- on this function -- check_rate_limit() requires auth.uid(), which isn't
-- available pre-session, so it can't be reused here. Flagged as a known,
-- accepted gap for now: worst case is an unauthenticated caller batch-
-- checking guessed emails' confirmation status, which reveals account
-- existence one bit at a time but touches no game/contest/money state.
create or replace function public.is_email_confirmed(p_email text) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_confirmed boolean;
begin
  select (email_confirmed_at is not null) into v_confirmed
    from auth.users
   where lower(email) = lower(p_email)
   limit 1;
  return coalesce(v_confirmed, false);
end;
$$;

revoke all on function public.is_email_confirmed(text) from public, authenticated;
grant execute on function public.is_email_confirmed(text) to anon, authenticated;

-- Redeems 10,000 spendable_tokens for one lifeline. spendable_tokens is a
-- separate pool from the permanent Total Token Score record
-- (leaderboard_scores.cumulative_banked), which this never touches.
--
-- BUG FIX: this function's RETURNS TABLE names two OUT parameters
-- (lifeline_balance, spendable_tokens) that are ALSO real column names on
-- profiles. PL/pgSQL exposes OUT parameters as variables visible inside the
-- function body, so an unqualified `lifeline_balance` or `spendable_tokens`
-- in a query is ambiguous between "the OUT param" and "the profiles
-- column" — Postgres raises "column reference ... is ambiguous" and the
-- whole call errors. The UPDATE's SET clause now qualifies the right-hand
-- side with public.profiles.<col> to force it to mean the column, not the
-- OUT param.
create function public.redeem_lifeline() returns table (success boolean, lifeline_balance integer, spendable_tokens bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tokens bigint;
  v_cost constant bigint := 10000;
begin
  if auth.uid() is null then
    raise exception 'must be signed in';
  end if;
  perform public.check_rate_limit();

  select p.spendable_tokens into v_tokens from public.profiles p where p.id = auth.uid();

  if v_tokens < v_cost then
    return query select false, (select p.lifeline_balance from public.profiles p where p.id = auth.uid()), v_tokens;
    return;
  end if;

  update public.profiles
     set spendable_tokens = public.profiles.spendable_tokens - v_cost,
         lifeline_balance = public.profiles.lifeline_balance + 1
   where id = auth.uid();

  return query
    select true, p.lifeline_balance, p.spendable_tokens from public.profiles p where p.id = auth.uid();
end;
$$;

revoke all on function public.redeem_lifeline() from public, anon, authenticated;
grant execute on function public.redeem_lifeline() to authenticated;

-- Spends one lifeline from the account balance (the per-game cap of 2 is
-- enforced client-side in useGame, since it's per-game session state, not
-- account state). Atomic so two tabs can't both spend the same last lifeline.
--
-- BUG FIX: same ambiguous-column issue as redeem_lifeline() above —
-- `lifeline_balance` is both an OUT parameter and a profiles column, so the
-- UPDATE's unqualified RHS was ambiguous and errored on every call. This is
-- what made "Save the Game" appear to do nothing: the client's onUseLifeline
-- call always failed, so useGame.js's useLifeline() always fell through to
-- its failure branch and busted normally.
create function public.use_lifeline() returns table (success boolean, lifeline_balance integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance integer;
begin
  if auth.uid() is null then
    raise exception 'must be signed in';
  end if;
  perform public.check_rate_limit();

  select p.lifeline_balance into v_balance from public.profiles p where p.id = auth.uid();

  if coalesce(v_balance, 0) <= 0 then
    return query select false, coalesce(v_balance, 0);
    return;
  end if;

  update public.profiles set lifeline_balance = public.profiles.lifeline_balance - 1 where id = auth.uid();

  return query select true, p.lifeline_balance from public.profiles p where p.id = auth.uid();
end;
$$;

revoke all on function public.use_lifeline() from public, anon, authenticated;
grant execute on function public.use_lifeline() to authenticated;

-- Leaderboard 1 (primary, contest-tracked): best-ever Win Streak on Single
-- Deck only — 51 consecutive correct hands clears the contest record.
-- Excludes is_contest_banned users (Phase 4 enforcement).
--
-- Deliberately a SECURITY DEFINER FUNCTION, not a bare view — both bypass
-- deck_progress's own-row-only RLS the same way (necessary: a public
-- leaderboard has to show everyone's data, not just the querying user's
-- row), but a view doing this silently is exactly what Supabase's security
-- linter flags as fragile — anyone editing the view later (e.g. widening
-- its select list) would keep bypassing RLS with no explicit signal. A
-- function makes the intentional bypass explicit and keeps its exposed
-- columns fixed by its RETURNS TABLE signature.
create function public.get_single_deck_win_streak_leaderboard()
returns table (username text, avatar text, best_win_streak integer, updated_at timestamptz)
language sql
security definer
set search_path = public
stable
as $$
  select p.username, p.avatar, dp.best_win_streak, dp.updated_at
    from public.deck_progress dp
    join public.profiles p on p.id = dp.user_id
   where dp.deck_id = 'single-deck'
     and dp.best_win_streak > 0
     and p.is_contest_banned = false
   order by dp.best_win_streak desc
   limit 25;
$$;

revoke all on function public.get_single_deck_win_streak_leaderboard() from public;
grant execute on function public.get_single_deck_win_streak_leaderboard() to anon, authenticated;

-- Leaderboard 2: hands won on Single Deck. Was summed across all four
-- decks back when all four were active/reachable; now that only Single
-- Deck is (see engine/decks.js's ACTIVE_DECKS), filtered down to just that
-- deck so the number means what the label says. Not affected by
-- is_contest_banned (that exclusion is Single Deck Win Streak only).
-- Revert the deck_id filter (and reword the client-side blurb back) if
-- more decks are ever re-enabled and this should combine again.
create function public.get_total_hands_won_leaderboard()
returns table (username text, avatar text, total_hands_won bigint)
language sql
security definer
set search_path = public
stable
as $$
  select p.username, p.avatar, sum(dp.hands_won) as total_hands_won
    from public.deck_progress dp
    join public.profiles p on p.id = dp.user_id
   where dp.deck_id = 'single-deck'
   group by p.id, p.username, p.avatar
  having sum(dp.hands_won) > 0
   order by total_hands_won desc
   limit 25;
$$;

revoke all on function public.get_total_hands_won_leaderboard() from public;
grant execute on function public.get_total_hands_won_leaderboard() to anon, authenticated;

-- Leaderboard 3 (Total Token Score, per deck) reuses the existing
-- leaderboard_scores.cumulative_banked column/table directly — no new
-- function needed, just a differently-scoped query client-side.

-- site_messages: one editable-copy mechanism for all of it — the
-- signed-out/signed-in banners AND the game-screen tagline are all rows
-- here, not separate systems per piece of text. Edited directly through
-- the Supabase table editor; no admin UI, no client write path at all (see
-- the RLS below — there's deliberately no insert/update policy, so no
-- client role can ever write here, only the dashboard's elevated access).
--
-- The trigger keeps updated_at current on any edit automatically, so
-- editing `content` in the table editor is enough to invalidate every
-- visitor's prior dismissal — the client compares this timestamp against
-- what it last dismissed (see src/siteMessages/siteMessages.js) rather
-- than tracking "has this slot ever been dismissed."
create table public.site_messages (
  slot text primary key check (slot in ('banner_signed_out', 'banner_signed_in', 'tagline')),
  content text not null,
  updated_at timestamptz not null default now()
);

alter table public.site_messages enable row level security;

create policy "site messages are publicly readable"
  on public.site_messages for select
  using (true);

create or replace function public.touch_site_messages_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger site_messages_touch_updated_at
  before update on public.site_messages
  for each row
  execute function public.touch_site_messages_updated_at();

insert into public.site_messages (slot, content) values
  ('banner_signed_out', 'Sign in to save your progress and get on the leaderboard — Hi-Lo Stakes is running a real prize contest for the Single Deck Win Streak record. See the Rules tab for details.'),
  ('banner_signed_in', 'Welcome back — check the Leaderboard tab to see where you stand.'),
  ('tagline', 'Pick the next card. It''s easier if you can remember all the cards you''ve already seen.');

-- Retention views (D1/D7/D30) — pure SQL-editor analytics, nothing granted
-- to anon/authenticated. cohort_date is a user's first-ever activity_date;
-- retention_by_cohort gives cohort size plus how many of that cohort were
-- also active exactly 1/7/30 days later, as both a count and a percentage.
-- Query it directly, filter/sort by cohort_date for whatever window matters.
create view public.user_first_activity as
  select user_id, min(activity_date) as cohort_date
  from public.daily_activity
  group by user_id;

revoke all on public.user_first_activity from anon, authenticated;

create view public.retention_by_cohort as
with cohorts as (
  select cohort_date, count(*) as cohort_size
  from public.user_first_activity
  group by cohort_date
),
d1 as (
  select f.cohort_date, count(*) as retained
  from public.user_first_activity f
  join public.daily_activity a
    on a.user_id = f.user_id and a.activity_date = f.cohort_date + 1
  group by f.cohort_date
),
d7 as (
  select f.cohort_date, count(*) as retained
  from public.user_first_activity f
  join public.daily_activity a
    on a.user_id = f.user_id and a.activity_date = f.cohort_date + 7
  group by f.cohort_date
),
d30 as (
  select f.cohort_date, count(*) as retained
  from public.user_first_activity f
  join public.daily_activity a
    on a.user_id = f.user_id and a.activity_date = f.cohort_date + 30
  group by f.cohort_date
)
select
  c.cohort_date,
  c.cohort_size,
  coalesce(d1.retained, 0) as d1_retained,
  round(100.0 * coalesce(d1.retained, 0) / c.cohort_size, 1) as d1_pct,
  coalesce(d7.retained, 0) as d7_retained,
  round(100.0 * coalesce(d7.retained, 0) / c.cohort_size, 1) as d7_pct,
  coalesce(d30.retained, 0) as d30_retained,
  round(100.0 * coalesce(d30.retained, 0) / c.cohort_size, 1) as d30_pct
from cohorts c
left join d1 on d1.cohort_date = c.cohort_date
left join d7 on d7.cohort_date = c.cohort_date
left join d30 on d30.cohort_date = c.cohort_date
order by c.cohort_date;

revoke all on public.retention_by_cohort from anon, authenticated;

-- feedback_submissions: player-submitted bug reports and suggestions.
-- Insert-only from the client (no select policy at all) — submissions are
-- read back only through the Supabase table editor, no admin UI. No RPC
-- needed since there's no arithmetic to race on, just a plain insert gated
-- by auth.uid() = user_id.
create table public.feedback_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null check (type in ('bug', 'suggestion')),
  message text not null check (char_length(message) between 1 and 2000),
  created_at timestamptz not null default now()
);

alter table public.feedback_submissions enable row level security;

create policy "users can submit their own feedback"
  on public.feedback_submissions for insert
  with check (auth.uid() = user_id);

-- referrer_engagement: per-referrer funnel — signups vs. qualified — for
-- manually reviewing a cohort of referrers rather than trusting the
-- headline qualified_referral_count alone. Pure reporting over data
-- already captured on profiles; no new tracking. "Verified" isn't a
-- separate column: under OTP-only auth, attribute_referral() only ever
-- runs after email verification succeeds AND a profile row is created, so
-- every row counted here is already verified by construction — there's no
-- unverified-but-attributed state to report separately, hence
-- verified_count always equals signup_count. Kept as its own column anyway
-- so the shape matches the requested breakdown and stays self-documenting.
-- To drill into a specific referrer's individual referred accounts (not
-- just the aggregate), query profiles directly:
--   select username, has_played_ever, created_at
--   from public.profiles where referred_by = '<referrer id>';
create view public.referrer_engagement as
select
  r.id as referrer_id,
  r.username as referrer_username,
  r.referred_signups_count as signup_count,
  r.referred_signups_count as verified_count,
  r.qualified_referral_count as qualified_count,
  round(
    100.0 * r.qualified_referral_count / nullif(r.referred_signups_count, 0),
    1
  ) as qualified_pct
from public.profiles r
where r.referred_signups_count > 0
order by r.referred_signups_count desc;

revoke all on public.referrer_engagement from anon, authenticated;
-- ============================================================================
-- SERVER-AUTHORITATIVE GAME REBUILD
--
-- Replaces the client-trusting model (full deck in client state, client
-- decides win/loss, client reports a final amount) with one where the
-- server owns the shuffled deck and the running banked/win-streak state,
-- and the client only ever sees the current compare card, the just-revealed
-- card, and the outcome of each call.
--
-- Card shape used throughout: {"rank": {"key": "K", "value": 13},
-- "suit": {"key": "hearts", "symbol": "♥", "color": "red"}} -- deliberately
-- matching src/engine/constants.js's shape exactly, so the client can use a
-- card returned from these functions as a drop-in replacement for one built
-- by the local engine, with zero transformation.
-- ============================================================================

create extension if not exists pgcrypto;

-- Lets Postgres functions make outbound HTTP calls (used by
-- notify_contest_win() further down to hit Mailtrap's Send API). If this
-- fails with a permissions error, enable it from the Supabase Dashboard
-- instead: Database -> Extensions -> search "pg_net" -> Enable.
create extension if not exists pg_net;

-- ---------------------------------------------------------------------------
-- Deck config helpers -- mirror src/engine/decks.js's DECKS array and
-- src/engine/constants.js's SUITS/RANKS. Kept as small SQL functions rather
-- than a table so there's no separate source of truth to drift out of sync
-- with the client's engine -- if these ever change, both sides need editing
-- together regardless of representation.
-- ---------------------------------------------------------------------------
create or replace function public.deck_suits(p_deck_id text) returns text[]
language sql
set search_path = public
as $$
  select case p_deck_id
    when 'single-suit' then array['spades']
    when 'double-suit' then array['spades','hearts']
    when 'single-deck' then array['spades','clubs','hearts','diamonds']
    when 'double-deck' then array['spades','clubs','hearts','diamonds']
    else null
  end;
$$;

create or replace function public.deck_copies(p_deck_id text) returns int
language sql
set search_path = public
as $$
  select case p_deck_id when 'double-deck' then 2 when 'single-suit' then 1 when 'double-suit' then 1 when 'single-deck' then 1 else null end;
$$;

create or replace function public.deck_ante(p_deck_id text) returns bigint
language sql
set search_path = public
as $$
  select case p_deck_id
    when 'single-suit' then 100
    when 'double-suit' then 200
    when 'single-deck' then 400
    when 'double-deck' then 800
    else null
  end;
$$;

-- Hands needed for a full shoe clear on a given deck -- shared by make_call
-- (detects a lifeline-assisted clear mid-hand) and finalize_session (gates
-- the contest-win email alert further down). Pulled into one function
-- rather than left as an inline formula in both places so the two can never
-- drift apart on what "51" actually means.
create or replace function public.full_clear_target(p_deck_id text) returns int
language sql
set search_path = public
as $$
  select array_length(public.deck_suits(p_deck_id), 1) * 13 * public.deck_copies(p_deck_id) - 1;
$$;

create or replace function public.suit_color(p_suit text) returns text
language sql
set search_path = public
as $$
  select case when p_suit in ('hearts','diamonds') then 'red' when p_suit in ('spades','clubs') then 'mono' else null end;
$$;

create or replace function public.suit_symbol(p_suit text) returns text
language sql
set search_path = public
as $$
  select case p_suit
    when 'spades' then '♠' when 'clubs' then '♣' when 'hearts' then '♥' when 'diamonds' then '♦'
    else null
  end;
$$;

-- Builds one fresh, unshuffled shoe for a deck config -- suits × 13 ranks ×
-- copies, exactly matching engine/deck.js#freshDeck's card generation (the
-- shuffle is a separate step, see crypto_shuffle below).
create or replace function public.build_full_deck(p_deck_id text) returns jsonb[]
language plpgsql
set search_path = public
as $$
declare
  v_suits text[] := public.deck_suits(p_deck_id);
  v_copies int := public.deck_copies(p_deck_id);
  v_rank_keys text[] := array['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
  v_rank_values int[] := array[2,3,4,5,6,7,8,9,10,11,12,13,14];
  v_cards jsonb[] := array[]::jsonb[];
  v_suit text;
  v_i int;
  v_copy int;
begin
  if v_suits is null or v_copies is null then
    raise exception 'unknown deck_id: %', p_deck_id;
  end if;

  for v_copy in 1..v_copies loop
    foreach v_suit in array v_suits loop
      for v_i in 1..array_length(v_rank_keys, 1) loop
        v_cards := v_cards || jsonb_build_object(
          'rank', jsonb_build_object('key', v_rank_keys[v_i], 'value', v_rank_values[v_i]),
          'suit', jsonb_build_object('key', v_suit, 'symbol', public.suit_symbol(v_suit), 'color', public.suit_color(v_suit))
        );
      end loop;
    end loop;
  end loop;

  return v_cards;
end;
$$;

-- Fisher-Yates shuffle using gen_random_bytes (pgcrypto, OS-level CSPRNG) for
-- the random index at each step -- replaces the client's Math.random()
-- shuffle, which is neither secret (the deck was fully visible client-side
-- anyway) nor cryptographically secure. Reads 4 random bytes as an unsigned
-- 32-bit integer per swap rather than casting through a signed bigint, to
-- avoid sign-extension surprises.
create or replace function public.crypto_shuffle(p_deck jsonb[]) returns jsonb[]
language plpgsql
set search_path = public, extensions
as $$
declare
  v_arr jsonb[] := p_deck;
  v_n int := array_length(p_deck, 1);
  v_i int;
  v_j int;
  v_tmp jsonb;
  v_bytes bytea;
  v_rand bigint;
begin
  if v_n is null or v_n <= 1 then return v_arr; end if;

  for v_i in reverse v_n..2 loop
    v_bytes := gen_random_bytes(4);
    v_rand := (get_byte(v_bytes, 0)::bigint << 24)
            | (get_byte(v_bytes, 1)::bigint << 16)
            | (get_byte(v_bytes, 2)::bigint << 8)
            | get_byte(v_bytes, 3)::bigint;
    v_j := 1 + (v_rand % v_i);
    v_tmp := v_arr[v_i];
    v_arr[v_i] := v_arr[v_j];
    v_arr[v_j] := v_tmp;
  end loop;

  return v_arr;
end;
$$;

-- Odds as if the shoe were freshly reshuffled and full, given only the
-- current card's rank/color -- mirrors engine/odds.js#calcBaselineProbs
-- exactly (never the actual remaining deck). This is what the server uses
-- to independently recompute the payout for a call, rather than trusting
-- anything from the client -- the client shows the identical number using
-- the same public formula (see src/engine/odds.js), just computed locally
-- for display since it needs no secret.
create or replace function public.calc_baseline_prob(p_deck_id text, p_compare_value int, p_compare_color text, p_call text) returns double precision
language plpgsql
set search_path = public
as $$
declare
  v_suits text[] := public.deck_suits(p_deck_id);
  v_copies int := public.deck_copies(p_deck_id);
  v_rank_values int[] := array[2,3,4,5,6,7,8,9,10,11,12,13,14];
  v_total_cards int;
  v_higher int := 0;
  v_lower int := 0;
  v_same int := 0;
  v_red int := 0;
  v_black int := 0;
  v_suit text;
  v_val int;
  v_n int;
begin
  if v_suits is null or v_copies is null then
    raise exception 'unknown deck_id: %', p_deck_id;
  end if;

  v_total_cards := array_length(v_suits, 1) * array_length(v_rank_values, 1) * v_copies;

  foreach v_suit in array v_suits loop
    foreach v_val in array v_rank_values loop
      if v_val > p_compare_value then v_higher := v_higher + v_copies;
      elsif v_val < p_compare_value then v_lower := v_lower + v_copies;
      else v_same := v_same + v_copies;
      end if;
      if public.suit_color(v_suit) = 'red' then v_red := v_red + v_copies;
      else v_black := v_black + v_copies;
      end if;
    end loop;
  end loop;

  -- The compare card itself is already in play, not sitting in the
  -- hypothetical fresh shoe -- remove exactly that one physical instance.
  v_same := v_same - 1;
  if p_compare_color = 'red' then v_red := v_red - 1; else v_black := v_black - 1; end if;

  v_n := v_total_cards - 1;
  if v_n <= 0 then return 0; end if;

  return (case p_call
    when 'higher' then v_higher
    when 'lower' then v_lower
    when 'same' then v_same
    when 'red' then v_red
    when 'black' then v_black
    else 0
  end)::double precision / v_n;
end;
$$;

create or replace function public.growth_for(p_prob double precision) returns double precision
language sql
set search_path = public
as $$
  select case when p_prob is null or p_prob <= 0 then 0 else (1 - 0.01) / p_prob end;
$$;

-- True odds of a "Same" hit off the ACTUAL remaining deck at the moment of a
-- call -- mirrors engine/odds.js#calcProbs, narrowed to just pSame since
-- that's the only true-odds figure anything still reads (deck_progress.
-- lowest_odds_same_hit, an old achievement field -- see the comment on that
-- column further down). Computed server-side since it needs the real deck.
create or replace function public.calc_true_same_prob(p_deck jsonb[], p_compare_value int) returns double precision
language plpgsql
set search_path = public
as $$
declare
  v_n int := array_length(p_deck, 1);
  v_same_count int := 0;
  v_i int;
begin
  if v_n is null or v_n = 0 then return 0; end if;
  for v_i in 1..v_n loop
    if (p_deck[v_i]->'rank'->>'value')::int = p_compare_value then
      v_same_count := v_same_count + 1;
    end if;
  end loop;
  return v_same_count::double precision / v_n;
end;
$$;

-- ---------------------------------------------------------------------------
-- game_sessions: the server's own record of an in-progress game. `deck` is
-- the entire remaining shoe -- this is the one column that must NEVER be
-- readable by any client role, in any form, which is why there is no SELECT
-- grant on this table at all (not even scoped to the owning user -- a plain
-- `select *` would include `deck`). All interaction goes through the
-- SECURITY DEFINER functions below, which return only a sanitized shape.
-- ---------------------------------------------------------------------------
create table public.game_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  deck_id text not null,
  deck jsonb[] not null,
  compare_card jsonb not null,
  pending_card jsonb,
  banked bigint not null default 0,
  win_streak int not null default 0,
  hands_won_this_game int not null default 0,
  lifelines_used int not null default 0,
  ever_same_hit boolean not null default false,
  ever_red_black_hit boolean not null default false,
  lowest_same_odds double precision,
  -- Set once at start_game() from the player's profiles.game_mode
  -- preference, fixed for the life of the session (changing your
  -- preference mid-game doesn't retroactively alter a session already in
  -- progress). Speed-mode sessions are barred from voluntary banking in
  -- bank_session() below, the same way lifelines_used > 0 already is --
  -- and for the same reason, make_call()'s full-clear auto-finalize check
  -- covers speed_mode too, since it would otherwise be the one condition
  -- with no way to ever collect the payout.
  speed_mode boolean not null default false,
  status text not null default 'playing' check (status in ('playing', 'lifeline-offer', 'busted', 'cashed')),
  -- One timestamp appended per make_call, win or lose -- piggybacked onto
  -- that function's existing per-hand UPDATE (no separate write path). Used
  -- only by analyze_call_timing() below for manual review before a prize
  -- payout; never read on any live gameplay path.
  call_timestamps timestamptz[] not null default array[]::timestamptz[],
  -- Client-generated UUID, one per install/browser profile (see
  -- src/device/deviceId.js), passed to start_game() and stamped here at
  -- creation, never updated afterward. Purely a manual-review aid -- never
  -- read on any live gameplay path, never used to block, throttle, or
  -- otherwise alter anything about a session. A reviewer looking at
  -- flagged sessions (contest_review) can join back to this column to see
  -- whether one device_id maps to many different accounts; nothing more.
  -- Self-reported by the client, so it's a signal, not a proof -- treat it
  -- the same evidentiary weight as analyze_call_timing's output: worth a
  -- human's attention, not conclusive on its own.
  device_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.game_sessions enable row level security;
revoke all on public.game_sessions from anon, authenticated;

-- contest_review: one row per session that has ever been auto-flagged for
-- manual review, primary-keyed on the session itself so a session can only
-- ever have one review record no matter how many times it gets flagged
-- (see the two writers below). `decision` starts 'pending' and stays that
-- way until a human sets it via a direct SQL editor update -- there is no
-- client or RPC write path to this table at all, by design (same lockdown
-- pattern as game_sessions itself). Purely a manual-review aid; nothing
-- reads this to gate or alter live gameplay.
create table public.contest_review (
  session_id uuid primary key references public.game_sessions (id),
  flagged_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by text,
  decision text check (decision in ('approved', 'rejected', 'pending')),
  notes text
);

alter table public.contest_review enable row level security;
revoke all on public.contest_review from anon, authenticated;

-- Per-user request budget for the session RPCs below -- a fixed 1-second
-- window, keyed only on auth.uid() (never IP, never anything about the
-- network the request came from, so real players who happen to share a
-- wifi network can never throttle each other). A cheap, single-row upsert;
-- see check_rate_limit() for the actual check, called first thing in every
-- session RPC.
create table public.rate_limit_state (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  window_start timestamptz not null default now(),
  request_count int not null default 0
);

alter table public.rate_limit_state enable row level security;
revoke all on public.rate_limit_state from anon, authenticated;

-- 10 requests/second/user -- roughly 5x the fastest a human could possibly
-- cycle through the real UI (the 500ms reveal delay plus an instantly-
-- clicked Skip past the post-win pause puts an absolute human ceiling
-- around 2/sec; real sustained play is far slower). Comfortably above any
-- legitimate pace, including someone with multiple tabs open, while still
-- capping what would otherwise be unbounded automated throughput. Called
-- as the very first statement in every session RPC -- a single indexed
-- upsert, not a scan, so it adds negligible latency to a real request.
create or replace function public.check_rate_limit() returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_max_per_window constant int := 10;
  v_window_start timestamptz;
  v_count int;
  v_now timestamptz := clock_timestamp();
begin
  if auth.uid() is null then
    raise exception 'must be signed in';
  end if;

  insert into public.rate_limit_state (user_id, window_start, request_count)
  values (auth.uid(), v_now, 1)
  on conflict (user_id) do update set
    window_start = case
      when v_now - public.rate_limit_state.window_start >= interval '1 second' then v_now
      else public.rate_limit_state.window_start
    end,
    request_count = case
      when v_now - public.rate_limit_state.window_start >= interval '1 second' then 1
      else public.rate_limit_state.request_count + 1
    end
  returning window_start, request_count into v_window_start, v_count;

  if v_count > v_max_per_window then
    raise exception 'rate limit exceeded -- slow down';
  end if;
end;
$$;

revoke all on function public.check_rate_limit() from public, anon, authenticated;

-- Per-user count of games STARTED (not completed) on a given UTC calendar
-- day -- a bust counts against this exactly like a bank, since what this
-- caps is attempt volume against the $10,000 contest (see check_daily_play_
-- limit below), not payout. Deliberately separate from daily_activity,
-- which is a one-row-per-day "were they active" flag for retention
-- reporting and can't hold a per-day count.
create table public.daily_game_starts (
  user_id uuid not null references public.profiles (id) on delete cascade,
  start_date date not null,
  games_started int not null default 0,
  primary key (user_id, start_date)
);

alter table public.daily_game_starts enable row level security;
revoke all on public.daily_game_starts from anon, authenticated;

-- 101 game starts per user per UTC day -- 100 real attempts plus one extra
-- for the throwaway first game. Called from start_game() right after
-- check_rate_limit(); a fresh game_sessions row isn't inserted if this
-- raises. Resets at UTC midnight since it keys on the server's own
-- calendar date, never a client-reported one.
--
-- is_admin accounts are exempt entirely -- unlimited games per day, and no
-- daily_game_starts row is written for them either, so there's nothing to
-- later "unblock."
create or replace function public.check_daily_play_limit() returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_daily_limit constant int := 101;
  v_today date := (now() at time zone 'utc')::date;
  v_count int;
  v_is_admin boolean;
begin
  select is_admin into v_is_admin from public.profiles where id = auth.uid();
  if coalesce(v_is_admin, false) then
    return;
  end if;

  insert into public.daily_game_starts (user_id, start_date, games_started)
  values (auth.uid(), v_today, 1)
  on conflict (user_id, start_date) do update set
    games_started = public.daily_game_starts.games_started + 1
  returning games_started into v_count;

  if v_count > v_daily_limit then
    raise exception 'daily play limit reached -- come back tomorrow';
  end if;
end;
$$;

revoke all on function public.check_daily_play_limit() from public, anon, authenticated;

-- Starts a fresh session: shuffles a full shoe server-side (CSPRNG), holds
-- the shoe minus its first card, and returns only that first card plus the
-- session id and how many cards are left. The rest of the shoe never
-- leaves the server.
--
-- p_speed_mode fixes the session's pacing/mechanic for its whole lifetime
-- (see game_sessions.speed_mode above) -- the client passes the player's
-- current profiles.game_mode preference at call time; changing the
-- preference afterward never affects a session already in progress.
--
-- p_device_id is the client-generated fingerprint from
-- src/device/deviceId.js -- stamped onto the session for manual-review
-- visibility only (see game_sessions.device_id above). Optional/nullable:
-- an older client build or a request with localStorage unavailable simply
-- omits it, and the session is created exactly as before with device_id
-- left null. Never read on any live gameplay path, never affects rate
-- limiting, the daily play limit, or anything else about this function's
-- behavior.
--
-- Dropped and recreated (not just replaced) because adding a parameter to
-- an existing function creates a second overload rather than replacing it
-- -- Postgres identifies functions by name + argument types, and
-- start_game(text), start_game(text, boolean), and
-- start_game(text, boolean, text) are all different signatures. Leaving
-- old overloads in place would leave PostgREST unable to resolve which one
-- a call with fewer arguments should hit.
drop function if exists public.start_game(text);
drop function if exists public.start_game(text, boolean);

create function public.start_game(p_deck_id text, p_speed_mode boolean default false, p_device_id text default null)
returns table (session_id uuid, compare_card jsonb, cards_left int, ante bigint)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_deck jsonb[];
  v_compare jsonb;
  v_session_id uuid;
begin
  if auth.uid() is null then
    raise exception 'must be signed in';
  end if;
  perform public.check_rate_limit();
  perform public.check_daily_play_limit();

  v_deck := public.crypto_shuffle(public.build_full_deck(p_deck_id));
  v_compare := v_deck[1];
  v_deck := v_deck[2:array_length(v_deck, 1)];

  insert into public.game_sessions (user_id, deck_id, deck, compare_card, speed_mode, device_id)
  values (auth.uid(), p_deck_id, v_deck, v_compare, coalesce(p_speed_mode, false), p_device_id)
  returning id into v_session_id;

  return query select v_session_id, v_compare, array_length(v_deck, 1), public.deck_ante(p_deck_id);
end;
$$;

revoke all on function public.start_game(text, boolean, text) from public, anon, authenticated;
grant execute on function public.start_game(text, boolean, text) to authenticated;

-- The one call-resolution endpoint. Draws the next card from the server's
-- own copy of the deck, decides correctness itself, and independently
-- recomputes the payout from the public baseline-odds formula (never from
-- anything the client sends) -- the client only ever learns the outcome
-- after the fact. On a wrong call this does NOT end the game: it parks the
-- drawn card as `pending_card` and flips to 'lifeline-offer' so the client
-- can still choose to spend a lifeline (see use_lifeline_in_session) before
-- the game is finalized via bust_session.
--
-- Exploit fix: once a lifeline has been used this session, voluntary
-- banking is disabled (see bank_session) to close a bootstrapping loop
-- where a lifeline-saved near-bust could be cashed out for far more tokens
-- than the lifeline cost. Speed-mode sessions (game_sessions.speed_mode)
-- have voluntary banking disabled unconditionally, by design -- a Speed
-- Mode game is meant to only ever end by busting or fully clearing the
-- deck. Either way, the only two outcomes left are busting (0 tokens) or
-- actually clearing the full deck -- so reaching the full-clear target on
-- a lifeline-used OR speed-mode session auto-finalizes as a win right
-- here, since the player has no other way to collect the payout. Normal
-- Bank Mode play with no lifeline used is completely untouched: this
-- block only ever runs when one of those two conditions holds, so a
-- normal game can still climb past the target and bank whenever the
-- player chooses, exactly as before.
create or replace function public.make_call(p_session_id uuid, p_call text)
returns table (correct boolean, drawn_card jsonb, banked bigint, win_streak int, status text, gain bigint, cards_left int, is_new_peak boolean)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_session public.game_sessions;
  v_deck jsonb[];
  v_compare jsonb;
  v_drawn jsonb;
  v_compare_value int;
  v_compare_color text;
  v_prob double precision;
  v_growth double precision;
  v_correct boolean;
  v_stake bigint;
  v_new_banked bigint;
  v_gain bigint;
  v_new_streak int;
  v_true_same_prob double precision;
  v_n int;
  v_k int;
  v_full_clear_target int;
  v_is_new_peak boolean;
begin
  if auth.uid() is null then
    raise exception 'must be signed in';
  end if;
  perform public.check_rate_limit();

  if p_call not in ('higher', 'lower', 'same', 'red', 'black') then
    raise exception 'invalid call';
  end if;

  select * into v_session from public.game_sessions
   where id = p_session_id and user_id = auth.uid() and public.game_sessions.status = 'playing'
   for update;

  if not found then
    raise exception 'no active session in playing state';
  end if;

  v_deck := v_session.deck;
  v_compare := v_session.compare_card;
  v_compare_value := (v_compare->'rank'->>'value')::int;
  v_compare_color := v_compare->'suit'->>'color';

  -- Reshuffle-excluding: mirrors engine/deck.js#reshuffleExcluding -- a
  -- fresh shoe, minus exactly the one physical card currently in play.
  if array_length(v_deck, 1) is null or array_length(v_deck, 1) = 0 then
    v_deck := public.crypto_shuffle(public.build_full_deck(v_session.deck_id));
    v_n := array_length(v_deck, 1);
    for v_k in 1..v_n loop
      if v_deck[v_k]->'rank'->>'key' = v_compare->'rank'->>'key'
         and v_deck[v_k]->'suit'->>'key' = v_compare->'suit'->>'key' then
        v_deck := v_deck[1:v_k-1] || v_deck[v_k+1:v_n];
        exit;
      end if;
    end loop;
  end if;

  v_true_same_prob := public.calc_true_same_prob(v_deck, v_compare_value);

  v_prob := public.calc_baseline_prob(v_session.deck_id, v_compare_value, v_compare_color, p_call);
  if v_prob <= 0 then
    raise exception 'call not possible';
  end if;
  v_growth := public.growth_for(v_prob);

  v_drawn := v_deck[1];
  v_deck := v_deck[2:array_length(v_deck, 1)];

  v_correct := case p_call
    when 'same' then (v_drawn->'rank'->>'value')::int = v_compare_value
    when 'higher' then (v_drawn->'rank'->>'value')::int > v_compare_value
    when 'lower' then (v_drawn->'rank'->>'value')::int < v_compare_value
    when 'red' then v_drawn->'suit'->>'color' = 'red'
    when 'black' then v_drawn->'suit'->>'color' = 'mono'
    else false
  end;

  if v_correct then
    v_stake := case when v_session.banked > 0 then v_session.banked else public.deck_ante(v_session.deck_id) end;
    v_new_banked := round(v_stake * v_growth);
    v_gain := v_new_banked - v_session.banked;
    v_new_streak := v_session.win_streak + 1;

    update public.game_sessions
       set deck = v_deck,
           compare_card = v_drawn,
           pending_card = null,
           banked = v_new_banked,
           win_streak = v_new_streak,
           hands_won_this_game = hands_won_this_game + 1,
           ever_same_hit = ever_same_hit or (p_call = 'same'),
           ever_red_black_hit = ever_red_black_hit or (p_call in ('red', 'black')),
           lowest_same_odds = case
             when p_call = 'same' and lowest_same_odds is null then v_true_same_prob
             when p_call = 'same' then least(lowest_same_odds, v_true_same_prob)
             else lowest_same_odds
           end,
           call_timestamps = call_timestamps || clock_timestamp(),
           updated_at = now()
     where id = p_session_id;

    -- Earlier proactive review flag -- logs only, never blocks play and
    -- never emails anyone -- the moment a Single Deck run first crosses
    -- win_streak 40, well before the 51-streak contest payout line, so a
    -- reviewer can see a suspicious run building instead of only ever
    -- looking at one that already won. contest_review.session_id is the
    -- primary key, so `on conflict do nothing` makes every attempt after
    -- the first (on hand 41, 42, ... up to 51) a cheap no-op single-row
    -- lookup rather than tracking the exact 39->40 transition separately.
    if v_session.deck_id = 'single-deck' and v_new_streak >= 40 then
      insert into public.contest_review (session_id, decision, notes)
      values (p_session_id, 'pending', 'auto-flag: win_streak reached 40 on single-deck')
      on conflict (session_id) do nothing;
    end if;

    v_full_clear_target := public.full_clear_target(v_session.deck_id);

    if (v_session.lifelines_used > 0 or v_session.speed_mode) and v_new_streak >= v_full_clear_target then
      select f.is_new_peak into v_is_new_peak from public.finalize_session(p_session_id, true) as f;
      return query select true, v_drawn, v_new_banked, v_new_streak, 'cashed'::text, v_gain, array_length(v_deck, 1), v_is_new_peak;
      return;
    end if;

    return query select true, v_drawn, v_new_banked, v_new_streak, 'playing'::text, v_gain, array_length(v_deck, 1), false;
  else
    update public.game_sessions
       set deck = v_deck,
           pending_card = v_drawn,
           status = 'lifeline-offer',
           call_timestamps = call_timestamps || clock_timestamp(),
           updated_at = now()
     where id = p_session_id;

    return query select false, v_drawn, v_session.banked, v_session.win_streak, 'lifeline-offer'::text, 0::bigint, array_length(v_deck, 1), false;
  end if;
end;
$$;

revoke all on function public.make_call(uuid, text) from public, anon, authenticated;
grant execute on function public.make_call(uuid, text) to authenticated;

-- Spends one lifeline to forgive the pending wrong call: the win streak
-- neither increments nor resets (it just holds), and the wrongly-called
-- card becomes the new compare card, exactly like a normal hand advancing.
-- The per-game cap of 2 (MAX_LIFELINES_PER_GAME client-side) is now also
-- enforced here server-side, not just as a UI courtesy.
create or replace function public.use_lifeline_in_session(p_session_id uuid)
returns table (success boolean, compare_card jsonb, lifeline_balance integer, status text)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_session public.game_sessions;
  v_balance integer;
begin
  if auth.uid() is null then
    raise exception 'must be signed in';
  end if;
  perform public.check_rate_limit();

  select * into v_session from public.game_sessions
   where id = p_session_id and user_id = auth.uid() and public.game_sessions.status = 'lifeline-offer'
   for update;

  if not found then
    return query select false, null::jsonb, (select p.lifeline_balance from public.profiles p where p.id = auth.uid()), null::text;
    return;
  end if;

  if v_session.lifelines_used >= 2 then
    return query select false, null::jsonb, (select p.lifeline_balance from public.profiles p where p.id = auth.uid()), v_session.status;
    return;
  end if;

  select p.lifeline_balance into v_balance from public.profiles p where p.id = auth.uid() for update;
  if coalesce(v_balance, 0) <= 0 then
    return query select false, null::jsonb, coalesce(v_balance, 0), v_session.status;
    return;
  end if;

  update public.profiles set lifeline_balance = public.profiles.lifeline_balance - 1 where id = auth.uid();

  update public.game_sessions
     set compare_card = pending_card,
         pending_card = null,
         lifelines_used = lifelines_used + 1,
         status = 'playing',
         updated_at = now()
   where id = p_session_id;

  return query select true, v_session.pending_card, (select p.lifeline_balance from public.profiles p where p.id = auth.uid()), 'playing'::text;
end;
$$;

revoke all on function public.use_lifeline_in_session(uuid) from public, anon, authenticated;
grant execute on function public.use_lifeline_in_session(uuid) to authenticated;

-- Small non-secret config for the contest-win email alert below -- the
-- Mailtrap API token itself is never stored here in plain text, it lives in
-- Supabase Vault (see the one-off `select vault.create_secret(...)` run
-- separately, outside this file, with the real token). Fill in the two
-- rows below with your actual recipient/from addresses before relying on
-- this -- 'contest_alert_from_email' must match a sender already verified
-- in your Mailtrap account or Mailtrap will reject the send.
create table public.app_config (
  key text primary key,
  value text not null
);

alter table public.app_config enable row level security;
revoke all on public.app_config from anon, authenticated;

insert into public.app_config (key, value) values
  ('contest_alert_recipient', 'william.r.coleman3@gmail.com'),
  ('contest_alert_from_email', 'hello@hi-lo-game.com'),
  ('contest_alert_from_name', 'Hi-Lo Contest Alerts')
on conflict (key) do update set value = excluded.value;

-- One row per attempted contest-win alert, success or failure -- the whole
-- point is that a silent failure should still be visible somewhere. Query
-- this directly, or use check_contest_alert_delivery() further down for a
-- friendlier view that also confirms Mailtrap actually accepted the send
-- (not just that this app managed to queue the HTTP request).
create table public.email_alert_log (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  session_id uuid,
  recipient text,
  subject text,
  request_id bigint,
  send_error text,
  created_at timestamptz not null default now()
);

alter table public.email_alert_log enable row level security;
revoke all on public.email_alert_log from anon, authenticated;

-- Fires the contest-win email alert to the site owner the moment a
-- qualifying Single Deck full clear (51/51) is confirmed -- called from
-- finalize_session() below, the one shared finalize path used by both the
-- lifeline-assisted auto-cashout (make_call) and a normal manual bank, so
-- this only ever needs to be hooked in one place.
--
-- Uses pg_net's net.http_post, which is fire-and-forget/async -- this
-- function queues the HTTP request and returns immediately without waiting
-- for Mailtrap's response, so a slow or failing email API can never add
-- latency to, or fail, the player's own bank/bust call. The `exception when
-- others` wrapper exists for the same reason: whatever goes wrong here
-- (missing config, a bad token, pg_net not enabled) gets logged to
-- email_alert_log and swallowed, never propagated back up into the game
-- transaction that called it.
create or replace function public.notify_contest_win(p_session_id uuid) returns void
language plpgsql
security definer
set search_path = public, extensions, vault, net
as $$
declare
  v_session public.game_sessions;
  v_username text;
  v_email text;
  v_recipient text;
  v_from_email text;
  v_from_name text;
  v_token text;
  v_subject text;
  v_body text;
  v_request_id bigint;
begin
  select * into v_session from public.game_sessions where id = p_session_id;
  if not found then
    return;
  end if;

  -- Persist the review flag independent of everything below -- this must
  -- land even if email config is missing or the send itself fails (both
  -- handled further down), since the review record, not the email, is the
  -- durable trail. If the win_streak>=40 flag in make_call() already
  -- created a 'pending' row for this session, append to its notes instead
  -- of clobbering reviewed_at/reviewed_by/decision a human may have
  -- already started filling in.
  insert into public.contest_review (session_id, decision, notes)
  values (
    p_session_id,
    'pending',
    format('auto-flag: win_streak reached full clear (%s) on single-deck, banked', v_session.win_streak)
  )
  on conflict (session_id) do update
    set notes = coalesce(public.contest_review.notes || E'\n' || excluded.notes, excluded.notes);

  select username into v_username from public.profiles where id = v_session.user_id;
  select email into v_email from auth.users where id = v_session.user_id;

  select value into v_recipient from public.app_config where key = 'contest_alert_recipient';
  select value into v_from_email from public.app_config where key = 'contest_alert_from_email';
  select value into v_from_name from public.app_config where key = 'contest_alert_from_name';
  select decrypted_secret into v_token from vault.decrypted_secrets where name = 'mailtrap_api_token';

  v_subject := format('Contest win: %s just cleared Single Deck (51/51)', coalesce(v_username, v_session.user_id::text));

  v_body := format(
    E'A qualifying Single Deck Win Streak (51/51) was just confirmed.\n\nThe 1-week manual review clock starts now.\n\nWinner\n  Username: %s\n  Email: %s\n  Account ID: %s\n\nWin\n  Deck: %s\n  Win streak: %s\n  Session ID: %s\n  Confirmed at: %s UTC\n\nTo start the review, run these in the Supabase SQL editor:\n  select * from public.find_sessions_for_review(%L);\n  select * from public.analyze_call_timing(%L);\n  select * from public.analyze_cross_session_timing(%L);\n  select * from public.contest_review where session_id = %L;\n',
    coalesce(v_username, '(unknown)'),
    coalesce(v_email, '(unknown)'),
    v_session.user_id,
    v_session.deck_id,
    v_session.win_streak,
    v_session.id,
    to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS'),
    v_username,
    v_session.id,
    v_username,
    v_session.id
  );

  if v_recipient is null or v_from_email is null or v_token is null then
    insert into public.email_alert_log (event_type, session_id, recipient, subject, send_error)
    values ('contest_win', p_session_id, v_recipient, v_subject, 'missing app_config row or vault secret -- alert not sent');
    return;
  end if;

  select net.http_post(
    url := 'https://send.api.mailtrap.io/api/send',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || v_token,
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'from', jsonb_build_object('email', v_from_email, 'name', coalesce(v_from_name, 'Hi-Lo Contest Alerts')),
      'to', jsonb_build_array(jsonb_build_object('email', v_recipient)),
      'subject', v_subject,
      'text', v_body,
      'category', 'contest-win-alert'
    )
  ) into v_request_id;

  insert into public.email_alert_log (event_type, session_id, recipient, subject, request_id)
  values ('contest_win', p_session_id, v_recipient, v_subject, v_request_id);
exception when others then
  insert into public.email_alert_log (event_type, session_id, recipient, subject, send_error)
  values ('contest_win', p_session_id, v_recipient, v_subject, sqlerrm);
end;
$$;

revoke all on function public.notify_contest_win(uuid) from public, anon, authenticated;

-- Manual check: run this in the SQL editor any time you want to confirm a
-- contest-win alert was actually queued and sent, not just that
-- finalize_session ran without error. Deliberately does NOT join against
-- pg_net's own internal response-tracking table -- its name/schema varies
-- across pg_net versions and isn't worth depending on here. A non-null
-- request_id with a null send_error means notify_contest_win successfully
-- handed the request to pg_net; for actual delivery confirmation (did
-- Mailtrap accept it, did it bounce), check
-- https://mailtrap.io/sending/email_logs directly -- that's the
-- authoritative source regardless of what this function can see.
create or replace function public.check_contest_alert_delivery()
returns table (
  logged_at timestamptz,
  session_id uuid,
  recipient text,
  subject text,
  request_id bigint,
  send_error text
)
language sql
security definer
set search_path = public
stable
as $$
  select
    l.created_at,
    l.session_id,
    l.recipient,
    l.subject,
    l.request_id,
    l.send_error
  from public.email_alert_log l
  where l.event_type = 'contest_win'
  order by l.created_at desc
  limit 25;
$$;

revoke all on function public.check_contest_alert_delivery() from public, anon, authenticated;

-- Shared finalize logic for both bust_session and bank_session below --
-- absorbs the ENTIRE previous body of record_game_end() (leaderboard_scores,
-- daily_activity, referral first-game payout, daily streak, spendable
-- tokens) and record_deck_progress() (best_win_streak, same/red-black hit
-- flags, lowest Same odds, hands_won, games_played), reading every value
-- from the session itself instead of from client-supplied parameters. No
-- EXECUTE grant to any client role -- only callable from within
-- bust_session/bank_session, which run as this function's owner regardless
-- of grants (grants gate direct top-level RPC calls, not function-to-
-- function calls within the same already-elevated execution).
create or replace function public.finalize_session(p_session_id uuid, p_was_banked boolean)
returns table (is_new_peak boolean)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_session public.game_sessions;
  v_today date := (now() at time zone 'utc')::date;
  v_last date;
  v_current int;
  v_longest int;
  v_gap int;
  v_prev_peak bigint;
  v_had_played_before boolean;
  v_referred_by uuid;
  v_reward_granted boolean;
  v_amount bigint;
begin
  select * into v_session from public.game_sessions where id = p_session_id for update;
  if not found then
    raise exception 'session not found';
  end if;

  v_amount := v_session.banked;

  update public.game_sessions
     set status = case when p_was_banked then 'cashed' else 'busted' end,
         updated_at = now()
   where id = p_session_id;

  -- Account-wide (all decks) completed-game count, distinct from
  -- deck_progress.games_played below which is per-deck -- see its
  -- column comment, in the "REMOVE ADS + AD SYSTEM" section further down
  -- this file, for why it exists. Incremented here unconditionally
  -- (bust or bank both count, same as games_played) since this is the
  -- one path every game end already goes through.
  update public.profiles set games_completed = games_completed + 1 where id = v_session.user_id;

  select peak_score into v_prev_peak
    from public.leaderboard_scores
   where user_id = v_session.user_id and deck_id = v_session.deck_id;

  insert into public.deck_progress (user_id, deck_id, best_win_streak, same_hit, red_black_hit, lowest_odds_same_hit, games_played, hands_won, updated_at)
  values (
    v_session.user_id,
    v_session.deck_id,
    v_session.win_streak,
    v_session.ever_same_hit,
    v_session.ever_red_black_hit,
    v_session.lowest_same_odds,
    1,
    v_session.hands_won_this_game,
    now()
  )
  on conflict (user_id, deck_id) do update set
    best_win_streak = greatest(public.deck_progress.best_win_streak, v_session.win_streak),
    same_hit = public.deck_progress.same_hit or v_session.ever_same_hit,
    red_black_hit = public.deck_progress.red_black_hit or v_session.ever_red_black_hit,
    lowest_odds_same_hit = case
      when v_session.lowest_same_odds is null then public.deck_progress.lowest_odds_same_hit
      when public.deck_progress.lowest_odds_same_hit is null then v_session.lowest_same_odds
      else least(public.deck_progress.lowest_odds_same_hit, v_session.lowest_same_odds)
    end,
    games_played = public.deck_progress.games_played + 1,
    hands_won = public.deck_progress.hands_won + v_session.hands_won_this_game,
    updated_at = now();

  insert into public.leaderboard_scores (user_id, deck_id, cumulative_banked, peak_score, updated_at)
  values (
    v_session.user_id,
    v_session.deck_id,
    case when p_was_banked then v_amount else 0 end,
    v_amount,
    now()
  )
  on conflict (user_id, deck_id) do update set
    cumulative_banked = public.leaderboard_scores.cumulative_banked
      + (case when p_was_banked then v_amount else 0 end),
    peak_score = greatest(public.leaderboard_scores.peak_score, v_amount),
    updated_at = now();

  insert into public.daily_activity (user_id, activity_date)
  values (v_session.user_id, v_today)
  on conflict (user_id, activity_date) do nothing;

  select has_played_ever, referred_by, referral_reward_granted
    into v_had_played_before, v_referred_by, v_reward_granted
    from public.profiles
   where id = v_session.user_id
   for update;

  if not coalesce(v_had_played_before, false) then
    update public.profiles set has_played_ever = true where id = v_session.user_id;

    if v_referred_by is not null and not coalesce(v_reward_granted, false) then
      update public.profiles set referral_reward_granted = true where id = v_session.user_id;
      update public.profiles
         set lifeline_balance = lifeline_balance + 10,
             qualified_referral_count = qualified_referral_count + 1
       where id = v_referred_by;
    end if;
  end if;

  if p_was_banked then
    select last_banked_date, current_streak, longest_streak
      into v_last, v_current, v_longest
      from public.profiles
     where id = v_session.user_id;

    update public.profiles
       set spendable_tokens = spendable_tokens + v_amount,
           has_banked_ever = true
     where id = v_session.user_id;

    v_gap := case when v_last is null then null else v_today - v_last end;

    if v_gap = 0 then
      null;
    else
      v_current := case when v_gap = 1 then coalesce(v_current, 0) + 1 else 1 end;
      v_longest := greatest(coalesce(v_longest, 0), v_current);

      update public.profiles
         set current_streak = v_current,
             longest_streak = v_longest,
             last_banked_date = v_today
       where id = v_session.user_id;
    end if;
  end if;

  -- Contest-win alert: only a genuine Bank (never a Bust) of a full 51/51
  -- Single Deck clear qualifies -- deliberately gated to this one deck, not
  -- any full clear on any deck, since the other decks are hidden/not
  -- contest-eligible even though their RPCs still technically work.
  if p_was_banked and v_session.deck_id = 'single-deck' and v_session.win_streak >= public.full_clear_target(v_session.deck_id) then
    perform public.notify_contest_win(p_session_id);
  end if;

  return query select (v_amount > coalesce(v_prev_peak, 0));
end;
$$;

revoke all on function public.finalize_session(uuid, boolean) from public, anon, authenticated;

-- Public entry point for a bust (wrong call declined, or the clock ran
-- out) -- finalizes at whatever the session already, truthfully, has
-- banked. A client can trigger this early or "lie" about why the game
-- ended, but can never inflate the amount: it only ever ends the game at
-- the currently server-tracked value.
create or replace function public.bust_session(p_session_id uuid)
returns table (is_new_peak boolean)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_owner uuid;
  v_status text;
begin
  if auth.uid() is null then
    raise exception 'must be signed in';
  end if;
  perform public.check_rate_limit();

  select user_id, status into v_owner, v_status from public.game_sessions where id = p_session_id for update;
  if v_owner is null or v_owner <> auth.uid() then
    raise exception 'no such session';
  end if;
  if v_status not in ('playing', 'lifeline-offer') then
    raise exception 'session already finalized';
  end if;

  return query select * from public.finalize_session(p_session_id, false);
end;
$$;

revoke all on function public.bust_session(uuid) from public, anon, authenticated;
grant execute on function public.bust_session(uuid) to authenticated;

-- Public entry point for banking -- only valid mid-game with something
-- actually banked, exactly mirroring the client's existing cashOut guard.
--
-- Exploit fix: rejects outright once a lifeline has been used this
-- session. Using a lifeline to survive a near-bust and then banking the
-- resulting (often much larger) payout let a single lucky/well-played run
-- generate far more tokens than the lifeline(s) it cost -- a bootstrapping
-- loop that undermined both the 10,000-token lifeline price and the pull
-- toward actually referring friends. From the moment a lifeline is used,
-- the only two ways this game can end are busting (0 tokens) or genuinely
-- clearing the full deck, which auto-finalizes from within make_call
-- itself (see that function) since voluntary banking is no longer
-- available to collect it. Lifeline-free games are entirely unaffected.
--
-- Speed Mode: rejects unconditionally, for the whole life of the session,
-- regardless of lifelines -- this is the actual server-side enforcement of
-- the mode's "no voluntary banking, ever" mechanic (game_sessions.
-- speed_mode is fixed at start_game() and can't change mid-session). Same
-- reasoning as the lifeline case: the only two outcomes are busting or a
-- full clear, and a full clear auto-finalizes from make_call.
create or replace function public.bank_session(p_session_id uuid)
returns table (is_new_peak boolean)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_owner uuid;
  v_status text;
  v_banked bigint;
  v_lifelines_used int;
  v_speed_mode boolean;
begin
  if auth.uid() is null then
    raise exception 'must be signed in';
  end if;
  perform public.check_rate_limit();

  select user_id, status, banked, lifelines_used, speed_mode
    into v_owner, v_status, v_banked, v_lifelines_used, v_speed_mode
    from public.game_sessions where id = p_session_id for update;
  if v_owner is null or v_owner <> auth.uid() then
    raise exception 'no such session';
  end if;
  if v_status <> 'playing' then
    raise exception 'session not in a bankable state';
  end if;
  if v_banked <= 0 then
    raise exception 'nothing banked yet';
  end if;
  if v_lifelines_used > 0 then
    raise exception 'banking is disabled after using a lifeline this game -- bust or clear the deck to end it';
  end if;
  if v_speed_mode then
    raise exception 'speed mode has no voluntary banking -- bust or clear the deck to end it';
  end if;

  return query select * from public.finalize_session(p_session_id, true);
end;
$$;

revoke all on function public.bank_session(uuid) from public, anon, authenticated;
grant execute on function public.bank_session(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Retire the old client-facing endpoints that accepted a raw client-
-- reported amount/win-streak as truth. Left defined (harmless -- nothing
-- calls them anymore) but no longer callable by any client role, which is
-- exactly the property being fixed: there is no longer any endpoint a
-- client can hit with a fabricated outcome and have it recorded.
-- ---------------------------------------------------------------------------
revoke all on function public.record_game_end(text, bigint, boolean) from authenticated, anon, public;
revoke all on function public.record_deck_progress(text, integer, boolean, boolean, double precision) from authenticated, anon, public;

-- ---------------------------------------------------------------------------
-- Timing-anomaly review, for manual inspection before a prize payout -- NOT
-- a live gameplay check, not automated enforcement. Reads game_sessions.
-- call_timestamps (piggybacked onto make_call's existing per-hand write,
-- see that table/function above) and reports how uniform/fast the gaps
-- between hands were. A human decides what to do with the output; this
-- just flags, it never blocks or bans. No EXECUTE grant to any client
-- role -- callable only from the SQL editor's own elevated access, same
-- lockdown pattern as finalize_session/referrer_engagement.
--
-- suspiciously_uniform: a real player's reaction time naturally varies
-- hand to hand; a coefficient of variation (stddev / mean) below 0.15 means
-- the gaps were unusually consistent -- worth a human's attention, not
-- proof of anything on its own.
-- implausibly_fast: a gap under 300ms is faster than a human can plausibly
-- perceive the reveal, decide, and click, even accounting for network
-- latency working in the player's favor.
create or replace function public.analyze_call_timing(p_session_id uuid)
returns table (
  hand_count int,
  mean_gap_seconds numeric,
  stddev_gap_seconds numeric,
  coefficient_of_variation numeric,
  min_gap_seconds numeric,
  max_gap_seconds numeric,
  suspiciously_uniform boolean,
  implausibly_fast boolean
)
language sql
security definer
set search_path = public
stable
as $$
  with ts as (
    select call_timestamps from public.game_sessions where id = p_session_id
  ),
  gaps as (
    select extract(epoch from (ts.call_timestamps[i] - ts.call_timestamps[i - 1])) as gap_seconds
    from ts, generate_subscripts(ts.call_timestamps, 1) as i
    where i > 1
  )
  select
    (select array_length(call_timestamps, 1) from ts),
    round(avg(gap_seconds)::numeric, 3),
    round(stddev(gap_seconds)::numeric, 3),
    round((stddev(gap_seconds) / nullif(avg(gap_seconds), 0))::numeric, 3),
    round(min(gap_seconds)::numeric, 3),
    round(max(gap_seconds)::numeric, 3),
    coalesce(stddev(gap_seconds) / nullif(avg(gap_seconds), 0) < 0.15, false),
    coalesce(min(gap_seconds) < 0.3, false)
  from gaps;
$$;

revoke all on function public.analyze_call_timing(uuid) from public, anon, authenticated;

-- Cross-session counterpart to analyze_call_timing() above -- that one
-- checks whether the gaps WITHIN one session are suspiciously uniform;
-- this checks whether a player's own AVERAGE pace is suspiciously uniform
-- ACROSS several different sessions. A real player's average pace
-- naturally drifts session to session (mood, fatigue, distraction, a
-- different device); a bot replaying the same script tends to land on
-- close to the same average every time, even across sessions where a
-- human reviewer only checked analyze_call_timing on the one that won.
--
-- Pulls the player's last p_session_limit sessions with at least 2 resolved
-- hands (a single-hand session has no gap to average), computes each
-- session's own mean inter-hand gap, then reports the mean/stddev/CV of
-- THOSE per-session means. Same suspiciously-uniform threshold as
-- analyze_call_timing (coefficient of variation < 0.15) -- same manual-
-- review-only posture: this flags, it never blocks or bans, and carries no
-- EXECUTE grant to any client role.
create or replace function public.analyze_cross_session_timing(p_username text, p_session_limit int default 10)
returns table (
  sessions_analyzed int,
  session_mean_gaps numeric[],
  cross_session_mean_seconds numeric,
  cross_session_stddev_seconds numeric,
  cross_session_coefficient_of_variation numeric,
  suspiciously_uniform_across_sessions boolean
)
language sql
security definer
set search_path = public
stable
as $$
  with target_sessions as (
    select gs.id, gs.call_timestamps
      from public.game_sessions gs
      join public.profiles p on p.id = gs.user_id
     where lower(p.username) = lower(p_username)
       and array_length(gs.call_timestamps, 1) > 1
     order by gs.created_at desc
     limit p_session_limit
  ),
  per_session_gaps as (
    select ts.id as session_id,
           extract(epoch from (ts.call_timestamps[i] - ts.call_timestamps[i - 1])) as gap_seconds
      from target_sessions ts, generate_subscripts(ts.call_timestamps, 1) as i
     where i > 1
  ),
  per_session_means as (
    select session_id, avg(gap_seconds) as mean_gap
      from per_session_gaps
     group by session_id
  )
  select
    (select count(*) from target_sessions)::int,
    (select array_agg(round(mean_gap::numeric, 3) order by mean_gap) from per_session_means),
    round(avg(mean_gap)::numeric, 3),
    round(stddev(mean_gap)::numeric, 3),
    round((stddev(mean_gap) / nullif(avg(mean_gap), 0))::numeric, 3),
    coalesce(stddev(mean_gap) / nullif(avg(mean_gap), 0) < 0.15, false)
  from per_session_means;
$$;

revoke all on function public.analyze_cross_session_timing(text, int) from public, anon, authenticated;

-- Convenience for finding which session to run analyze_call_timing() on --
-- a reviewer looking at a specific player's contest-record streak can find
-- the right session_id here rather than needing to already know it.
create or replace function public.find_sessions_for_review(p_username text)
returns table (session_id uuid, deck_id text, win_streak int, status text, hand_count int, created_at timestamptz)
language sql
security definer
set search_path = public
stable
as $$
  select gs.id, gs.deck_id, gs.win_streak, gs.status, array_length(gs.call_timestamps, 1), gs.created_at
    from public.game_sessions gs
    join public.profiles p on p.id = gs.user_id
   where lower(p.username) = lower(p_username)
   order by gs.win_streak desc, gs.created_at desc
   limit 20;
$$;

revoke all on function public.find_sessions_for_review(text) from public, anon, authenticated;

-- ============================================================================
-- REMOVE ADS + AD SYSTEM
--
-- Non-consumable IAP (com.halifaxwaterco.hilo.removeads, $4.99) that only
-- ever toggles whether interstitial ads show -- it has no effect on
-- gameplay, odds, the deck, or the 101-games/day limit enforced above.
-- Everything in this section is deliberately kept separate from
-- start_game/make_call/bank_session/bust_session and the deck/odds
-- helpers -- the two new RPCs below only ever touch profiles' own
-- ad-related columns, nothing in game_sessions.
--
-- Written entirely with `if not exists`/`create or replace`, like the
-- rest of this file, so this whole section is safe to paste into the SQL
-- editor once against the already-live database, not just a fresh one.
--
-- SECURITY NOTE: profiles' existing "users can update their own profile"
-- RLS policy (near the top of this file) is row-scoped, not
-- column-scoped -- RLS alone can't stop a signed-in client from setting
-- ads_disabled = true on themselves directly via a plain client-side
-- update, bypassing the $4.99 purchase entirely.
-- ============================================================================

alter table public.profiles add column if not exists ads_disabled boolean not null default false;
alter table public.profiles add column if not exists last_ad_shown_at timestamptz;
alter table public.profiles add column if not exists hands_since_last_ad integer not null default 0;
-- Lifetime count of games this account has finished (busted or cashed),
-- summed across every deck -- distinct from deck_progress.games_played,
-- which is the same idea but scoped per (user, deck). Incremented once per
-- game end in finalize_session() below the "REMOVE ADS + AD SYSTEM"
-- section, not here -- this column only needed to exist by the time that
-- runs. Exists specifically to gate a new account's very first ad (see
-- should_show_pregame_ad/record_hand_for_ad_gate further down): neither
-- fires at all until this reaches 10, regardless of the 60-minute cooldown
-- or 30-hand pacing below.
alter table public.profiles add column if not exists games_completed integer not null default 0;
-- Preference, not server-owned state -- same "direct client update, no
-- RPC" pattern as equipped_theme. Reappears automatically after a refund
-- because app-store-notifications (the ASSN v2 webhook, see
-- supabase/functions/app-store-notifications) resets this to false
-- whenever it flips ads_disabled back to false.
alter table public.profiles add column if not exists remove_ads_banner_dismissed boolean not null default false;

-- ---------------------------------------------------------------------------
-- CLIENT-WRITABLE COLUMN ALLOWLIST for profiles.
--
-- This used to be a narrow `revoke update (ads_disabled, last_ad_shown_at,
-- hands_since_last_ad) on public.profiles from authenticated, anon;` here.
-- That statement is a no-op against Supabase's default setup and always
-- was: Supabase grants `update on all tables in schema public` to
-- authenticated/anon at the TABLE level when a project is created. Postgres
-- privileges are additive across table-level and column-level ACLs -- a
-- column-level REVOKE only removes a column-level grant, it cannot cancel
-- out a table-level grant that's still sitting underneath it authorizing
-- every column regardless. So that revoke ran clean, with no error, and
-- changed nothing: `ads_disabled` (and every other column on this table,
-- including is_admin, is_contest_banned, lifeline_balance,
-- spendable_tokens, current_streak/longest_streak, has_banked_ever,
-- has_played_ever, referral_reward_granted, referred_signups_count,
-- qualified_referral_count, referred_by, last_banked_date) was directly
-- writable by any authenticated client the entire time, bypassing every
-- RPC that was supposed to be the only path to these values -- most
-- seriously, a client could set is_admin = true on their own row and
-- check_daily_play_limit() (defined earlier in this file) would then exempt that account from
-- the 101-games/day cap entirely, or inflate lifeline_balance /
-- spendable_tokens directly, removing the cost those limits exist to
-- impose. All of this was reachable via a plain
-- supabase-js `.from('profiles').update(...)` call -- no UI needed, since
-- the anon/authenticated key is necessarily public. Confirmed live via
-- `select grantee, column_name from information_schema.column_privileges
-- where table_name = 'profiles' and privilege_type = 'UPDATE';` before and
-- after this fix.
--
-- The only correct way to carve out column-level exceptions is to revoke
-- the table-level grant entirely, then re-grant UPDATE column-by-column
-- for exactly what should stay client-writable. anon gets nothing --
-- RLS's `with check (auth.uid() = id)` can never pass for a signed-out
-- request in the first place, so there's no legitimate case for it to hold
-- any UPDATE grant on this table at all.
-- ---------------------------------------------------------------------------
revoke update on public.profiles from authenticated, anon;
grant update (username, avatar, equipped_theme, game_mode, remove_ads_banner_dismissed)
  on public.profiles to authenticated;

-- iap_transactions: one row per StoreKit transaction ever seen for this
-- product, keyed for idempotency on Apple's own stable
-- original_transaction_id -- the same id a refund notification carries,
-- which is how app-store-notifications below finds the right user
-- without trusting anything client-supplied. status starts 'pending' the
-- moment a client's first verification attempt is made and only ever
-- moves forward to 'verified' or 'refunded', never back to 'pending' --
-- so the client's "still confirming" UI state only ever reflects a real
-- in-flight verification.
--
-- No insert/update policy for any client role -- rows are only ever
-- written by the two Edge Functions (verify-iap-receipt,
-- app-store-notifications), both running with the service role key,
-- which bypasses RLS entirely. The one select policy below exists solely
-- so the client can poll its own pending purchase for the "Confirming
-- your purchase..." UI state.
create table if not exists public.iap_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  product_id text not null,
  original_transaction_id text not null,
  transaction_id text not null,
  signed_transaction_info text,
  status text not null default 'pending' check (status in ('pending', 'verified', 'failed', 'refunded')),
  verification_attempts integer not null default 0,
  last_attempt_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists iap_transactions_original_transaction_id_idx
  on public.iap_transactions (original_transaction_id);

alter table public.iap_transactions enable row level security;
revoke all on public.iap_transactions from anon, authenticated;

create policy "users can read their own iap transactions"
  on public.iap_transactions for select
  using (auth.uid() = user_id);

-- Whether to show the pre-game interstitial: false immediately if ads are
-- disabled (purchased, and not since refunded), if the account hasn't yet
-- completed 10 full games (games_completed, added above -- a new
-- account's very first ad, from either gate, is pushed back until then),
-- or if last_ad_shown_at is less than 60 minutes old. If eligible,
-- atomically stamps last_ad_shown_at = now() in the same locked read that
-- decides "yes" -- the `for update` row lock means two concurrent calls
-- (e.g. two tabs) can't both come back "yes" for the same 60-minute
-- window. Deliberately does NOT touch last_ad_shown_at while gated on
-- games_completed, so the 60-minute cooldown starts counting fresh from
-- an account's actual first ad, not from some earlier moment during the
-- grace period.
--
-- Deliberately its own RPC, not folded into start_game -- keeps ad-gating
-- entirely outside the deck/session code path that start_game owns. The
-- client (src/ads/adGate.js#runPregameAdGate) calls this at most once per
-- app launch, before the first start_game() of that launch.
create or replace function public.should_show_pregame_ad() returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ads_disabled boolean;
  v_last_shown timestamptz;
  v_games_completed integer;
begin
  if auth.uid() is null then
    raise exception 'must be signed in';
  end if;
  perform public.check_rate_limit();

  select ads_disabled, last_ad_shown_at, games_completed
    into v_ads_disabled, v_last_shown, v_games_completed
    from public.profiles
   where id = auth.uid()
   for update;

  if coalesce(v_ads_disabled, false) then
    return false;
  end if;

  if coalesce(v_games_completed, 0) < 10 then
    return false;
  end if;

  if v_last_shown is not null and now() - v_last_shown < interval '60 minutes' then
    return false;
  end if;

  update public.profiles set last_ad_shown_at = now() where id = auth.uid();
  return true;
end;
$$;

revoke all on function public.should_show_pregame_ad() from public, anon, authenticated;
grant execute on function public.should_show_pregame_ad() to authenticated;

-- Whether to show the 30-hand interstitial: increments
-- hands_since_last_ad on every call (one call per resolved hand, fired
-- from the client independently of make_call itself -- see
-- src/ads/adGate.js#runHandAdGate), resetting to 0 and returning true the
-- moment it reaches 30. Skips entirely (no counter mutation at all) if
-- ads are disabled, same as should_show_pregame_ad above -- so a
-- Remove-Ads purchase mid-session doesn't leave a stale near-30 count
-- waiting to fire once ads are later re-enabled by a refund. Skips the
-- same no-mutation way until the account has completed 10 full games
-- (games_completed, added above) -- an account's early hands, before
-- that threshold, shouldn't silently build up progress toward an ad that
-- then fires the moment they cross it; the 30-hand count only starts
-- once ads become possible at all, matching should_show_pregame_ad's own
-- cooldown timestamp likewise never being touched during the grace
-- period.
create or replace function public.record_hand_for_ad_gate() returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ads_disabled boolean;
  v_games_completed integer;
  v_count integer;
begin
  if auth.uid() is null then
    raise exception 'must be signed in';
  end if;
  perform public.check_rate_limit();

  select ads_disabled, games_completed into v_ads_disabled, v_games_completed
    from public.profiles where id = auth.uid() for update;
  if coalesce(v_ads_disabled, false) then
    return false;
  end if;

  if coalesce(v_games_completed, 0) < 10 then
    return false;
  end if;

  update public.profiles
     set hands_since_last_ad = hands_since_last_ad + 1
   where id = auth.uid()
   returning hands_since_last_ad into v_count;

  if v_count >= 30 then
    update public.profiles set hands_since_last_ad = 0 where id = auth.uid();
    return true;
  end if;

  return false;
end;
$$;

revoke all on function public.record_hand_for_ad_gate() from public, anon, authenticated;
grant execute on function public.record_hand_for_ad_gate() to authenticated;
