-- The Name Game leaderboard.
-- Run once: Supabase -> SQL Editor -> New query -> paste all of this -> Run.

create table if not exists public.name_game_scores (
  user_id uuid not null references public.profiles (id) on delete cascade,
  mode text not null check (mode in ('season', 'franchise')),
  best_streak integer not null check (best_streak between 1 and 500),
  updated_at timestamptz not null default now(),
  primary key (user_id, mode)
);

create index if not exists name_game_scores_top_idx
  on public.name_game_scores (mode, best_streak desc, updated_at);

alter table public.name_game_scores enable row level security;

drop policy if exists "name game scores are publicly readable" on public.name_game_scores;
create policy "name game scores are publicly readable"
  on public.name_game_scores for select
  using (true);
-- No insert/update policy: the only way to write is the function below,
-- which always writes the signed-in caller's own row.

create or replace function public.submit_name_game_streak(p_mode text, p_streak integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'sign in required';
  end if;
  if p_mode not in ('season', 'franchise') or p_streak < 1 or p_streak > 500 then
    raise exception 'invalid score';
  end if;
  insert into public.name_game_scores (user_id, mode, best_streak)
  values (auth.uid(), p_mode, p_streak)
  on conflict (user_id, mode) do update
    set best_streak = excluded.best_streak,
        updated_at = now()
    where excluded.best_streak > public.name_game_scores.best_streak;
end;
$$;

revoke all on function public.submit_name_game_streak(text, integer) from public, anon;
grant execute on function public.submit_name_game_streak(text, integer) to authenticated;
