// ─────────────────────────────────────────────────────────────────────────────
//  Claude (Anthropic) API integration — optimized for token efficiency
// ─────────────────────────────────────────────────────────────────────────────

const CLAUDE_API_URL = "https://api.anthropic.com/v1/messages";
const CLAUDE_MODEL   = "claude-sonnet-4-6";

async function claudeChat(systemPrompt: string, userPrompt: string): Promise<string> {
  const res = await fetch(CLAUDE_API_URL, {
    method: "POST",
    headers: {
      "Content-Type":      "application/json",
      "x-api-key":         process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model:      CLAUDE_MODEL,
      max_tokens: 4000,
      system:     systemPrompt,
      messages:   [{ role: "user", content: userPrompt }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  const text = data.content[0].text.trim();
  return text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
}

// ── Brand Discovery ──────────────────────────────────────────────────────────

export async function discoverBrandInfo(brandName: string, domain?: string) {
  const raw = await claudeChat(
    "You are a precise brand intelligence analyst. Always return valid JSON only. No markdown, no explanation.",
    `For the brand "${brandName}"${domain ? ` (website: ${domain})` : ""}, return this JSON:
{"domain":"official website domain","industry":"specific industry category","description":"2-sentence brand description","primary_products":["product1"],"target_market":"brief target market","brand_tone":"professional/casual/luxury/budget"}`
  );
  return JSON.parse(raw);
}

// ── Competitor Discovery ─────────────────────────────────────────────────────

export async function discoverCompetitors(brandName: string, industry: string) {
  const raw = await claudeChat(
    "You are a competitive intelligence analyst. Always return valid JSON array only. No markdown.",
    `For "${brandName}" in "${industry}", identify 6 competitors (3 direct, 3 category substitutes).
Return JSON array: [{"name":"","domain":"","type":"direct|category_substitute","why":"one sentence"}]`
  );
  return JSON.parse(raw);
}

// ── Persona + Queries — ONE combined API call (biggest token saver) ───────────

export async function generatePersonasAndQueries(
  brandName: string,
  industry: string,
  description: string
) {
  const raw = await claudeChat(
    "You are a user research and SEO expert. Always return valid JSON only. No markdown.",
    `For "${brandName}" (${description}, ${industry}):
1. Generate 3 diverse user personas
2. For each persona, generate 5 targeted queries (mix of AEO, GEO, SEO)

Return a single JSON object:
{
  "personas": [
    {
      "name": "The [Archetype]",
      "archetype": "label",
      "age_range": "22-30",
      "occupation": "job",
      "pain_points": ["p1","p2"],
      "goals": ["g1"],
      "ai_tools_used": ["ChatGPT"],
      "query_style": "casual/formal/voice",
      "income_level": "budget/mid/premium",
      "discovery_channel": "how they find brands",
      "queries": [
        {"text":"query text","type":"aeo|geo|seo_longtail","intent":"awareness|consideration|purchase|comparison","revenue_proximity":50}
      ]
    }
  ]
}`
  );
  return JSON.parse(raw);
}

// ── AI Visibility Scoring — ONE batched Claude call for all queries ───────────

export async function scoreQueryVisibility(
  brandName: string,
  industry: string,
  queries: { id: string; text: string; type: string }[]
): Promise<Record<string, { claude_score: number; web_score: number; reason: string }>> {
  const queryList = queries.map((q, i) => `${i + 1}. [${q.id}] ${q.text}`).join("\n");
  const raw = await claudeChat(
    "You are an AEO (AI Engine Optimization) expert. Always return valid JSON only. No markdown.",
    `Brand: "${brandName}" | Industry: "${industry}"

For each query below, score how likely "${brandName}" would be mentioned by AI engines (ChatGPT, Perplexity, Gemini) if a user asked that exact query. Also score the brand's web authority signals for that query.

Queries:
${queryList}

Return JSON object keyed by the query ID string:
{
  "uuid-here": {
    "claude_score": 0-100,
    "web_score": 0-100,
    "reason": "one sentence why"
  }
}

Scoring guide:
- claude_score: probability AI engines cite this brand for this query (0=never, 100=always)
- web_score: strength of brand's web presence for this query (backlinks, reviews, directories)
- Be realistic. New/unknown brands score 10-30. Category leaders score 60-85.`
  );
  return JSON.parse(raw);
}

// ── Content Brief Generator ───────────────────────────────────────────────────

export async function generateContentBriefs(
  brandName: string,
  industry: string,
  queries: { id: string; text: string; intent: string; type: string; revenue_proximity: number }[]
) {
  const topQueries = [...queries].sort((a, b) => b.revenue_proximity - a.revenue_proximity).slice(0, 5);
  const queryList = topQueries.map((q, i) => `${i + 1}. [${q.id}] "${q.text}" (intent: ${q.intent}, type: ${q.type})`).join("\n");

  const raw = await claudeChat(
    "You are a content strategist specialising in AEO and AI-citation optimisation. Always return valid JSON only. No markdown.",
    `Brand: "${brandName}" | Industry: "${industry}"

Generate a detailed content brief for each query that, if published, would maximise the chance of AI engines citing "${brandName}" in responses.

Queries:
${queryList}

Return JSON array:
[
  {
    "query_id": "uuid",
    "query_text": "...",
    "recommended_title": "SEO/AEO optimised title",
    "content_type": "blog|faq|comparison|guide|case_study",
    "word_count": 1200,
    "h2_sections": ["H2 heading 1", "H2 heading 2", "H2 heading 3", "H2 heading 4"],
    "key_points": ["key point to include 1", "key point 2", "key point 3"],
    "citation_hook": "Why AI engines would cite this: one sentence",
    "schema_markup": "Article|FAQPage|HowTo",
    "estimated_impact": "high|medium|low"
  }
]`
  );
  return JSON.parse(raw);
}

// ── Competitor Gap Analysis ───────────────────────────────────────────────────

export async function analyzeCompetitorGaps(
  brandName: string,
  competitors: { name: string; type: string }[],
  queries: { id: string; text: string; type: string; intent: string }[]
) {
  const compList = competitors.slice(0, 4).map(c => c.name).join(", ");
  const queryList = queries.slice(0, 15).map((q, i) => `${i + 1}. [${q.id}] ${q.text}`).join("\n");

  const raw = await claudeChat(
    "You are a competitive intelligence analyst for AEO/SEO. Always return valid JSON only. No markdown.",
    `Brand: "${brandName}" | Competitors: ${compList}

For each query, estimate which brands (including "${brandName}") would likely appear in AI engine responses. Be realistic — smaller brands rarely appear for competitive queries.

Queries:
${queryList}

Return JSON array:
[
  {
    "query_id": "uuid",
    "brand_appears": true|false,
    "competitors_appear": ["CompetitorName1", "CompetitorName2"],
    "gap_type": "missing|weak|strong",
    "opportunity": "one sentence: what ${brandName} should do to appear for this query"
  }
]

gap_type guide:
- strong: brand appears, competitors don't
- weak: brand appears but competitors appear more prominently
- missing: brand doesn't appear but competitors do (this is a gap to fix)`
  );
  return JSON.parse(raw);
}

// ── Smart Recommendations ────────────────────────────────────────────────────

export async function generateRecommendations(
  brandName: string,
  industry: string,
  competitors: string[],
  queryCount: number
) {
  const raw = await claudeChat(
    "You are an SEO/AEO strategy consultant. Always return valid JSON array only. No markdown.",
    `For "${brandName}" in ${industry}, give 5 prioritized AEO+SEO recommendations.
Competitors: ${competitors.join(", ")}. Queries analysed: ${queryCount}.
Return JSON array: [{"title":"","description":"2 sentences","category":"aeo|seo|content|technical","priority":"high|medium|low","projected_lift":"e.g. +20%","action_label":"button text"}]`
  );
  return JSON.parse(raw);
}
