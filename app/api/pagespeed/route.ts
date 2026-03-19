import { NextRequest, NextResponse } from "next/server";

// ─────────────────────────────────────────────────────────────────────────────
//  Google PageSpeed Insights API — free tier
//  No key = 1 req/sec limit. Add PAGESPEED_API_KEY for 25,000 req/day (free).
//  Get key: https://console.developers.google.com → Enable PageSpeed Insights API
// ─────────────────────────────────────────────────────────────────────────────

const PSI_BASE = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";

// Audits to extract from Lighthouse result
const VITALS = [
  { id: "first-contentful-paint",    label: "First Contentful Paint", short: "FCP",  good: 1.8,  poor: 3.0,  unit: "s" },
  { id: "largest-contentful-paint",  label: "Largest Contentful Paint", short: "LCP", good: 2.5, poor: 4.0,  unit: "s" },
  { id: "total-blocking-time",       label: "Total Blocking Time",    short: "TBT",  good: 200,  poor: 600,  unit: "ms" },
  { id: "cumulative-layout-shift",   label: "Cumulative Layout Shift", short: "CLS", good: 0.1,  poor: 0.25, unit: "" },
  { id: "speed-index",               label: "Speed Index",            short: "SI",   good: 3.4,  poor: 5.8,  unit: "s" },
  { id: "interactive",               label: "Time to Interactive",    short: "TTI",  good: 3.8,  poor: 7.3,  unit: "s" },
] as const;

// Opportunity audits — things that can be fixed to improve score
const OPPORTUNITY_IDS = [
  "render-blocking-resources",
  "unused-css-rules",
  "unused-javascript",
  "uses-optimized-images",
  "uses-webp-images",
  "uses-text-compression",
  "uses-responsive-images",
  "efficiently-encode-images",
  "offscreen-images",
];

async function fetchPSI(url: string, strategy: "mobile" | "desktop") {
  const apiKey = process.env.PAGESPEED_API_KEY;
  const params = new URLSearchParams({
    url,
    strategy,
    category: "performance",
    ...(apiKey ? { key: apiKey } : {}),
  });

  const res = await fetch(`${PSI_BASE}?${params}`, {
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`PageSpeed API error ${res.status}: ${err}`);
  }

  return res.json();
}

function extractMetrics(data: Record<string, unknown>) {
  const lr  = data.lighthouseResult as Record<string, unknown> | undefined;
  if (!lr) return null;

  const audits     = lr.audits     as Record<string, Record<string, unknown>>;
  const categories = lr.categories as Record<string, Record<string, unknown>>;

  const perfScore = Math.round(((categories?.performance?.score as number) || 0) * 100);

  // Core Web Vitals
  const vitals = VITALS.map(v => {
    const audit  = audits?.[v.id] || {};
    const rawVal = (audit.numericValue as number) || 0;
    const dispVal= (audit.displayValue as string) || "—";
    const score  = (audit.score as number) ?? -1;

    // Convert ms → s for display where needed
    const val = v.unit === "s" ? rawVal / 1000 : rawVal;
    const status = score >= 0.9 ? "good" : score >= 0.5 ? "needs-improvement" : "poor";

    return {
      id:       v.id,
      label:    v.label,
      short:    v.short,
      value:    rawVal,
      display:  dispVal,
      unit:     v.unit,
      score,
      status,   // "good" | "needs-improvement" | "poor"
      good:     v.good,
      poor:     v.poor,
    };
  });

  // Top opportunities (sorted by savings)
  const opportunities = OPPORTUNITY_IDS
    .map(id => {
      const a = audits?.[id];
      if (!a || (a.score as number) === 1) return null;
      const savingsMs = (a.details as Record<string, unknown>)?.overallSavingsMs as number || 0;
      return {
        id,
        title:       a.title as string       || id,
        description: a.description as string || "",
        savings_ms:  Math.round(savingsMs),
        score:       (a.score as number) ?? 0,
      };
    })
    .filter(Boolean)
    .sort((a, b) => (b!.savings_ms - a!.savings_ms))
    .slice(0, 5);

  return { perfScore, vitals, opportunities };
}

// AEO context: why this metric matters for AI citation
const AEO_IMPACT: Record<string, string> = {
  "first-contentful-paint":   "AI crawlers index pages faster when content loads quickly — slow FCP means your content may be missed",
  "largest-contentful-paint": "LCP > 4s signals poor page quality to Google, reducing the page's chance of being cited by AI engines",
  "total-blocking-time":      "High TBT causes poor user engagement signals — AI tools like Perplexity deprioritise low-engagement pages",
  "cumulative-layout-shift":  "Layout instability lowers Core Web Vitals score, reducing organic visibility that feeds AI training data",
  "speed-index":              "Slow Speed Index correlates with lower SERP rankings — AI engines source answers from top-ranking pages",
  "interactive":              "Pages slow to interact lose backlinks and shares, reducing the authority AI engines use to decide who to cite",
};

export async function POST(req: NextRequest) {
  try {
    const { brand_id, domain } = await req.json();
    if (!domain) return NextResponse.json({ error: "domain required" }, { status: 400 });
    void brand_id; // kept for future caching

    // Ensure URL has protocol
    const url = domain.startsWith("http") ? domain : `https://${domain}`;

    // Fetch mobile + desktop in parallel
    const [mobileRaw, desktopRaw] = await Promise.allSettled([
      fetchPSI(url, "mobile"),
      fetchPSI(url, "desktop"),
    ]);

    const mobile  = mobileRaw.status  === "fulfilled" ? extractMetrics(mobileRaw.value)  : null;
    const desktop = desktopRaw.status === "fulfilled" ? extractMetrics(desktopRaw.value) : null;

    if (!mobile && !desktop) {
      throw new Error("PageSpeed API returned no data for both mobile and desktop");
    }

    // Merge opportunities from mobile (more impactful for rankings)
    const opportunities = (mobile?.opportunities || desktop?.opportunities || []).map(op => ({
      ...op,
      aeo_impact: AEO_IMPACT[op!.id] || "Improving this helps overall page quality signals used by AI engines",
    }));

    // Add AEO context to vitals
    const vitalsWithAEO = (mobile?.vitals || []).map(v => ({
      ...v,
      aeo_impact: AEO_IMPACT[v.id] || "",
      desktop_display: desktop?.vitals.find(d => d.id === v.id)?.display || "—",
      desktop_status:  desktop?.vitals.find(d => d.id === v.id)?.status  || "poor",
    }));

    return NextResponse.json({
      url,
      mobile_score:  mobile?.perfScore  ?? null,
      desktop_score: desktop?.perfScore ?? null,
      vitals:        vitalsWithAEO,
      opportunities,
      checked_at:    new Date().toISOString(),
    });

  } catch (e) {
    console.error("PageSpeed API error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
