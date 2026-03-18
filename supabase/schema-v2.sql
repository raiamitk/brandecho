-- ─────────────────────────────────────────────────────────────────────────────
--  BrandEcho — Phase 2 Schema
--  Run this in Supabase SQL Editor after schema.sql (v1)
-- ─────────────────────────────────────────────────────────────────────────────

-- ── AI Visibility Scores ─────────────────────────────────────────────────────
create table if not exists visibility_scores (
  id             uuid default gen_random_uuid() primary key,
  brand_id       uuid references brands(id)  on delete cascade,
  query_id       uuid references queries(id) on delete cascade,
  claude_score   integer default 0,
  web_score      integer default 0,
  gemini_check   boolean default false,
  gemini_excerpt text,
  combined_score integer default 0,
  created_at     timestamp with time zone default now(),
  unique (brand_id, query_id)
);

alter table visibility_scores enable row level security;
create policy "Public access" on visibility_scores for all using (true) with check (true);

-- ── Content Briefs ───────────────────────────────────────────────────────────
create table if not exists content_briefs (
  id                 uuid default gen_random_uuid() primary key,
  brand_id           uuid references brands(id)  on delete cascade,
  query_id           uuid references queries(id) on delete cascade,
  query_text         text,
  recommended_title  text,
  content_type       text,
  word_count         integer default 1200,
  h2_sections        jsonb  default '[]',
  key_points         jsonb  default '[]',
  citation_hook      text,
  schema_markup      text,
  estimated_impact   text default 'medium',
  created_at         timestamp with time zone default now()
);

alter table content_briefs enable row level security;
create policy "Public access" on content_briefs for all using (true) with check (true);
