// ─────────────────────────────────────────────────────────────────────────────
//  Claude (Anthropic) API integration
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
  // Strip markdown code blocks if Claude wraps response in ```json ... ```
  return text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
}

// ── Brand Discovery ──────────────────────────────────────────────────────────

export async function discoverBrandInfo(brandName: string, domain?: string) {
  const raw = await claudeChat(
    "You are a precise brand intelligence analyst. Always return valid JSON only. No markdown, no explanation.",
    `For the brand "${brandName}"${domain ? ` (website: ${domain})` : ""}, return this JSON:
{
  "domain": "official website domain",
  "industry": "specific industry category",
  "description": "2-sentence brand description",
  "primary_products": ["product1", "product2"],
  "target_market": "brief target market description",
  "brand_tone": "professional/casual/luxury/budget/etc"
}`
  );
  return JSON.parse(raw);
}

// ── Competitor Discovery ─────────────────────────────────────────────────────

export async function discoverCompetitors(brandName: string, industry: string) {
  const raw = await claudeChat(
    "You are a competitive intelligence analyst. Always return valid JSON array only. No markdown.",
    `For "${brandName}" in "${industry}", identify 6 competitors (3 direct, 3 category substitutes).
Return JSON array:
[{"name":"","domain":"","type":"direct|category_substitute","why":"one sentence"}]`
  );
  return JSON.parse(raw);
}

// ── Persona Generation ───────────────────────────────────────────────────────

export async function generatePersonas(brandName: string, industry: string, description: string) {
  const raw = await claudeChat(
    "You are a user research expert. Always return valid JSON array only. No markdown.",
    `For the brand "${brandName}" (${description}), generate 3 maximally diverse user personas.
Return JSON array:
[{
  "name": "The [Archetype Name]",
  "archetype": "short label",
  "age_range": "e.g. 22-30",
  "occupation": "job/life stage",
  "pain_points": ["pain1","pain2","pain3"],
  "goals": ["goal1","goal2"],
  "ai_tools_used": ["ChatGPT","Perplexity"],
  "query_style": "how they phrase AI questions",
  "income_level": "budget/mid/premium",
  "discovery_channel": "how they find brands"
}]`
  );
  return JSON.parse(raw);
}

// ── Query Generation ─────────────────────────────────────────────────────────

export async function generateQueriesForPersona(
  brandName: string,
  persona: { name: string; archetype: string; pain_points: string[]; query_style: string },
  industry: string
) {
  const raw = await claudeChat(
    "You are an SEO and AEO query research expert. Always return valid JSON array only. No markdown.",
    `Generate 25 search queries "${persona.name}" (${persona.archetype}) would use to find "${brandName}" (${industry}).
Mix: 10 AEO (conversational AI), 8 GEO (local intent), 7 SEO long-tail.
Query style: "${persona.query_style}"
Return JSON array:
[{"text":"","type":"aeo|geo|seo_longtail","intent":"awareness|consideration|purchase|comparison","revenue_proximity":0-100}]`
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
    `For "${brandName}" in ${industry}, give 5 prioritized recommendations to improve AEO + SEO visibility.
Context: ${queryCount} queries identified, competitors: ${competitors.join(", ")}.
Return JSON array:
[{
  "title": "short action title",
  "description": "2-sentence why and what",
  "category": "aeo|seo|content|technical",
  "priority": "high|medium|low",
  "projected_lift": "e.g. +20% AI citation rate",
  "action_label": "short button text"
}]`
  );
  return JSON.parse(raw);
}
