-- Hi-Lo Stakes — Phase 4 schema.
-- Run this once in the Supabase Dashboard: your project -> SQL Editor -> New query -> paste -> Run.

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
--                             New accounts start with 1, free.
--   spendable_tokens        — a SEPARATE pooled balance from
--                             leaderboard_scores.cumulative_banked (which
--                             must never decrease — it's the permanent
--                             Total Token Score record). This one increases
--                             on the same Bank event, but decreases by
--                             10,000 when redeem_lifeline() is called;
--                             spending it never touches any leaderboard.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null check (char_length(username) between 2 and 24),
  current_streak integer not null default 0,
  longest_streak integer not null default 0,
  last_banked_date date,
  equipped_theme text not null default 'classic',
  is_contest_banned boolean not null default false,
  referred_by uuid references public.profiles (id),
  has_banked_ever boolean not null default false,
  has_played_ever boolean not null default false,
  referral_reward_granted boolean not null default false,
  referred_signups_count integer not null default 0,
  qualified_referral_count integer not null default 0,
  lifeline_balance integer not null default 1,
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
  update public.profiles set referred_signups_count = referred_signups_count + 1 where id = v_referrer_id;

  return query select true;
end;
$$;

revoke all on function public.attribute_referral(text) from public;
grant execute on function public.attribute_referral(text) to authenticated;

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

revoke all on function public.redeem_lifeline() from public;
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

  select p.lifeline_balance into v_balance from public.profiles p where p.id = auth.uid();

  if coalesce(v_balance, 0) <= 0 then
    return query select false, coalesce(v_balance, 0);
    return;
  end if;

  update public.profiles set lifeline_balance = public.profiles.lifeline_balance - 1 where id = auth.uid();

  return query select true, p.lifeline_balance from public.profiles p where p.id = auth.uid();
end;
$$;

revoke all on function public.use_lifeline() from public;
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
returns table (username text, best_win_streak integer, updated_at timestamptz)
language sql
security definer
set search_path = public
stable
as $$
  select p.username, dp.best_win_streak, dp.updated_at
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
returns table (username text, total_hands_won bigint)
language sql
security definer
set search_path = public
stable
as $$
  select p.username, sum(dp.hands_won) as total_hands_won
    from public.deck_progress dp
    join public.profiles p on p.id = dp.user_id
   where dp.deck_id = 'single-deck'
   group by p.id, p.username
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
