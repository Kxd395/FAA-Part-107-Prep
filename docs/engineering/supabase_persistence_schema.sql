-- Part107 Prep persistence tables
-- Generated: 2026-02-26

create table if not exists public.part107_user_state (
  user_id text primary key,
  updated_at timestamptz not null default now(),
  data jsonb not null default '{}'::jsonb
);

create table if not exists public.part107_learning_events (
  user_id text not null,
  event_id text not null,
  timestamp timestamptz not null,
  type text not null,
  mode text not null,
  question_id text null,
  category text null,
  subcategory text null,
  is_correct boolean null,
  question_type_profile text null,
  metadata jsonb null,
  inserted_at timestamptz not null default now(),
  primary key (user_id, event_id)
);

create index if not exists idx_part107_learning_events_user_ts
  on public.part107_learning_events (user_id, timestamp asc);

create table if not exists public.part107_question_issues (
  user_id text not null,
  report_id text not null,
  created_at timestamptz not null,
  mode text not null,
  question_id text not null,
  question_text text not null,
  category text not null,
  subcategory text not null,
  options jsonb not null,
  correct_option_id text not null,
  selected_option_id text null,
  note text not null,
  question_type_profile text null,
  source text null,
  source_type text null,
  confidence smallint null,
  metadata jsonb null,
  inserted_at timestamptz not null default now(),
  primary key (user_id, report_id)
);

create index if not exists idx_part107_question_issues_user_created
  on public.part107_question_issues (user_id, created_at asc);

-- This app currently authenticates users with its own signed session cookie,
-- not Supabase Auth JWT. Recommended deployment:
-- - Keep service-role key server-side only.
-- - Do not expose service-role key to client.
-- - Restrict access via your backend API routes.
