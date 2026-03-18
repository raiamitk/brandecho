import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { generateContentBriefs } from "@/lib/grok";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { brand_id } = await req.json();
    if (!brand_id) return NextResponse.json({ error: "brand_id required" }, { status: 400 });

    // Check cache first
    const { data: cached } = await supabase
      .from("content_briefs")
      .select("*")
      .eq("brand_id", brand_id);

    if (cached && cached.length > 0) {
      return NextResponse.json({ briefs: cached, cached: true });
    }

    // Load brand + top queries
    const [brandRes, queryRes] = await Promise.all([
      supabase.from("brands").select("name, industry").eq("id", brand_id).single(),
      supabase.from("queries").select("id, text, intent, type, revenue_proximity")
        .eq("brand_id", brand_id)
        .order("revenue_proximity", { ascending: false }),
    ]);

    if (!brandRes.data) return NextResponse.json({ error: "Brand not found" }, { status: 404 });

    const brand   = brandRes.data;
    const queries = queryRes.data || [];

    // ONE Claude call generates all 5 briefs
    const briefs = await generateContentBriefs(brand.name, brand.industry, queries);

    // Save to Supabase
    const rows = briefs.map((b: {
      query_id: string; query_text: string; recommended_title: string;
      content_type: string; word_count: number; h2_sections: string[];
      key_points: string[]; citation_hook: string; schema_markup: string; estimated_impact: string;
    }) => ({
      brand_id,
      query_id:          b.query_id,
      query_text:        b.query_text,
      recommended_title: b.recommended_title,
      content_type:      b.content_type,
      word_count:        b.word_count,
      h2_sections:       b.h2_sections,
      key_points:        b.key_points,
      citation_hook:     b.citation_hook,
      schema_markup:     b.schema_markup,
      estimated_impact:  b.estimated_impact,
    }));

    await supabase.from("content_briefs").insert(rows);

    return NextResponse.json({ briefs: rows, cached: false });
  } catch (e) {
    console.error("Briefs API error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
