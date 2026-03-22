import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { scoreQueryVisibility } from "@/lib/grok";

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
      supabase.from("brands").select("name, industry, description").eq("id", brand_id).single(),
      supabase.from("queries").select("id, text, type, intent, revenue_proximity").eq("brand_id", brand_id),
      supabase.from("competitors").select("name, type").eq("brand_id", brand_id),
    ]);

    if (!brandRes.data) return NextResponse.json({ error: "Brand not found" }, { status: 404 });

    const brand     = brandRes.data;
    const queries   = queryRes.data || [];

    // ── Step 1: Claude batch scores all queries in ONE API call ────────────────
    const claudeScores = await scoreQueryVisibility(brand.name, brand.industry, queries, brand.description);

    // ── Step 2: Gemini check — ONE batched call for top 5 queries ─────────────
    // Batching avoids the 429 rate limit that hits when firing 5 parallel requests.
    const top5 = [...queries].sort((a, b) => b.revenue_proximity - a.revenue_proximity).slice(0, 5);
    const geminiResults: Record<string, { mentioned: boolean; score: number; excerpt: string; available: boolean }> = {};

    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey && apiKey !== "YOUR_GEMINI_API_KEY") {
      try {
        const GURL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent";
        const queryLines = top5.map((q, i) => `${i + 1}. ${q.text}`).join("\n");
        const gBody = JSON.stringify({
          contents: [{ parts: [{ text:
            `For each question below, answer as you normally would (2-3 sentences). Be factual and mention relevant brands by name.\n\n${queryLines}\n\nFormat: answer each question numbered, matching the question numbers above.`
          }] }],
          generationConfig: { maxOutputTokens: 2000, temperature: 0.2 },
        });

        // Retry up to 2 times on 429
        let gRes: Response | null = null;
        for (let attempt = 0; attempt <= 2; attempt++) {
          if (attempt > 0) await new Promise(r => setTimeout(r, attempt * 4000));
          gRes = await fetch(`${GURL}?key=${apiKey}`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: gBody, signal: AbortSignal.timeout(20000),
          });
          if (gRes.status !== 429) break;
        }

        if (gRes && gRes.ok) {
          const gData  = await gRes.json();
          const gText: string = gData.candidates?.[0]?.content?.parts?.[0]?.text || "";
          const brandLow = brand.name.toLowerCase();

          // Split response by numbered answers and map back to query IDs
          const sections = gText.split(/\n(?=\d+\.)/);
          top5.forEach((q, i) => {
            const section  = sections[i] || sections[sections.length - 1] || "";
            const lower    = section.toLowerCase();
            const mentions = (lower.match(new RegExp(brandLow.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length;
            geminiResults[q.id] = {
              mentioned: mentions > 0,
              excerpt:   section.slice(0, 250).trim(),
              score:     mentions >= 3 ? 100 : mentions === 2 ? 75 : mentions === 1 ? 50 : 0,
              available: true,
            };
          });
        }
      } catch (e) {
        console.warn("Gemini batch visibility check failed:", e);
      }
    }

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
