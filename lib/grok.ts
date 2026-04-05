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

// ── PART A: Brand + Competitors + Recommendations ────────────────────────────
// Uses Sonnet (not Haiku) — accuracy matters more than speed here since all
// downstream analysis depends on getting the brand identity right.

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
      model:      CLAUDE_MODEL,   // Sonnet — accuracy critical for brand identity
      max_tokens: 1800,
      system:     "You are a precise brand intelligence expert. Return ONLY valid JSON. No markdown. If you are not certain what a brand does, reason carefully from its domain name, any context clues, and what the name literally implies — do NOT default to a generic well-known category.",
      messages: [{
        role: "user",
        content: `Analyse brand "${brandName}"${domain ? ` (website: ${domain})` : ""}.

CRITICAL: Base your analysis on what this specific brand ACTUALLY does. Read the domain carefully — e.g. "socialmediacheck.com" is a background check / social media screening service, NOT a social media analytics tool. Do not conflate it with well-known SaaS tools.

Searcher location: ${geoCtx} — if the brand is global/international, list its REAL global competitors. Only use local competitors if the brand exclusively serves that local market.

Return:
{
  "brand": {
    "domain": "official domain",
    "industry": "precise industry niche (e.g. Social Media Background Checks, UK DBS Checks, Online Brokerage)",
    "description": "2-sentence description of what the brand SPECIFICALLY does and who its customers are — be accurate, not generic",
    "brand_tone": "professional|casual|luxury|budget"
  },
  "competitors": [
    {"name":"","domain":"","type":"direct|category_substitute","why":"one sentence explaining overlap"}
  ],
  "recommendations": [
    {"title":"","description":"2 sentences","category":"aeo|seo|content|technical","priority":"high|medium|low","projected_lift":"+20%","action_label":"button text"}
  ]
}
RULES: 6 competitors (3 direct, 3 category_substitute). 4 recommendations tailored to the brand's actual industry.`,
      }],
    }),
    signal: AbortSignal.timeout(45000),
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

// ── PART B: Personas + Queries ───────────────────────────────────────────────
// Uses Sonnet for accuracy — query relevance depends on correctly identifying
// what the brand does and who its real users are.

export async function discoverPartB(brandName: string, domain?: string, geo?: { country: string; city?: string }) {
  const res = await fetch(CLAUDE_API_URL, {
    method: "POST",
    headers: {
      "Content-Type":      "application/json",
      "x-api-key":         process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model:      CLAUDE_MODEL,   // Sonnet — query accuracy depends on correct brand understanding
      max_tokens: 3000,
      system:     "You are a user research and AEO expert. Return ONLY valid JSON. No markdown. Reason carefully about what the brand actually does before generating personas and queries.",
      messages: [{
        role: "user",
        content: `For brand "${brandName}"${domain ? ` (website: ${domain})` : ""}, generate 3 buyer personas with queries.
Searcher location: ${geo?.city ? `${geo.city}, ` : ""}${geo?.country || "India"} — if the brand is global/international, personas should reflect its ACTUAL global user base. Only localise personas if the brand exclusively serves that country.
Return JSON:
{
  "personas": [
    {
      "name": "The [Archetype]",
      "archetype": "label",
      "age_range": "22-35",
      "income_level": "budget|mid|premium",
      "pain_points": ["p1","p2"],
      "goals": ["g1"],
      "ai_tools_used": ["ChatGPT"],
      "query_style": "casual",
      "queries": [
        {"text":"question as typed into ChatGPT — NO brand name","type":"aeo","intent":"awareness","revenue_proximity":30,"funnel_stage":"TOFU"},
        {"text":"question","type":"aeo","intent":"awareness","revenue_proximity":35,"funnel_stage":"TOFU"},
        {"text":"question","type":"geo","intent":"awareness","revenue_proximity":40,"funnel_stage":"TOFU"},
        {"text":"question","type":"aeo","intent":"comparison","revenue_proximity":60,"funnel_stage":"MOFU"},
        {"text":"question","type":"aeo","intent":"purchase","revenue_proximity":85,"funnel_stage":"BOFU"}
      ]
    }
  ]
}
RULES: 3 personas (budget/mid/premium). Each has EXACTLY 5 queries: 3 TOFU + 1 MOFU + 1 BOFU. NO brand name in query text. TOFU rev_prox 20-49, MOFU 50-79, BOFU 80-100. Use "aeo" or "geo" types only.`,
      }],
    }),
    signal: AbortSignal.timeout(55000),
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
): Promise<Record<string, { claude_score: number; grok_score: number; gemini_score: number; chatgpt_score: number; web_score: number; reason: string }>> {
  const queryList = queries.map((q, i) => `${i + 1}. [${q.id}] ${q.text}`).join("\n");
  const brandContext = description ? `\nBrand context: ${description}` : "";
  const raw = await claudeChat(
    "You are an AEO (AI Engine Optimization) expert. Always return valid JSON only. No markdown.",
    `Brand: "${brandName}" | Industry: "${industry}"${brandContext}

For each query, score how likely "${brandName}" is to be cited by each AI platform.

Queries:
${queryList}

Return JSON object keyed by query ID:
{
  "uuid-here": {
    "claude_score": 0-100,
    "grok_score": 0-100,
    "gemini_score": 0-100,
    "chatgpt_score": 0-100,
    "web_score": 0-100,
    "reason": "one sentence covering the key factor"
  }
}

Platform scoring notes:
- claude_score: Claude tends to cite structured, well-documented brands with clear expertise signals
- grok_score: Grok (X/Twitter) weights real-time mentions and social proof heavily
- gemini_score: Gemini favours Google-indexed content, strong Search presence, and reviews
- chatgpt_score: ChatGPT weights training data density, Wikipedia presence, and established brands
- web_score: overall web authority (reviews, directories, press) — same for all platforms
- Established brand in its own category: 45-75. Category leader: 65-85. Niche/new: 25-55.
- Vary scores across platforms meaningfully — each has different ranking signals.`
  );
  return JSON.parse(raw);
}

export async function generateMoreQueries(
  brandName: string,
  industry: string,
  existingTexts: string[],
  funnelFilter: "ALL" | "TOFU" | "MOFU" | "BOFU",
  geo?: { country: string; city?: string }
): Promise<{ text: string; type: string; intent: string; revenue_proximity: number; funnel_stage: string }[]> {
  const geoCtx = geo?.city ? `${geo.city}, ${geo.country}` : (geo?.country || "India");
  const stageRule = funnelFilter === "TOFU" ? "All 10 must be TOFU (awareness, rev_prox 20-49)"
    : funnelFilter === "MOFU" ? "All 10 must be MOFU (consideration, rev_prox 50-79)"
    : funnelFilter === "BOFU" ? "All 10 must be BOFU (purchase/decision, rev_prox 80-100)"
    : "Mix: 4 TOFU + 3 MOFU + 3 BOFU";
  const avoid = existingTexts.slice(0, 15).map((t, i) => `${i+1}. ${t}`).join("\n");
  const raw = await claudeChat(
    "You are an AEO query research expert. Return ONLY valid JSON. No markdown.",
    `Brand: "${brandName}" | Industry: "${industry}" | Geo: ${geoCtx}

Generate 10 NEW queries that are different from the ones below.
${stageRule}

Already have (do NOT repeat these):
${avoid}

Return JSON array:
[{"text":"conversational question typed into ChatGPT — NO brand name","type":"aeo","intent":"awareness","revenue_proximity":30,"funnel_stage":"TOFU"}]

Rules: conversational AEO/GEO style questions only. No brand name in text.`,
    1200
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
): Promise<{
  platform: string;
  ai_visibility_score: number;
  share_of_voice: number;
  sentiment: "positive" | "neutral" | "negative";
  reasoning: string;
  mentions: number;
  avg_position: number;
  has_citations: boolean;
  insight: string;
  score_breakdown: {
    brand_authority: { score: number; note: string };
    content_signals: { score: number; note: string };
    social_proof: { score: number; note: string };
    platform_affinity: { score: number; note: string };
  };
  sov_formula: {
    brand_mentions: number;
    total_competitor_mentions: number;
    competitor_breakdown: string;
  };
}[]> {
  const geoCtx = geo?.city ? `${geo.city}, ${geo.country}` : (geo?.country || "India");
  const raw = await claudeChat(
    "You are an AI visibility analyst. Return ONLY valid JSON. No markdown. Be honest and precise — these scores will be shown to users with full formula breakdowns.",
    `Brand: "${brandName}" | Industry: "${industry}"${description ? ` | ${description}` : ""} | Geo: ${geoCtx}

IMPORTANT: You do NOT have live access to Grok, ChatGPT, or Gemini. You are estimating scores based on known signals. Be transparent and realistic.

Score each platform using EXACTLY these 4 signals (each 0–25, total = ai_visibility_score):
1. brand_authority (0-25): How established is the brand? Domain age, press mentions, Wikipedia presence, industry recognition.
2. content_signals (0-25): Quality of brand's content for AI training — structured pages, FAQ, guides, schema markup, blog depth.
3. social_proof (0-25): User-generated evidence — reviews, forum discussions, Reddit mentions, G2/Trustpilot presence.
4. platform_affinity (0-25): Platform-specific bias — Grok weights Twitter/X activity; Gemini weights Google-indexed content; ChatGPT weights training data density & Wikipedia; Claude weights structured documentation.

For share_of_voice: estimate brand_mentions and total_competitor_mentions separately so the formula is visible.
SoV = brand_mentions / (brand_mentions + total_competitor_mentions) × 100

Return a JSON array for exactly these 4 platforms in this order: Gemini, Grok, Claude, ChatGPT

[
  {
    "platform": "Gemini",
    "score_breakdown": {
      "brand_authority": { "score": 12, "note": "one sentence — specific reason for this sub-score" },
      "content_signals":  { "score": 10, "note": "one sentence" },
      "social_proof":     { "score": 8,  "note": "one sentence" },
      "platform_affinity":{ "score": 7,  "note": "Gemini-specific reason" }
    },
    "ai_visibility_score": 37,
    "sov_formula": {
      "brand_mentions": 1,
      "total_competitor_mentions": 8,
      "competitor_breakdown": "e.g. CompetitorA(3) + CompetitorB(3) + CompetitorC(2)"
    },
    "share_of_voice": 11,
    "sentiment": "neutral",
    "reasoning": "2-sentence explanation referencing the specific sub-scores",
    "mentions": 1,
    "avg_position": 4,
    "has_citations": false,
    "insight": "one specific actionable improvement for this platform"
  }
]

RULES:
- ai_visibility_score MUST equal brand_authority.score + content_signals.score + social_proof.score + platform_affinity.score
- share_of_voice MUST equal round(brand_mentions / (brand_mentions + total_competitor_mentions) × 100)
- Be realistic: niche/small brands 15-40, established brands 35-60, category leaders 55-80
- Vary scores across platforms — each has genuinely different signals`
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
