import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// ─────────────────────────────────────────────────────────────────────────────
//  Domain Authority — OpenPageRank API (free, 1000 req/month, no credit card)
//  Get key: https://openpagerank.com/ → Register (free, email only) → API Key
//  Without key: returns mock/unavailable state gracefully
// ─────────────────────────────────────────────────────────────────────────────

const OPR_URL = "https://openpagerank.com/api/v1.0/getPageRank";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function cleanDomain(d: string): string {
  return d.replace(/^https?:\/\//i, "").replace(/\/.*$/, "").toLowerCase().trim();
}

async function fetchPageRank(domains: string[]): Promise<Record<string, { pr: number; rank: string | null }>> {
  const apiKey = process.env.OPENPR_API_KEY;
  if (!apiKey) {
    // Return graceful unavailable state
    return Object.fromEntries(domains.map(d => [d, { pr: -1, rank: null }]));
  }

  const params = new URLSearchParams();
  domains.forEach(d => params.append("domains[]", d));

  const res = await fetch(`${OPR_URL}?${params}`, {
    headers: { "API-OPR": apiKey },
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenPageRank API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  const result: Record<string, { pr: number; rank: string | null }> = {};

  for (const item of data.response || []) {
    result[item.domain] = {
      pr:   Math.round((item.page_rank_decimal ?? 0) * 10) / 10,  // 1 decimal
      rank: item.rank ? String(item.rank) : null,
    };
  }
  return result;
}

// AEO context: why domain authority matters
const AEO_NOTE = "AI engines like Perplexity, ChatGPT, and Gemini weight their citations heavily toward high-authority domains. A brand with PageRank 3 vs a competitor at 6 is far less likely to be cited in AI answers for competitive queries.";

// PR score interpretation
function prLabel(pr: number): { label: string; color: string; bg: string } {
  if (pr < 0)   return { label: "N/A",       color: "#6b7280", bg: "#f9fafb" };
  if (pr === 0) return { label: "Unrated",   color: "#6b7280", bg: "#f9fafb" };
  if (pr <= 2)  return { label: "Low",       color: "#dc2626", bg: "#fef2f2" };
  if (pr <= 4)  return { label: "Moderate",  color: "#d97706", bg: "#fffbeb" };
  if (pr <= 6)  return { label: "Good",      color: "#059669", bg: "#f0fdf4" };
  return             { label: "Strong",      color: "#7c3aed", bg: "#f5f3ff" };
}

export async function POST(req: NextRequest) {
  try {
    const { brand_id, domain } = await req.json();
    if (!domain) return NextResponse.json({ error: "domain required" }, { status: 400 });

    const brandDomain = cleanDomain(domain);

    // Load competitors from Supabase
    let competitorDomains: { name: string; domain: string }[] = [];
    if (brand_id) {
      const { data } = await supabase
        .from("competitors")
        .select("name, domain")
        .eq("brand_id", brand_id);
      competitorDomains = (data || [])
        .filter((c: { domain: string }) => c.domain)
        .map((c: { name: string; domain: string }) => ({ name: c.name, domain: cleanDomain(c.domain) }));
    }

    // All domains to check (brand + up to 5 competitors)
    const allDomains = [brandDomain, ...competitorDomains.slice(0, 5).map(c => c.domain)];
    const uniqueDomains = [...new Set(allDomains)];

    let scores: Record<string, { pr: number; rank: string | null }> = {};
    const apiAvailable = !!process.env.OPENPR_API_KEY;

    try {
      scores = await fetchPageRank(uniqueDomains);
    } catch (e) {
      console.error("OpenPageRank error:", e);
      scores = Object.fromEntries(uniqueDomains.map(d => [d, { pr: -1, rank: null }]));
    }

    const brandScore = scores[brandDomain] || { pr: -1, rank: null };
    const brandInfo  = { ...prLabel(brandScore.pr), ...brandScore };

    const competitors = competitorDomains.map(c => {
      const s = scores[c.domain] || { pr: -1, rank: null };
      return {
        name:   c.name,
        domain: c.domain,
        pr:     s.pr,
        rank:   s.rank,
        ...prLabel(s.pr),
        ahead_of_brand: s.pr > brandScore.pr && s.pr >= 0 && brandScore.pr >= 0,
      };
    });

    const competitors_ahead = competitors.filter(c => c.ahead_of_brand).length;
    const max_competitor_pr = competitors.reduce((m, c) => c.pr > m ? c.pr : m, 0);
    const authority_gap     = max_competitor_pr > 0 && brandScore.pr >= 0
      ? Math.max(0, max_competitor_pr - brandScore.pr)
      : null;

    // Actionable recommendations based on score
    const recommendations: string[] = [];
    if (brandScore.pr < 2) {
      recommendations.push("Start a link-building campaign — submit to industry directories, get featured in niche press releases");
      recommendations.push("Guest post on high-authority sites in your industry to earn quality backlinks");
    }
    if (brandScore.pr < 4) {
      recommendations.push("Create linkable assets (original research, free tools, data reports) that naturally attract backlinks");
      recommendations.push("Reach out to the citation sources shown in your AEO queries — a mention there directly boosts AI visibility");
    }
    if (authority_gap && authority_gap > 2) {
      recommendations.push(`Close the ${authority_gap.toFixed(1)}-point gap with top competitors by targeting their backlink sources`);
    }
    if (recommendations.length === 0) {
      recommendations.push("Maintain authority by consistently publishing linkable content and monitoring new competitor backlinks");
    }

    return NextResponse.json({
      brand_domain:      brandDomain,
      brand_pr:          brandScore.pr,
      brand_rank:        brandScore.rank,
      brand_label:       brandInfo.label,
      brand_color:       brandInfo.color,
      brand_bg:          brandInfo.bg,
      competitors,
      competitors_ahead,
      authority_gap,
      api_available:     apiAvailable,
      aeo_note:          AEO_NOTE,
      recommendations,
      checked_at:        new Date().toISOString(),
    });

  } catch (e) {
    console.error("Authority check error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
