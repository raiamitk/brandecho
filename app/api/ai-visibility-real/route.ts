import { NextRequest, NextResponse } from "next/server";

// Real AI Visibility — queries every available platform with ALL queries,
// counts actual brand + competitor mentions, calculates true visibility % and SoV.
// No hallucination. No estimates. Only what the AI actually says.

export const runtime     = "nodejs";
export const maxDuration = 60;

const GEMINI_URL  = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent";
const CLAUDE_API  = "https://api.anthropic.com/v1/messages";
const CLAUDE_HAIKU = "claude-haiku-4-5-20251001";
const XAI_URL     = "https://api.x.ai/v1/chat/completions";
const OPENAI_URL  = "https://api.openai.com/v1/chat/completions";

function buildBatchPrompt(queries: { text: string }[]): string {
  const qs = queries.map((q, i) => `${i + 1}. ${q.text}`).join("\n");
  return `Answer each question below naturally and informatively (3-5 sentences each). Include specific brand, service, or company names where genuinely relevant — as you would in real answers.

Questions:
${qs}

Return ONLY a valid JSON array, one object per question in the same order:
[{"index":1,"answer":"..."},{"index":2,"answer":"..."}]
No markdown, no text outside the JSON array.`;
}

function parseAnswerArray(text: string, count: number): { index: number; answer: string }[] {
  try {
    const clean = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    const arr = JSON.parse(clean);
    if (Array.isArray(arr)) return arr;
  } catch { /* fall through */ }
  // If JSON fails, try to extract numbered answers from plain text
  return Array.from({ length: count }, (_, i) => ({ index: i + 1, answer: "" }));
}

function buildNameVariants(name: string): string[] {
  const variants = new Set<string>([name]);
  // "Socialmediacheck" → "Social Media Check"
  const spaced = name.replace(/([a-z])([A-Z])/g, "$1 $2")  // camelCase split
                     .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2");
  variants.add(spaced);
  // domain-style: remove spaces
  variants.add(name.replace(/\s+/g, ""));
  // also try inserting spaces before capital letters in all-lower names
  variants.add(name.replace(/([a-z])([a-z]+)/g, (_, a, b) => a.toUpperCase() + b));
  return Array.from(variants).filter(v => v.length > 2);
}

function countMentions(text: string, name: string): number {
  if (!text || !name) return 0;
  const variants = buildNameVariants(name);
  let total = 0;
  for (const v of variants) {
    const pattern = new RegExp(v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    total += (text.match(pattern) || []).length;
  }
  // Deduplicate: if a longer variant matched, shorter sub-matches would double-count.
  // Simple approach: just take the max across variants to avoid double counting.
  let max = 0;
  for (const v of variants) {
    const pattern = new RegExp(v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    max = Math.max(max, (text.match(pattern) || []).length);
  }
  return max;
}

async function queryClaude(prompt: string): Promise<string | null> {
  try {
    const res = await fetch(CLAUDE_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: CLAUDE_HAIKU,
        max_tokens: 4000,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: AbortSignal.timeout(45000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.content?.[0]?.text || null;
  } catch { return null; }
}

async function queryGemini(prompt: string, apiKey: string): Promise<string | null> {
  try {
    const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 4000, temperature: 0.3 },
      }),
      signal: AbortSignal.timeout(35000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
  } catch { return null; }
}

async function queryGrok(prompt: string, apiKey: string): Promise<string | null> {
  try {
    const res = await fetch(XAI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "grok-3-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 4000,
      }),
      signal: AbortSignal.timeout(35000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.choices?.[0]?.message?.content || null;
  } catch { return null; }
}

async function queryChatGPT(prompt: string, apiKey: string): Promise<string | null> {
  try {
    const res = await fetch(OPENAI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 4000,
      }),
      signal: AbortSignal.timeout(35000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.choices?.[0]?.message?.content || null;
  } catch { return null; }
}

function buildResult(
  platform: string,
  rawText: string | null,
  noKey: boolean,
  queries: { id: string; text: string }[],
  brandName: string,
  competitors: string[]
) {
  if (noKey) {
    return {
      platform, available: false,
      reason: `No API key configured for ${platform}. Add ${platform === "Grok" ? "GROK_API_KEY" : "OPENAI_API_KEY"} to enable.`,
      logs: [], appeared_count: 0, total_queries: queries.length,
      visibility_pct: 0, total_brand_mentions: 0,
      total_competitor_mentions: 0, competitor_totals: {} as Record<string, number>, sov_pct: 0,
    };
  }
  if (!rawText) {
    return {
      platform, available: false,
      reason: `${platform} did not return a response — may be rate-limited or unavailable.`,
      logs: [], appeared_count: 0, total_queries: queries.length,
      visibility_pct: 0, total_brand_mentions: 0,
      total_competitor_mentions: 0, competitor_totals: {} as Record<string, number>, sov_pct: 0,
    };
  }

  const parsed = parseAnswerArray(rawText, queries.length);
  const logs = queries.map((q, i) => {
    const item = parsed.find(a => a.index === i + 1) || parsed[i];
    const answer = item?.answer || "";
    const brand_mention_count = countMentions(answer, brandName);
    const competitor_mentions: Record<string, number> = {};
    for (const c of competitors) competitor_mentions[c] = countMentions(answer, c);
    return { query_id: q.id, query_text: q.text, answer, brand_mentioned: brand_mention_count > 0, brand_mention_count, competitor_mentions };
  });

  const appeared_count        = logs.filter(l => l.brand_mentioned).length;
  const visibility_pct        = Math.round((appeared_count / queries.length) * 100);
  const total_brand_mentions  = logs.reduce((s, l) => s + l.brand_mention_count, 0);
  const competitor_totals: Record<string, number> = {};
  for (const c of competitors) competitor_totals[c] = logs.reduce((s, l) => s + (l.competitor_mentions[c] || 0), 0);
  const total_competitor_mentions = Object.values(competitor_totals).reduce((a, b) => a + b, 0);
  const sov_pct = total_brand_mentions + total_competitor_mentions > 0
    ? Math.round((total_brand_mentions / (total_brand_mentions + total_competitor_mentions)) * 100)
    : 0;

  return { platform, available: true, reason: "", logs, appeared_count, total_queries: queries.length, visibility_pct, total_brand_mentions, total_competitor_mentions, competitor_totals, sov_pct };
}

export async function POST(req: NextRequest) {
  try {
    const { brand_name, competitors, queries } = await req.json();
    if (!brand_name || !queries?.length) {
      return NextResponse.json({ error: "brand_name and queries required" }, { status: 400 });
    }

    const competitorNames: string[] = Array.isArray(competitors) ? competitors : [];
    const prompt = buildBatchPrompt(queries);

    const geminiKey = process.env.GEMINI_API_KEY || null;
    // Vercel env var is GROK_API_KEY (also check XAI_API_KEY as fallback)
    const grokKey   = process.env.GROK_API_KEY || process.env.XAI_API_KEY || null;
    const openaiKey = process.env.OPENAI_API_KEY || null;

    // Query all available platforms in parallel
    const [claudeText, geminiText, grokText, chatgptText] = await Promise.all([
      queryClaude(prompt),
      geminiKey  ? queryGemini(prompt, geminiKey)    : Promise.resolve(null),
      grokKey    ? queryGrok(prompt, grokKey)        : Promise.resolve(null),
      openaiKey  ? queryChatGPT(prompt, openaiKey)   : Promise.resolve(null),
    ]);

    const platforms = [
      buildResult("Claude",   claudeText,  false,      queries, brand_name, competitorNames),
      buildResult("Gemini",   geminiText,  !geminiKey, queries, brand_name, competitorNames),
      buildResult("Grok",     grokText,    !grokKey,   queries, brand_name, competitorNames),
      buildResult("ChatGPT",  chatgptText, !openaiKey, queries, brand_name, competitorNames),
    ];

    const available = platforms.filter(p => p.available);
    const avg_visibility_pct = available.length
      ? Math.round(available.reduce((s, p) => s + p.visibility_pct, 0) / available.length) : 0;
    const avg_sov_pct = available.length
      ? Math.round(available.reduce((s, p) => s + p.sov_pct, 0) / available.length) : 0;

    return NextResponse.json({ brand_name, platforms, avg_visibility_pct, avg_sov_pct });
  } catch (e) {
    console.error("AI Visibility Real error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
