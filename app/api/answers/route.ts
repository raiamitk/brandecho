import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// ── AI Answer Preview — calls Gemini for every target query, shows real answers
// with brand + competitor mentions highlighted.

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

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

    // Load brand + queries + competitors
    const [brandRes, queryRes, compRes] = await Promise.all([
      supabase.from("brands").select("name, industry").eq("id", brand_id).single(),
      supabase.from("queries").select("id, text, type, intent, revenue_proximity")
        .eq("brand_id", brand_id).order("revenue_proximity", { ascending: false }).limit(12),
      supabase.from("competitors").select("name").eq("brand_id", brand_id),
    ]);

    if (!brandRes.data) return NextResponse.json({ error: "Brand not found" }, { status: 404 });

    const brandName       = brandRes.data.name;
    const queries         = queryRes.data || [];
    const competitorNames = (compRes.data || []).map((c: { name: string }) => c.name);

    // Call Gemini for all queries in parallel (12 < 15 RPM free limit)
    const settled = await Promise.allSettled(
      queries.map(async (q) => {
        const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: q.text }] }],
            generationConfig: { maxOutputTokens: 700, temperature: 0.2 },
          }),
          signal: AbortSignal.timeout(8000),
        });

        if (!res.ok) {
          const err = await res.text();
          return { query_id: q.id, query_text: q.text, type: q.type,
            revenue_proximity: q.revenue_proximity, answer: "",
            brand_mentioned: false, brand_mention_count: 0,
            competitors_mentioned: [] as string[], error: `Gemini ${res.status}: ${err.slice(0, 80)}` };
        }

        const data   = await res.json();
        const answer: string = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
        const lower  = answer.toLowerCase();
        const bLow   = brandName.toLowerCase();

        const brandMentionCount = (
          lower.match(new RegExp(bLow.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []
        ).length;

        const competitorsMentioned = competitorNames.filter((name: string) =>
          lower.includes(name.toLowerCase())
        );

        return {
          query_id:             q.id,
          query_text:           q.text,
          type:                 q.type,
          revenue_proximity:    q.revenue_proximity,
          answer,
          brand_mentioned:      brandMentionCount > 0,
          brand_mention_count:  brandMentionCount,
          competitors_mentioned: competitorsMentioned,
          error:                null,
        };
      })
    );

    const answers = settled.map(r =>
      r.status === "fulfilled"
        ? r.value
        : { query_text: "", answer: "", brand_mentioned: false, brand_mention_count: 0,
            competitors_mentioned: [], error: "Request failed" }
    );

    const mentionedCount = answers.filter(a => a.brand_mentioned).length;
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
