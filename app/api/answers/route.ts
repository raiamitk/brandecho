import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// ── AI Answer Preview
// Strategy: try Gemini first (1 attempt + 1 retry), then fall back to Claude Haiku.
// Gemini free tier exhausts quickly during testing; Claude is already paid for and
// gives equally useful brand-mention signals.

export const maxDuration = 55;

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const CLAUDE_API_URL = "https://api.anthropic.com/v1/messages";
const CLAUDE_HAIKU   = "claude-haiku-4-5-20251001";

// ── Shared prompt builder ──────────────────────────────────────────────────────
function buildPrompt(queryLines: string, count: number): string {
  return `You are a helpful AI assistant. Answer each of the following questions as you genuinely would when a real user asks you. Each answer should be 3-5 sentences — factual, informative, and natural. Include specific brand, product, or company names where relevant.

Questions:
${queryLines}

Return ONLY a valid JSON array with exactly ${count} objects, one per question, in the same order:
[
  { "index": 1, "answer": "your answer here" },
  { "index": 2, "answer": "your answer here" }
]
No markdown, no explanation outside the JSON array.`;
}

// ── Parse the JSON array returned by either AI ─────────────────────────────────
function parseAnswers(rawText: string, count: number): { index: number; answer: string }[] {
  try {
    const clean = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    const arr = JSON.parse(clean);
    if (Array.isArray(arr)) return arr;
  } catch { /* fall through */ }
  // Fallback: wrap the whole text as answer 1
  return Array.from({ length: count }, (_, i) => ({ index: i + 1, answer: rawText }));
}

// ── Try Gemini (1 attempt + 1 fast retry on 429) ──────────────────────────────
async function tryGemini(prompt: string, apiKey: string): Promise<{ text: string; ok: boolean; rateLimited: boolean }> {
  const body = JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { maxOutputTokens: 3500, temperature: 0.3 },
  });

  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) await new Promise(r => setTimeout(r, 5000)); // 5s gap before retry
    const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      signal: AbortSignal.timeout(25000),
    });
    if (res.ok) {
      const data = await res.json();
      const text: string = data.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
      return { text, ok: true, rateLimited: false };
    }
    if (res.status !== 429) {
      // Non-retryable error
      return { text: "", ok: false, rateLimited: false };
    }
    // 429 — retry once, then give up and let Claude take over
  }
  return { text: "", ok: false, rateLimited: true };
}

// ── Try Claude Haiku (fallback) ────────────────────────────────────────────────
async function tryClaude(prompt: string): Promise<{ text: string; ok: boolean }> {
  try {
    const res = await fetch(CLAUDE_API_URL, {
      method: "POST",
      headers: {
        "Content-Type":      "application/json",
        "x-api-key":         process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model:      CLAUDE_HAIKU,
        max_tokens: 3500,
        messages:   [{ role: "user", content: prompt }],
      }),
      signal: AbortSignal.timeout(40000),
    });
    if (!res.ok) return { text: "", ok: false };
    const data = await res.json();
    const text: string = data.content?.[0]?.text || "[]";
    return { text, ok: true };
  } catch (e) {
    console.error("Claude fallback failed:", e);
    return { text: "", ok: false };
  }
}

export async function POST(req: NextRequest) {
  try {
    const { brand_id } = await req.json();
    if (!brand_id) return NextResponse.json({ error: "brand_id required" }, { status: 400 });

    // Load brand + top 8 queries + competitors
    const [brandRes, queryRes, compRes] = await Promise.all([
      supabase.from("brands").select("name, industry").eq("id", brand_id).single(),
      supabase.from("queries").select("id, text, type, intent, revenue_proximity")
        .eq("brand_id", brand_id)
        .order("revenue_proximity", { ascending: false })
        .limit(8),
      supabase.from("competitors").select("name").eq("brand_id", brand_id),
    ]);

    if (!brandRes.data) return NextResponse.json({ error: "Brand not found" }, { status: 404 });

    const brandName       = brandRes.data.name;
    const queries         = queryRes.data || [];
    const competitorNames = (compRes.data || []).map((c: { name: string }) => c.name);

    if (!queries.length) {
      return NextResponse.json({
        brand_name: brandName, competitor_names: competitorNames,
        total_queries: 0, brand_mentioned_count: 0, competitor_only_count: 0,
        available: true, ai_source: "none", answers: [],
      });
    }

    const queryLines = queries.map((q, i) => `${i + 1}. ${q.text}`).join("\n");
    const prompt     = buildPrompt(queryLines, queries.length);

    // ── 1. Try Gemini ──────────────────────────────────────────────────────────
    let rawText  = "";
    let aiSource = "gemini";
    const geminiKey = process.env.GEMINI_API_KEY;

    if (geminiKey && geminiKey !== "YOUR_GEMINI_API_KEY") {
      const geminiResult = await tryGemini(prompt, geminiKey);
      if (geminiResult.ok) {
        rawText = geminiResult.text;
      }
      // If rate-limited or failed → fall through to Claude
    }

    // ── 2. Fall back to Claude Haiku if Gemini didn't deliver ─────────────────
    if (!rawText) {
      aiSource = "claude";
      const claudeResult = await tryClaude(prompt);
      if (claudeResult.ok) {
        rawText = claudeResult.text;
      } else {
        // Both failed
        return NextResponse.json({
          brand_name: brandName, competitor_names: competitorNames,
          total_queries: queries.length, brand_mentioned_count: 0, competitor_only_count: 0,
          available: false, ai_source: "none",
          error: "Could not reach AI services — please try again shortly",
          answers: queries.map(q => ({
            query_id: q.id, query_text: q.text, type: q.type,
            revenue_proximity: q.revenue_proximity,
            answer: "", brand_mentioned: false, brand_mention_count: 0,
            competitors_mentioned: [] as string[], error: "AI unavailable",
          })),
        });
      }
    }

    // ── 3. Parse & annotate answers ────────────────────────────────────────────
    const parsed  = parseAnswers(rawText, queries.length);

    const answers = queries.map((q, i) => {
      const item   = parsed.find(p => p.index === i + 1) || parsed[i];
      const answer: string = item?.answer || "";
      const lower  = answer.toLowerCase();
      const bLow   = brandName.toLowerCase();

      const brandMentionCount = (
        lower.match(new RegExp(bLow.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []
      ).length;

      const competitorsMentioned = competitorNames.filter((name: string) =>
        lower.includes(name.toLowerCase())
      );

      return {
        query_id:              q.id,
        query_text:            q.text,
        type:                  q.type,
        revenue_proximity:     q.revenue_proximity,
        answer,
        brand_mentioned:       brandMentionCount > 0,
        brand_mention_count:   brandMentionCount,
        competitors_mentioned: competitorsMentioned,
        error:                 answer ? null : "No answer returned",
      };
    });

    const mentionedCount      = answers.filter(a => a.brand_mentioned).length;
    const competitorOnlyCount = answers.filter(
      a => !a.brand_mentioned && a.competitors_mentioned.length > 0
    ).length;

    return NextResponse.json({
      brand_name:            brandName,
      competitor_names:      competitorNames,
      total_queries:         queries.length,
      brand_mentioned_count: mentionedCount,
      competitor_only_count: competitorOnlyCount,
      available:             true,
      ai_source:             aiSource,
      answers,
    });

  } catch (e) {
    console.error("Answers API error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
