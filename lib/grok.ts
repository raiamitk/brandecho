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
