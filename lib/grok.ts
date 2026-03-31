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

// ── PART A: Brand + Competitors + Recommendations (~5-8s, ~1400 tokens) ───────
// Run in parallel with Part B so total time = max(A,B) not A+B.

export async function discoverPartA(brandName: string, domain?: string, geo?: { country: string; city?: string }) {
  const geoCtx = geo?.city ? `${geo.city}, ${geo.country}` : (geo?.country || "India");
  const res = await fetch(CLAUDE_API_URL, {
    method: "POST",
    headers: {
      "Content-Type":      "application/json",
      "x-api-key":         process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model:      CLAUDE_MODEL_FAST,
      max_tokens: 1400,
      system:     "You are a brand intelligence expert. Return ONLY valid JSON. No markdown.",
      messages: [{
        role: "user",
        content: `Analyse brand "${brandName}"${domain ? ` (website: ${domain})` : ""}
Geo context: ${geoCtx}
Return:
{
  "brand": {
    "domain": "official domain",
    "industry": "specific industry (e.g. Quick Commerce, Online Brokerage)",
    "description": "2-sentence brand description",
    "brand_tone": "professional|casual|luxury|budget"
  },
  "competitors": [
    {"name":"","domain":"","type":"direct|category_substitute","why":"one sentence"}
  ],
  "recommendations": [
    {"title":"","description":"2 sentences","category":"aeo|seo|content|technical","priority":"high|medium|low","projected_lift":"+20%","action_label":"button text"}
  ]
}
RULES: 6 competitors (3 direct, 3 category_substitute). 4 recommendations.`,
      }],
    }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) { const err = await res.text(); throw new Error(`Claude Part A error ${res.status}: ${err}`); }
  const data = await res.json();
  const text = data.content[0].text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  return JSON.parse(text) as {
    brand: { domain: string; industry: string; description: string; brand_tone: string };
    competitors: { name: string; domain: string; type: string; why: string }[];
    recommendations: { title: string; description: string; category: string; priority: string; projected_lift: string; action_label: string }[];
  };
}

// ── PART B: Personas + Queries (~8-12s, ~2500 tokens) ────────────────────────
// Runs in parallel with Part A — infers industry from brand name + domain itself.

export async function discoverPartB(brandName: string, domain?: string, geo?: { country: string; city?: string }) {
  const res = await fetch(CLAUDE_API_URL, {
    method: "POST",
    headers: {
      "Content-Type":      "application/json",
      "x-api-key":         process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model:      CLAUDE_MODEL_FAST,
      max_tokens: 8000,
      system:     "You are a user research and AEO expert. Return ONLY valid JSON. No markdown.",
      messages: [{
        role: "user",
        content: `For brand "${brandName}"${domain ? ` (website: ${domain})` : ""}, generate 3 diverse buyer personas with queries.
Geo: ${geo?.city ? `${geo.city}, ` : ""}${geo?.country || "India"}
Return JSON:
{
  "personas": [
    {
      "name": "The [Archetype]",
      "archetype": "label",
      "age_range": "22-35",
      "income_level": "budget|mid|premium",
      "pain_points": ["p1", "p2"],
      "goals": ["g1"],
      "ai_tools_used": ["ChatGPT"],
      "query_style": "casual",
      "queries": [
        {
          "text": "natural question as typed into ChatGPT — NO brand name",
          "type": "aeo|geo|seo_longtail",
          "intent": "awareness|consideration|comparison|purchase",
          "revenue_proximity": 75,
          "funnel_stage": "TOFU|MOFU|BOFU",
          "citations": [
            {"source":"Site Name","url_pattern":"domain.com","type":"forum|review_site|comparison_site|news|expert_guide|video","why":"one sentence"}
          ]
        }
      ]
    }
  ]
}
RULES: 3 personas (budget, mid, premium). 25 queries each (75 total). 1 citation per query. NEVER include brand name in queries.
funnel_stage: TOFU=awareness (rev_prox 20-49), MOFU=consideration/comparison (50-79), BOFU=purchase (80-100).
Min 8 TOFU, 8 MOFU, 8 BOFU per persona.`,
      }],
    }),
    signal: AbortSignal.timeout(40000),
  });
  if (!res.ok) { const err = await res.text(); throw new Error(`Claude Part B error ${res.status}: ${err}`); }
  const data = await res.json();
  const text = data.content[0].text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  return JSON.parse(text) as {
    personas: {
      name: string; archetype: string; age_range: string; income_level: string;
      pain_points: string[]; goals: string[]; ai_tools_used: string[]; query_style: string;
      queries: { text: string; type: string; intent: string; revenue_proximity: number; funnel_stage: string; citations: object[] }[];
    }[];
  };
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
  queries: { id: string; text: string; type: string }[],
  description?: string
): Promise<Record<string, { claude_score: number; web_score: number; reason: string }>> {
  const queryList = queries.map((q, i) => `${i + 1}. [${q.id}] ${q.text}`).join("\n");
  const brandContext = description ? `\nBrand context: ${description}` : "";
  const raw = await claudeChat(
    "You are an AEO (AI Engine Optimization) expert. Always return valid JSON only. No markdown.",
    `Brand: "${brandName}" | Industry: "${industry}"${brandContext}

For each query, score how likely "${brandName}" is to be mentioned by AI engines (ChatGPT, Perplexity, Gemini).

Queries:
${queryList}

Return JSON object keyed by query ID:
{
  "uuid-here": {
    "claude_score": 0-100,
    "web_score": 0-100,
    "reason": "one sentence why"
  }
}

Scoring guide — be ACCURATE, not pessimistic:
- For queries directly about the brand's core product/service category: score 50-80 if the brand is established
- For queries where the brand is a category leader or well-known: score 65-90
- For queries outside the brand's core strength: score 20-50
- For highly generic queries with many competitors: score 30-60
- claude_score: likelihood AI engines cite this brand (factor in brand's market position and relevance)
- web_score: brand's web authority for this query (reviews, directories, press coverage)
- A known brand in its own industry should score 40-70 for relevant queries. Reserve sub-30 scores only for completely irrelevant queries.`
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
  queries: { id: string; text: string; type: string; intent: string }[],
  description?: string
) {
  const compList = competitors.slice(0, 4).map(c => c.name).join(", ");
  const queryList = queries.slice(0, 15).map((q, i) => `${i + 1}. [${q.id}] ${q.text}`).join("\n");
  const brandContext = description ? `\nBrand context: ${description}` : "";

  const raw = await claudeChat(
    "You are a competitive intelligence analyst for AEO/SEO. Always return valid JSON only. No markdown.",
    `Brand: "${brandName}" | Competitors: ${compList}${brandContext}

For each query, estimate which brands appear in AI engine answers. Use a BALANCED assessment — an established brand in its own category WILL appear for many relevant queries. Do NOT default everything to "missing".

Queries:
${queryList}

Return JSON array:
[
  {
    "query_id": "uuid",
    "brand_appears": true|false,
    "competitors_appear": ["CompetitorName1", "CompetitorName2"],
    "gap_type": "missing|weak|strong",
    "opportunity": "one sentence: specific action for ${brandName}"
  }
]

gap_type guide:
- strong: brand appears prominently, ahead of competitors — use this for the brand's core strengths
- weak: brand appears but competitors are also prominent — use for competitive areas
- missing: brand absent, competitors dominate — use for genuine gaps outside core strength

Expected distribution for an established brand: ~30% strong, ~40% weak, ~30% missing. Avoid rating everything as missing — that is inaccurate for real brands.`
  );
  return JSON.parse(raw);
}

// ── Per-Platform AI Visibility ────────────────────────────────────────────────

export async function scorePlatformVisibility(
  brandName: string,
  industry: string,
  description?: string,
  geo?: { country: string; city?: string }
): Promise<{ platform: string; ai_visibility_score: number; share_of_voice: number; sentiment: "positive" | "neutral" | "negative"; reasoning: string }[]> {
  const geoCtx = geo?.city ? `${geo.city}, ${geo.country}` : (geo?.country || "India");
  const raw = await claudeChat(
    "You are an AI visibility analyst. Return ONLY valid JSON. No markdown.",
    `Brand: "${brandName}" | Industry: "${industry}"${description ? ` | ${description}` : ""} | Geo: ${geoCtx}

Estimate how well "${brandName}" appears when users ask about its category on each AI platform.

Return a JSON array for exactly these 4 platforms: Gemini, Grok, Claude, ChatGPT

[
  {
    "platform": "Gemini",
    "ai_visibility_score": 0-100,
    "share_of_voice": 0-100,
    "sentiment": "positive|neutral|negative",
    "reasoning": "one sentence why"
  }
]

Scoring guide:
- ai_visibility_score: How often the brand appears in AI answers for its category (0=never, 100=always)
- share_of_voice: % of category conversations where brand is mentioned vs competitors
- sentiment: Overall tone when brand IS mentioned (positive=praised, neutral=just listed, negative=criticized)
- Be realistic: established brands score 40-75, category leaders 65-85, niche brands 25-55`
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
