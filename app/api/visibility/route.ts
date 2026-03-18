import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { scoreQueryVisibility } from "@/lib/grok";
import { checkGeminiVisibility } from "@/lib/gemini";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { brand_id } = await req.json();
    if (!brand_id) return NextResponse.json({ error: "brand_id required" }, { status: 400 });

    // Load brand + queries from Supabase
    const [brandRes, queryRes, compRes] = await Promise.all([
      supabase.from("brands").select("name, industry").eq("id", brand_id).single(),
      supabase.from("queries").select("id, text, type, intent, revenue_proximity").eq("brand_id", brand_id),
      supabase.from("competitors").select("name, type").eq("brand_id", brand_id),
    ]);

    if (!brandRes.data) return NextResponse.json({ error: "Brand not found" }, { status: 404 });

    const brand     = brandRes.data;
    const queries   = queryRes.data || [];

    // ── Step 1: Claude batch scores all queries in ONE API call ────────────────
    const claudeScores = await scoreQueryVisibility(brand.name, brand.industry, queries);

    // ── Step 2: Gemini check — only top 5 by revenue_proximity (free tier safe)
    const top5 = [...queries].sort((a, b) => b.revenue_proximity - a.revenue_proximity).slice(0, 5);
    const geminiResults: Record<string, { mentioned: boolean; score: number; excerpt: string; available: boolean }> = {};

    await Promise.all(
      top5.map(async (q) => {
        const result = await checkGeminiVisibility(q.text, brand.name);
        geminiResults[q.id] = result;
      })
    );

    // ── Step 3: Build combined results ─────────────────────────────────────────
    const results = queries.map((q) => {
      const claude  = claudeScores[q.id] || { claude_score: 0, web_score: 0, reason: "" };
      const gemini  = geminiResults[q.id];
      const geminiScore = gemini?.available ? gemini.score : -1;

      // Combined score: 50% Claude + 30% web signals + 20% Gemini (if available)
      let combined: number;
      if (geminiScore >= 0) {
        combined = Math.round(claude.claude_score * 0.5 + claude.web_score * 0.3 + geminiScore * 0.2);
      } else {
        combined = Math.round(claude.claude_score * 0.6 + claude.web_score * 0.4);
      }

      return {
        query_id:       q.id,
        query_text:     q.text,
        query_type:     q.type,
        revenue_proximity: q.revenue_proximity,
        claude_score:   claude.claude_score,
        web_score:      claude.web_score,
        gemini_check:   gemini?.mentioned || false,
        gemini_score:   geminiScore,
        gemini_excerpt: gemini?.excerpt || "",
        gemini_available: gemini?.available || false,
        combined_score: combined,
        reason:         claude.reason,
      };
    });

    // ── Step 4: Upsert results to Supabase ─────────────────────────────────────
    const upsertRows = results.map((r) => ({
      brand_id,
      query_id:       r.query_id,
      claude_score:   r.claude_score,
      web_score:      r.web_score,
      gemini_check:   r.gemini_check,
      gemini_excerpt: r.gemini_excerpt,
      combined_score: r.combined_score,
    }));

    await supabase.from("visibility_scores").upsert(upsertRows, { onConflict: "brand_id,query_id" });

    // ── Overall brand visibility score ─────────────────────────────────────────
    const avg = Math.round(results.reduce((s, r) => s + r.combined_score, 0) / (results.length || 1));

    return NextResponse.json({
      brand_name:       brand.name,
      overall_score:    avg,
      gemini_available: Object.values(geminiResults).some(r => r.available),
      results,
    });
  } catch (e) {
    console.error("Visibility API error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
