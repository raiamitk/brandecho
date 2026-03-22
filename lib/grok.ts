// ─────────────────────────────────────────────────────────────────────────────
//  Claude (Anthropic) API integration — optimized for token efficiency
// ─────────────────────────────────────────────────────────────────────────────

const CLAUDE_API_URL   = "https://api.anthropic.com/v1/messages";
const CLAUDE_MODEL     = "claude-sonnet-4-6";          // used for visibility/briefs/gap
const CLAUDE_MODEL_FAST = "claude-haiku-4-5-20251001"; // used for discovery (faster, fits Vercel 10s limit)

async function claudeChat(systemPrompt: string, userPrompt: string, maxTokens = 4000): Promise<string> {
  const res = await fetch(CLAUDE_API_URL, {
    method: "POST",
    headers: {
      "Content-Type":      "application/json",
      "x-api-key":         process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model:      CLAUDE_MODEL,
      max_tokens: maxTokens,
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

// ── ONE-SHOT discovery — brand + competitors + personas + queries + recs ──────
// Uses Haiku (fastest model) to complete in ~6-8s, well within Vercel's 10s limit.

export async function discoverAll(brandName: string, domain?: string) {
  const res = await fetch(CLAUDE_API_URL, {
    method: "POST",
    headers: {
      "Content-Type":      "application/json",
      "x-api-key":         process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model:      CLAUDE_MODEL_FAST,
      max_tokens: 4000,
      system:     "You are a brand intelligence and AEO expert. Return ONLY valid JSON. No markdown, no explanation.",
      messages: [{
        role: "user",
        content: `Analyse the brand "${brandName}"${domain ? ` (website: ${domain})` : ""} and return a single JSON object:

{
  "brand": {
    "domain": "official domain",
    "industry": "specific industry",
    "description": "2-sentence description",
    "brand_tone": "professional|casual|luxury|budget"
  },
  "competitors": [
    {"name":"","domain":"","type":"direct|category_substitute","why":"one sentence"}
  ],
  "personas": [
    {
      "name":"The [Archetype]",
      "archetype":"label",
      "age_range":"22-35",
      "income_level":"budget|mid|premium",
      "pain_points":["p1","p2"],
      "goals":["g1"],
      "ai_tools_used":["ChatGPT"],
      "query_style":"casual",
      "queries": [
        {
          "text":"natural question a real user would type into ChatGPT — NO brand name",
          "type":"aeo|geo|seo_longtail",
          "intent":"awareness|consideration|comparison|purchase",
          "revenue_proximity":75,
          "citations":[
            {"source":"Site Name","url_pattern":"domain.com","type":"forum|review_site|comparison_site|news|expert_guide|video","why":"one sentence"}
          ]
        }
      ]
    }
  ],
  "recommendations": [
    {"title":"","description":"2 sentences","category":"aeo|seo|content|technical","priority":"high|medium|low","projected_lift":"+20%","action_label":"button text"}
  ]
}

RULES:
- 6 competitors (3 direct, 3 category_substitute)
- 3 personas (one budget, one mid, one premium income level)
- 4 queries per persona, zero brand name in any query text
- 1 citation per query
- 4 recommendations`,
      }],
    }),
    signal: AbortSignal.timeout(55000),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  const text = data.content[0].text.trim()
    .replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  return JSON.parse(text);
}

// ── Brand Discovery (kept for backward compat) ────────────────────────────────

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
  // 8000 tokens: 3 personas × 5 queries × 3 citations each = large JSON payload
  const raw = await claudeChat(
    "You are a user research and AEO/GEO/SEO expert. Always return valid JSON only. No markdown.",
    `For "${brandName}" (${description}, ${industry}):
1. Generate 3 diverse user personas (budget / mid / premium income levels)
2. For each persona, generate 5 queries they would type into ChatGPT, Perplexity, or Google to find a solution

═══ CRITICAL QUERY RULES — read carefully ═══

RULE 1 — ZERO brand name: NEVER include "${brandName}" or any specific brand name alone in the query. The user hasn't chosen yet.

RULE 2 — Sound EXACTLY like a real person asking an AI assistant. Use natural language:
  ✅ "what's the best shaving razor under ₹300 for daily use?"
  ✅ "which zero-brokerage stock app is safest for first-time investors in India?"
  ✅ "is it worth switching from Zerodha to a newer trading app?"
  ✅ "Zerodha vs Groww vs Angel One — which charges less for beginners?"
  ✅ "how do I start investing in mutual funds without paying commission?"
  ❌ "Kotak Neo features" (branded, navigational)
  ❌ "best app" (too vague, not how people actually ask)

RULE 3 — Tailor queries to THAT persona's income_level and pain_points:
  • budget persona → queries include price caps ("under ₹X"), free options, "no hidden charges"
  • mid persona → queries about features vs cost, safety, reliability
  • premium persona → queries about best-in-class, professional features, advanced use cases

RULE 4 — revenue_proximity = how close this person is to pulling out their wallet RIGHT NOW:
  90–100: Ready to buy. Comparing final 2-3 options. ("X vs Y which should I buy today?")
  70–89:  Evaluating. Reading reviews. ("is X reliable for daily use?", "best X under budget")
  50–69:  Considering. Learning what exists. ("how does X type of product work?")
  20–49:  Awareness. Just discovered the need. ("what is X?", "do I even need X?")

RULE 5 — Add 3 citations per query: real sources that AI engines (ChatGPT, Perplexity, Gemini) typically cite when answering this type of query. These tell the brand WHERE to earn mentions to influence AI answers.
  • Types: "review_site" | "comparison_site" | "forum" | "news" | "expert_guide" | "video"
  • Examples: Reddit threads, Wirecutter-style reviews, YouTube reviews, industry news, expert blogs

═══════════════════════════════════════════════

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
      "income_level": "budget|mid|premium",
      "discovery_channel": "how they find brands",
      "queries": [
        {
          "text": "natural language question as typed into AI — NO brand name",
          "type": "aeo|geo|seo_longtail",
          "intent": "awareness|consideration|comparison|purchase",
          "revenue_proximity": 75,
          "citations": [
            {"source": "Source Name (e.g. Reddit r/personalfinance)", "url_pattern": "reddit.com/r/personalfinance", "type": "forum", "why": "one sentence: why AI cites this for this query"},
            {"source": "Source Name", "url_pattern": "domain.com", "type": "review_site", "why": "one sentence"},
            {"source": "Source Name", "url_pattern": "domain.com", "type": "comparison_site", "why": "one sentence"}
          ]
        }
      ]
    }
  ]
}`,
    8000
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
