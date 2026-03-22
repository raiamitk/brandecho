import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// ── AI Answer Preview — ONE Gemini call for all queries to avoid rate limits
// Instead of 12 parallel requests (which triggers 429), we ask Gemini to
// answer all queries in a single structured JSON response.

export const maxDuration = 55;

// gemini-1.5-flash: 1500 RPD free tier (vs 200 RPD for 2.0-flash)
const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { brand_id } = await req.json();
    if (!brand_id) return NextResponse.json({ error: "brand_id required" }, { status: 400 });

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === "YOUR_GEMINI_API_KEY") {
      return NextResponse.json({ available: false, error: "GEMINI_API_KEY not set" });
    }

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
        available: true, answers: [],
      });
    }

    // Build the numbered query list for the prompt
    const queryLines = queries.map((q, i) => `${i + 1}. ${q.text}`).join("\n");

    // Single Gemini call — answers all queries in one shot
    const prompt = `You are a helpful AI assistant. Answer each of the following questions as you genuinely would when a real user asks you. Each answer should be 3-5 sentences — factual, informative, and natural. Include specific brand, product, or company names where relevant.

Questions:
${queryLines}

Return ONLY a valid JSON array with exactly ${queries.length} objects, one per question, in the same order:
[
  { "index": 1, "answer": "your answer here" },
  { "index": 2, "answer": "your answer here" }
]
No markdown, no explanation outside the JSON array.`;

    const geminiRes = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: 3500,
          temperature: 0.3,
        },
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      // Return partial data with error so the UI can show a useful message
      return NextResponse.json({
        brand_name: brandName, competitor_names: competitorNames,
        total_queries: queries.length, brand_mentioned_count: 0, competitor_only_count: 0,
        available: false,
        error: `Gemini ${geminiRes.status}: ${errText.slice(0, 200)}`,
        answers: queries.map(q => ({
          query_id: q.id, query_text: q.text, type: q.type,
          revenue_proximity: q.revenue_proximity,
          answer: "", brand_mentioned: false, brand_mention_count: 0,
          competitors_mentioned: [] as string[],
          error: `Gemini API returned ${geminiRes.status}`,
        })),
      });
    }

    const geminiData = await geminiRes.json();
    const rawText: string = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "[]";

    // Parse the JSON array Gemini returned
    let parsed: { index: number; answer: string }[] = [];
    try {
      const clean = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
      parsed = JSON.parse(clean);
    } catch {
      // If JSON parse fails, try to extract answers with regex as fallback
      parsed = queries.map((_, i) => ({ index: i + 1, answer: rawText }));
    }

    // Build answer objects with brand/competitor detection
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

    const mentionedCount     = answers.filter(a => a.brand_mentioned).length;
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
      answers,
    });

  } catch (e) {
    console.error("Answers API error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
