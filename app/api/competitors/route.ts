import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { analyzeCompetitorGaps } from "@/lib/grok";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { brand_id } = await req.json();
    if (!brand_id) return NextResponse.json({ error: "brand_id required" }, { status: 400 });

    const [brandRes, queryRes, compRes] = await Promise.all([
      supabase.from("brands").select("name, industry, description").eq("id", brand_id).single(),
      supabase.from("queries").select("id, text, type, intent").eq("brand_id", brand_id),
      supabase.from("competitors").select("name, type").eq("brand_id", brand_id),
    ]);

    if (!brandRes.data) return NextResponse.json({ error: "Brand not found" }, { status: 404 });

    const brand       = brandRes.data;
    const queries     = queryRes.data  || [];
    const competitors = compRes.data   || [];

    // ONE Claude call analyses all gaps
    const gaps = await analyzeCompetitorGaps(brand.name, competitors, queries, brand.description);

    // Enrich with query text for display
    const queryMap = Object.fromEntries(queries.map(q => [q.id, q]));
    const enriched = gaps.map((g: {
      query_id: string; brand_appears: boolean; competitors_appear: string[];
      gap_type: string; opportunity: string;
    }) => ({
      ...g,
      query_text: queryMap[g.query_id]?.text || "",
      query_type: queryMap[g.query_id]?.type || "",
    }));

    return NextResponse.json({
      brand_name:  brand.name,
      competitors: competitors.map(c => c.name),
      gaps:        enriched,
    });
  } catch (e) {
    console.error("Competitors API error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
