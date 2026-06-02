-- Jobs table (public read, service-role write via ingest)
create table if not exists public.jobs (
  id          uuid primary key default gen_random_uuid(),
  source      text not null,
  source_id   text not null,
  title       text not null,
  company     text not null default '',
  location    text,
  remote      boolean not null default false,
  url         text not null,
  description text,
  tags        text[] not null default '{}',
  salary      text,
  posted_at   timestamptz,
  raw         jsonb not null default '{}',
  fetched_at  timestamptz not null default now(),
  constraint jobs_source_unique unique (source, source_id)
);

-- Profiles (one per auth user)
create table if not exists public.profiles (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  prefs        jsonb not null default '{}'
);

-- CVs stored as rendercv YAML
create table if not exists public.cvs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  yaml        text not null,
  pdf_path    text,           -- Supabase Storage key
  updated_at  timestamptz not null default now()
);

-- Match results (CV <-> job scored by Claude)
create table if not exists public.matches (
  id          uuid primary key default gen_random_uuid(),
  cv_id       uuid not null references public.cvs(id) on delete cascade,
  job_id      uuid not null references public.jobs(id) on delete cascade,
  score       integer check (score between 1 and 10),
  reasoning   text,
  created_at  timestamptz not null default now()
);

-- Indexes
create index if not exists jobs_fetched_at_idx on public.jobs (fetched_at desc);
create index if not exists jobs_remote_idx on public.jobs (remote) where remote = true;
create index if not exists jobs_tags_gin on public.jobs using gin (tags);
create index if not exists matches_cv_idx on public.matches (cv_id);

-- RLS
alter table public.jobs    enable row level security;
alter table public.profiles enable row level security;
alter table public.cvs     enable row level security;
alter table public.matches  enable row level security;

-- jobs: anyone can read
create policy "jobs public read" on public.jobs for select using (true);

-- profiles, cvs, matches: owner only
create policy "profiles owner" on public.profiles using (auth.uid() = user_id);
create policy "cvs owner"      on public.cvs      using (auth.uid() = user_id);
create policy "matches owner"  on public.matches
  using (cv_id in (select id from public.cvs where user_id = auth.uid()));
