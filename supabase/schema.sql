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
--                             Used only to detect "this is the qualifying
--                             moment" for a referral reward — a referred
--                             user only ever pays out their referrer once.
--   referral_reward_granted — guards that one-time payout specifically (set
--                             on the REFERRED user's own row).
--   referred_signups_count  — raw count of accounts created via this user's
--                             referral link, qualified or not.
--   qualified_referral_count — count of those signups that went on to bank
--                             at least once (email verification is implicit
--                             under our OTP-only auth — there's no
--                             unverified-email state to check separately).
--   lifeline_balance        — spendable "Save the Game" lifeline count.
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
  referral_reward_granted boolean not null default false,
  referred_signups_count integer not null default 0,
  qualified_referral_count integer not null default 0,
  lifeline_balance integer not null default 0,
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
-- On an actual Bank, this also: adds to spendable_tokens (the lifeline-
-- redemption pool — separate from cumulative_banked, which must never
-- decrease), and, the FIRST time this account ever banks, pays out a
-- one-time referral reward (5 lifelines + a qualified-referral credit) to
-- whoever referred them, if anyone did and it hasn't already been paid.
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
  v_had_banked_before boolean;
  v_referred_by uuid;
  v_reward_granted boolean;
begin
  if auth.uid() is null then
    raise exception 'must be signed in';
  end if;

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

  if p_was_banked then
    select last_banked_date, current_streak, longest_streak, has_banked_ever, referred_by, referral_reward_granted
      into v_last, v_current, v_longest, v_had_banked_before, v_referred_by, v_reward_granted
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

    -- One-time referral payout: only on this account's very first bank ever.
    if not coalesce(v_had_banked_before, false) and v_referred_by is not null and not coalesce(v_reward_granted, false) then
      update public.profiles set referral_reward_granted = true where id = auth.uid();
      update public.profiles
         set lifeline_balance = lifeline_balance + 5,
             qualified_referral_count = qualified_referral_count + 1
       where id = v_referred_by;
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

  select referred_by is not null into v_already_referred from public.profiles where id = auth.uid();
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
     set spendable_tokens = spendable_tokens - v_cost,
         lifeline_balance = lifeline_balance + 1
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

  update public.profiles set lifeline_balance = lifeline_balance - 1 where id = auth.uid();

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

-- Leaderboard 2: lifetime hands won, summed across all four decks — safe to
-- combine since it's a raw count, not a deck-scaled currency. Not affected
-- by is_contest_banned (that exclusion is Single Deck Win Streak only).
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
