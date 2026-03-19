-- ─────────────────────────────────────────────────────────────────────────────
-- BrandEcho Schema v3 — Add citations column to queries table
-- Run this in Supabase SQL Editor (one-time migration)
-- ─────────────────────────────────────────────────────────────────────────────

-- Add citations JSONB column (stores 3 AI citation sources per query)
ALTER TABLE queries
  ADD COLUMN IF NOT EXISTS citations JSONB DEFAULT '[]'::jsonb;

-- Comment for clarity
COMMENT ON COLUMN queries.citations IS
  'Array of 3 sources AI engines cite for this query. Each: {source, url_pattern, type, why}';
