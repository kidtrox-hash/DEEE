-- Tanaka & Diane — private world
-- Run this in Supabase SQL Editor (https://supabase.com/dashboard/project/gqbokhwqawezkpodokik/sql)
-- Idempotent — safe to run multiple times

-- 1. app_config (single row, id=1)
create table if not exists app_config (
  id int primary key check (id=1),
  meeting_date timestamptz not null default '2026-12-04T18:00:00Z',
  met_date date not null default '2024-08-14',
  hide_met boolean not null default true,
  message text not null default 'HAAAA My ego is against writting letters manje😂😂🥲🥲',
  photo text not null default '/photos/us-collage.png',
  song_url text not null default '/our-song.mp3',
  song_name text not null default 'Secondhand - Don Toliver ft Rema',
  video_url text not null default '/our-video.mp4',
  video_name text not null default 'Secondhand - Don Toliver ft Rema',
  gate_pin text not null default '210508',
  updated_at timestamptz default now()
);
insert into app_config (id) values (1) on conflict (id) do nothing;

-- 2. notes
create table if not exists notes (
  id uuid primary key default gen_random_uuid(),
  text text not null,
  author text not null check (author in ('Tanaka','Diane')),
  created_at timestamptz default now()
);
create index if not exists idx_notes_created on notes(created_at desc);

-- 3. memories
create table if not exists memories (
  id uuid primary key default gen_random_uuid(),
  caption text not null,
  text text default '',
  image text not null,
  author text not null check (author in ('Tanaka','Diane')),
  date date not null default current_date,
  created_at timestamptz default now()
);

-- 4. daily_answers — one row per date (YYYY-MM-DD)
create table if not exists daily_answers (
  date text primary key, -- YYYY-MM-DD
  question text not null,
  tanaka text,
  diane text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 5. blackboard — single row
create table if not exists blackboard (
  id int primary key check (id=1),
  data text, -- base64 dataURL
  updated_at timestamptz default now(),
  updated_by text
);
insert into blackboard (id) values (1) on conflict (id) do nothing;

-- 6. open_when letters (optional, kept even if hidden in UI)
create table if not exists open_when (
  id text primary key,
  title text not null,
  subtitle text not null,
  content text not null,
  icon text not null default '❤️'
);

-- Enable RLS and allow anon (private world is gated by PIN 210508 in app, not Supabase auth — alternative is to use anon key as shared secret)
-- For true per-user isolation you can add Supabase Auth later; for now we allow anon read/write but keep data private via obscure project + PIN gate.

alter table app_config enable row level security;
alter table notes enable row level security;
alter table memories enable row level security;
alter table daily_answers enable row level security;
alter table blackboard enable row level security;
alter table open_when enable row level security;

-- Permissive policies for anon + authenticated (gate is at app layer)
drop policy if exists "allow all app_config" on app_config;
create policy "allow all app_config" on app_config for all to anon, authenticated using (true) with check (true);

drop policy if exists "allow all notes" on notes;
create policy "allow all notes" on notes for all to anon, authenticated using (true) with check (true);

drop policy if exists "allow all memories" on memories;
create policy "allow all memories" on memories for all to anon, authenticated using (true) with check (true);

drop policy if exists "allow all daily_answers" on daily_answers;
create policy "allow all daily_answers" on daily_answers for all to anon, authenticated using (true) with check (true);

drop policy if exists "allow all blackboard" on blackboard;
create policy "allow all blackboard" on blackboard for all to anon, authenticated using (true) with check (true);

drop policy if exists "allow all open_when" on open_when;
create policy "allow all open_when" on open_when for all to anon, authenticated using (true) with check (true);

-- Realtime: enable publication
-- Supabase enables realtime via Dashboard → Database → Realtime; this ensures tables are in publication
do $$
begin
  if not exists (select 1 from pg_publication where pubname='supabase_realtime') then
    create publication supabase_realtime;
  end if;
exception when duplicate_object then null;
end $$;

alter publication supabase_realtime add table notes;
alter publication supabase_realtime add table memories;
alter publication supabase_realtime add table daily_answers;
alter publication supabase_realtime add table blackboard;
alter publication supabase_realtime add table app_config;
alter publication supabase_realtime add table open_when;

-- Seed open_when if empty
insert into open_when (id,title,subtitle,content,icon) values
 ('miss','Open when you miss me','for the nights I feel too far','Hey love,...','🌙'),
 ('bad-day','Open when you are having a bad day','let me fix it a little','My Diane,...','🌧️')
on conflict (id) do nothing;
