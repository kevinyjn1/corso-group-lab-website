-- The shared leaderboard for Ground Truth, the hidden game.
--
-- Run this once in the SQL editor of a Supabase project. Then give the site the project's URL
-- and its public (anon or publishable) key, as described in the README. Visitors can read the
-- board and add a score. Nobody can change or delete a score from the website.

create table if not exists public.scores (
  id bigint generated always as identity primary key,
  -- One to three capital letters or digits, like initials on an arcade cabinet.
  name text not null check (
    name ~ '^[A-Z0-9]{1,3}$'
    and name not in (
      'ASS', 'FUK', 'FUC', 'FCK', 'FUX', 'SEX', 'CUM', 'FAG', 'NIG', 'NGR', 'KKK', 'TIT',
      'DIK', 'DIC', 'COK', 'KOK', 'PUS', 'JEW', 'NAZ', 'HOR', 'SUK', 'JIZ', 'CNT', 'KYS'
    )
  ),
  score integer not null check (score between 1 and 200000),
  wave integer not null check (wave between 1 and 500),
  created_at timestamptz not null default now()
);

create index if not exists scores_by_score on public.scores (score desc, created_at asc);

alter table public.scores enable row level security;

drop policy if exists "Anyone can read the board" on public.scores;
create policy "Anyone can read the board" on public.scores
  for select to anon using (true);

drop policy if exists "Anyone can post a score" on public.scores;
create policy "Anyone can post a score" on public.scores
  for insert to anon with check (true);

-- To clear the board:      truncate public.scores;
-- To remove one entry:     delete from public.scores where id = <id>;
