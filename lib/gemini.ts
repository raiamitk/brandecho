// ─────────────────────────────────────────────────────────────────────────────
//  Google Gemini API — free tier (gemini-1.5-flash)
//  Free limits: 15 RPM, 1M tokens/day, no credit card needed
//  Get key at: https://aistudio.google.com/app/apikey
// ─────────────────────────────────────────────────────────────────────────────

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

export interface GeminiVisibilityResult {
  mentioned: boolean;
  excerpt:   string;
  score:     number; // 0 | 50 | 100  (not mentioned | partial | clearly named)
  available: boolean; // false if API key not set
}

export async function checkGeminiVisibility(
  query:     string,
  brandName: string
): Promise<GeminiVisibilityResult> {
  const apiKey = process.env.GEMINI_API_KEY;

  // Graceful degradation — if no key, skip silently
  if (!apiKey || apiKey === "YOUR_GEMINI_API_KEY") {
    return { mentioned: false, excerpt: "", score: -1, available: false };
  }

  try {
    const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: query }] }],
        generationConfig: { maxOutputTokens: 400, temperature: 0.1 },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Gemini API error:", err);
      return { mentioned: false, excerpt: "", score: -1, available: false };
    }

    const data     = await res.json();
    const text: string = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const lower    = text.toLowerCase();
    const brandLow = brandName.toLowerCase();

    // Score how prominently the brand appears
    let score = 0;
    let mentioned = false;

    if (lower.includes(brandLow)) {
      mentioned = true;
      // Count occurrences — more mentions = higher score
      const count = (lower.match(new RegExp(brandLow.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length;
      score = count >= 3 ? 100 : count === 2 ? 75 : 50;
    }

    return {
      mentioned,
      excerpt:   text.slice(0, 250).trim(),
      score,
      available: true,
    };
  } catch (e) {
    console.error("Gemini fetch failed:", e);
    return { mentioned: false, excerpt: "", score: -1, available: false };
  }
}
