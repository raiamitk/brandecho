import { NextRequest, NextResponse } from "next/server";
import { scoreQueryVisibility } from "@/lib/grok";

const CLAUDE_API_URL = "https://api.anthropic.com/v1/messages";
const CLAUDE_HAIKU   = "claude-haiku-4-5-20251001";
const GEMINI_URL     = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent";

type AICheckResult = Record<string, { mentioned: boolean; score: number; excerpt: string; available: boolean }>;

// ── Try Gemini for live brand-mention check ────────────────────────────────────
async function tryGeminiCheck(queryLines: string, apiKey: string): Promise<string | null> {
  const body = JSON.stringify({
    contents: [{ parts: [{ text:
      `For each question below, answer as you normally would (2-3 sentences). Be factual and mention relevant brands by name.\n\n${queryLines}\n\nFormat: answer each question numbered, matching the question numbers above.`
    }] }],
    generationConfig: { maxOutputTokens: 2000, temperature: 0.2 },
  });

  // 1 attempt + 1 retry on 429
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) await new Promise(r => setTimeout(r, 5000));
    try {
      const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body, signal: AbortSignal.timeout(20000),
      });
      if (res.ok) {
        const data = await res.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
      }
      const errText = await res.text();
      console.error(`Gemini tryGeminiCheck Error (${res.status}):`, errText);
      if (res.status !== 429) return null; // non-retryable
    } catch (error) {
      console.error("Gemini tryGeminiCheck Exception:", error);
      return null;
    }
  }
  return null; // exhausted retries
}

// ── Claude Haiku fallback for live brand-mention check ─────────────────────────
async function tryClaudeCheck(queryLines: string): Promise<string | null> {
  try {
    const res = await fetch(CLAUDE_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: CLAUDE_HAIKU,
        max_tokens: 2000,
        messages: [{ role: "user", content:
          `For each question below, answer as you normally would (2-3 sentences). Be factual and mention relevant brands by name.\n\n${queryLines}\n\nFormat: answer each question numbered, matching the question numbers above.`
        }],
      }),
      signal: AbortSignal.timeout(25000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.content?.[0]?.text || null;
  } catch { return null; }
}

// ── Parse AI text response into per-query brand-mention results ────────────────
function parseAICheckResults(
  text: string,
  queries: { id: string }[],
  brandName: string
): AICheckResult {
  const brandLow = brandName.toLowerCase();
  const sections = text.split(/\n(?=\d+\.)/);
  const result: AICheckResult = {};
  queries.forEach((q, i) => {
    const section  = sections[i] || sections[sections.length - 1] || "";
    const lower    = section.toLowerCase();
    const mentions = (lower.match(new RegExp(brandLow.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length;
    result[q.id] = {
      mentioned: mentions > 0,
      excerpt:   section.slice(0, 250).trim(),
      score:     mentions >= 3 ? 100 : mentions === 2 ? 75 : mentions === 1 ? 50 : 0,
      available: true,
    };
  });
  return result;
}

export async function POST(req: NextRequest) {
  try {
    const { brand_name, industry, description, queries } = await req.json();
    if (!brand_name || !queries?.length) return NextResponse.json({ error: "brand_name and queries required" }, { status: 400 });

    const brand = { name: brand_name, industry, description };

    // ── Step 1: Claude batch scores all queries ────────────────────────────────
    const claudeScores = await scoreQueryVisibility(brand.name, brand.industry, queries, brand.description);

    // ── Step 2: Live AI check — top 5 queries, Gemini first then Claude fallback
    const top5       = [...queries].sort((a: { revenue_proximity: number }, b: { revenue_proximity: number }) => b.revenue_proximity - a.revenue_proximity).slice(0, 5);
    const queryLines = top5.map((q: { text: string }, i: number) => `${i + 1}. ${q.text}`).join("\n");
    let aiCheckResults: AICheckResult = {};
    let aiCheckSource = "none";

    const geminiKey = process.env.GEMINI_API_KEY;
    if (geminiKey && geminiKey !== "YOUR_GEMINI_API_KEY") {
      const geminiText = await tryGeminiCheck(queryLines, geminiKey);
      if (geminiText) {
        aiCheckResults = parseAICheckResults(geminiText, top5, brand.name);
        aiCheckSource  = "gemini";
      }
    }

    // Fall back to Claude if Gemini failed or key not set
    if (aiCheckSource === "none") {
      const claudeText = await tryClaudeCheck(queryLines);
      if (claudeText) {
        aiCheckResults = parseAICheckResults(claudeText, top5, brand.name);
        aiCheckSource  = "claude";
      }
    }

    // ── Step 3: Build combined results ────────────────────────────────────────
    const results = queries.map((q: { id: string; text: string; type: string; revenue_proximity: number }) => {
      const p        = claudeScores[q.id] || { claude_score: 0, grok_score: 0, gemini_score: 0, chatgpt_score: 0, web_score: 0, reason: "" };
      const aiCheck  = aiCheckResults[q.id];
      const liveScore = aiCheck?.available ? aiCheck.score : -1;

      // Combined: avg of 4 platform scores (40%) + web (20%) + live check if available (20%) else redistribute
      const platformAvg = Math.round((p.claude_score + p.grok_score + p.gemini_score + p.chatgpt_score) / 4);
      const combined = liveScore >= 0
        ? Math.round(platformAvg * 0.6 + p.web_score * 0.2 + liveScore * 0.2)
        : Math.round(platformAvg * 0.7 + p.web_score * 0.3);

      return {
        query_id:          q.id,
        query_text:        q.text,
        query_type:        q.type,
        revenue_proximity: q.revenue_proximity,
        claude_score:      p.claude_score,
        grok_score:        p.grok_score,
        gemini_score:      p.gemini_score,
        chatgpt_score:     p.chatgpt_score,
        web_score:         p.web_score,
        live_mentioned:    aiCheck?.mentioned || false,
        live_available:    aiCheck?.available || false,
        live_excerpt:      aiCheck?.excerpt || "",
        combined_score:    combined,
        reason:            p.reason,
      };
    });

    const avg = Math.round(results.reduce((s: number, r: { combined_score: number }) => s + r.combined_score, 0) / (results.length || 1));

    return NextResponse.json({
      brand_name:       brand.name,
      overall_score:    avg,
      live_available:   Object.values(aiCheckResults).some(r => r.available),
      ai_check_source:  aiCheckSource,
      results,
    });

  } catch (e) {
    console.error("Visibility API error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
