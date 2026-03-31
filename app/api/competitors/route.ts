import { NextRequest, NextResponse } from "next/server";
import { analyzeCompetitorGaps } from "@/lib/grok";

export async function POST(req: NextRequest) {
  try {
    const { brand_name, description, competitors, queries } = await req.json();
    if (!brand_name || !queries?.length) return NextResponse.json({ error: "brand_name and queries required" }, { status: 400 });

    const competitorList = Array.isArray(competitors) ? competitors : [];

    // ONE Claude call analyses all gaps
    const gaps = await analyzeCompetitorGaps(brand_name, competitorList, queries, description);

    // Enrich with query text for display
    const queryMap = Object.fromEntries(queries.map((q: { id: string; text: string; type: string }) => [q.id, q]));
    const enriched = gaps.map((g: {
      query_id: string; brand_appears: boolean; competitors_appear: string[];
      gap_type: string; opportunity: string;
    }) => ({
      ...g,
      query_text: queryMap[g.query_id]?.text || "",
      query_type: queryMap[g.query_id]?.type || "",
    }));

    return NextResponse.json({
      brand_name,
      competitors: competitorList.map((c: { name: string }) => c.name),
      gaps:        enriched,
    });
  } catch (e) {
    console.error("Competitors API error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
