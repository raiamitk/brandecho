-- ─────────────────────────────────────────────────────────────────────────────
--  AEO + SEO Intelligence Tool — Supabase Schema
--  Run this in: Supabase Dashboard → SQL Editor → New Query → Run
-- ─────────────────────────────────────────────────────────────────────────────

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Brands ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS brands (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  domain      TEXT,
  industry    TEXT,
  description TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Personas ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS personas (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id      UUID REFERENCES brands(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  archetype     TEXT,
  age_range     TEXT,
  pain_points   TEXT[],
  goals         TEXT[],
  ai_tools_used TEXT[],
  query_style   TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── Queries ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS queries (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id          UUID REFERENCES brands(id) ON DELETE CASCADE,
  persona_id        UUID REFERENCES personas(id) ON DELETE SET NULL,
  text              TEXT NOT NULL,
  type              TEXT CHECK (type IN ('aeo', 'geo', 'seo_longtail')),
  intent            TEXT CHECK (intent IN ('awareness', 'consideration', 'purchase', 'comparison')),
  revenue_proximity INTEGER DEFAULT 50 CHECK (revenue_proximity BETWEEN 0 AND 100),
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ── Competitors ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS competitors (
  id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id  UUID REFERENCES brands(id) ON DELETE CASCADE,
  name      TEXT NOT NULL,
  domain    TEXT,
  type      TEXT CHECK (type IN ('direct', 'category_substitute')),
  aeo_score INTEGER DEFAULT 50,
  seo_score INTEGER DEFAULT 50,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Recommendations ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS recommendations (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id       UUID REFERENCES brands(id) ON DELETE CASCADE,
  title          TEXT NOT NULL,
  description    TEXT,
  category       TEXT CHECK (category IN ('aeo', 'seo', 'content', 'technical')),
  priority       TEXT CHECK (priority IN ('high', 'medium', 'low')),
  projected_lift TEXT,
  action_label   TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ── Row Level Security (RLS) ─────────────────────────────────────────────────
-- For MVP, allow public read/write. Lock down properly before going to production.
ALTER TABLE brands         ENABLE ROW LEVEL SECURITY;
ALTER TABLE personas       ENABLE ROW LEVEL SECURITY;
ALTER TABLE queries        ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitors    ENABLE ROW LEVEL SECURITY;
ALTER TABLE recommendations ENABLE ROW LEVEL SECURITY;

-- MVP policies: allow all operations (tighten this later)
CREATE POLICY "allow_all_brands"         ON brands         FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_personas"       ON personas       FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_queries"        ON queries        FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_competitors"    ON competitors    FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_recs"           ON recommendations FOR ALL USING (true) WITH CHECK (true);

-- ── Indexes for performance ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_personas_brand_id    ON personas(brand_id);
CREATE INDEX IF NOT EXISTS idx_queries_brand_id     ON queries(brand_id);
CREATE INDEX IF NOT EXISTS idx_queries_persona_id   ON queries(persona_id);
CREATE INDEX IF NOT EXISTS idx_competitors_brand_id ON competitors(brand_id);
CREATE INDEX IF NOT EXISTS idx_recs_brand_id        ON recommendations(brand_id);
