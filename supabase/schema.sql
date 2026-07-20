-- Hi-Lo Stakes — Phase 4 schema.
-- Run this once in the Supabase Dashboard: your project -> SQL Editor -> New query -> paste -> Run.

-- profiles: one row per authenticated user, created on first sign-in.
-- Username uniqueness is enforced case-insensitively (see the index below)
-- so "Will" and "will" can't both exist as distinct, confusable usernames.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null check (char_length(username) between 2 and 24),
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

-- level_progress: per-user, per-level unlock-gating state (best streak,
-- Same/Red-Black hits, longest-shot odds). Not public — only its own owner
-- can read it. All writes go through record_level_progress() below, never
-- direct table access, so there are no insert/update policies at all.
create table public.level_progress (
  user_id uuid not null references public.profiles (id) on delete cascade,
  level_id text not null,
  best_streak integer not null default 0,
  same_hit boolean not null default false,
  red_black_hit boolean not null default false,
  lowest_odds_same_hit double precision,
  updated_at timestamptz not null default now(),
  primary key (user_id, level_id)
);

alter table public.level_progress enable row level security;

create policy "users can read their own level progress"
  on public.level_progress for select
  using (auth.uid() = user_id);

-- leaderboard_scores: per-user, per-level. Two independent metrics:
--   cumulative_banked — lifetime sum of amounts actually locked in via Bank.
--                       Only ever increases; busted runs never add to it.
--   peak_score        — the highest `banked` value any single run of theirs
--                       ever reached, whether that run ended in a Bank or a
--                       Bust. Updates in both cases — that's the point of it.
-- Publicly readable (the leaderboard itself needs no account to view). All
-- writes go through record_run_end() below, never direct table access, so
-- there are no insert/update policies at all.
create table public.leaderboard_scores (
  user_id uuid not null references public.profiles (id) on delete cascade,
  level_id text not null,
  cumulative_banked bigint not null default 0,
  peak_score bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, level_id)
);

alter table public.leaderboard_scores enable row level security;

create policy "leaderboard scores are publicly readable"
  on public.leaderboard_scores for select
  using (true);

-- Atomically records one run's end (Bank or Bust). SECURITY DEFINER lets
-- this bypass RLS to perform the upsert, but it always operates on
-- auth.uid() internally — never a client-supplied user id — so a caller can
-- only ever affect their own row despite the function's elevated privilege.
create or replace function public.record_run_end(
  p_level_id text,
  p_amount bigint,
  p_was_banked boolean
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'must be signed in';
  end if;

  insert into public.leaderboard_scores (user_id, level_id, cumulative_banked, peak_score, updated_at)
  values (
    auth.uid(),
    p_level_id,
    case when p_was_banked then p_amount else 0 end,
    p_amount,
    now()
  )
  on conflict (user_id, level_id) do update set
    cumulative_banked = public.leaderboard_scores.cumulative_banked
      + (case when p_was_banked then p_amount else 0 end),
    peak_score = greatest(public.leaderboard_scores.peak_score, p_amount),
    updated_at = now();
end;
$$;

revoke all on function public.record_run_end(text, bigint, boolean) from public;
grant execute on function public.record_run_end(text, bigint, boolean) to authenticated;

-- Atomically folds one correct call's result into level_progress, mirroring
-- the pure fold in src/persistence/progress.js#applyCorrectCall. Same
-- SECURITY DEFINER + auth.uid()-only pattern as record_run_end above.
create or replace function public.record_level_progress(
  p_level_id text,
  p_streak integer,
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

  insert into public.level_progress (user_id, level_id, best_streak, same_hit, red_black_hit, lowest_odds_same_hit, updated_at)
  values (
    auth.uid(),
    p_level_id,
    p_streak,
    p_same_hit,
    p_red_black_hit,
    case when p_same_hit then p_same_odds else null end,
    now()
  )
  on conflict (user_id, level_id) do update set
    best_streak = greatest(public.level_progress.best_streak, p_streak),
    same_hit = public.level_progress.same_hit or p_same_hit,
    red_black_hit = public.level_progress.red_black_hit or p_red_black_hit,
    lowest_odds_same_hit = case
      when p_same_hit and public.level_progress.lowest_odds_same_hit is null then p_same_odds
      when p_same_hit then least(public.level_progress.lowest_odds_same_hit, p_same_odds)
      else public.level_progress.lowest_odds_same_hit
    end,
    updated_at = now();
end;
$$;

revoke all on function public.record_level_progress(text, integer, boolean, boolean, double precision) from public;
grant execute on function public.record_level_progress(text, integer, boolean, boolean, double precision) to authenticated;
