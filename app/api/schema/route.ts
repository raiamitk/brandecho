import { NextRequest, NextResponse } from "next/server";

// ─────────────────────────────────────────────────────────────────────────────
//  Schema Markup Checker — crawls homepage, detects JSON-LD + meta signals
//  No API key needed. Pure server-side fetch + regex parse.
// ─────────────────────────────────────────────────────────────────────────────

// All schema types we check for, ranked by AEO importance
const SCHEMA_CATALOG: Record<string, {
  label: string;
  importance: "critical" | "high" | "medium" | "low";
  aeo_impact: string;
  recommended_for: string; // what kind of sites need this
}> = {
  Organization:     { label: "Organization",      importance: "critical", aeo_impact: "Foundation schema — tells AI engines your brand name, logo, social links, and what your business does. Without it AI may misrepresent or skip your brand.", recommended_for: "All sites" },
  WebSite:          { label: "WebSite",            importance: "critical", aeo_impact: "Enables sitelinks search box and signals your site as a structured, trustworthy source to AI indexers.", recommended_for: "All sites" },
  FAQPage:          { label: "FAQ Page",           importance: "critical", aeo_impact: "AI engines like Perplexity pull FAQ answers verbatim. This is the single highest-impact schema for appearing in AI-generated answers.", recommended_for: "Any page with Q&A content" },
  Product:          { label: "Product",            importance: "critical", aeo_impact: "Lets AI answer 'what does X cost?' and 'what does X include?' directly — critical for product/service pages.", recommended_for: "E-commerce, SaaS, product pages" },
  HowTo:            { label: "How-To",             importance: "high",     aeo_impact: "Step-by-step schemas are the preferred format for AI when answering instructional queries. ChatGPT cites these directly.", recommended_for: "Tutorial and guide pages" },
  Article:          { label: "Article",            importance: "high",     aeo_impact: "Marks content as authoritative journalism/analysis — AI tools like Perplexity and Claude prioritise structured articles for citations.", recommended_for: "Blog, news, editorial pages" },
  BlogPosting:      { label: "Blog Posting",       importance: "high",     aeo_impact: "Signals thought leadership content with clear authorship — AI uses this to attribute and cite specific expertise.", recommended_for: "Blog pages" },
  AggregateRating:  { label: "Aggregate Rating",   importance: "high",     aeo_impact: "Star ratings feed AI's trust model for brands. Products with schema ratings appear in AI comparison answers.", recommended_for: "Product, app, service pages" },
  Review:           { label: "Review",             importance: "high",     aeo_impact: "Individual review schemas help AI understand real user sentiment and include your brand in recommendation answers.", recommended_for: "Review pages, testimonials" },
  BreadcrumbList:   { label: "Breadcrumbs",        importance: "medium",   aeo_impact: "Helps AI understand your site hierarchy and the relationship between content pages.", recommended_for: "Multi-level sites" },
  LocalBusiness:    { label: "Local Business",     importance: "medium",   aeo_impact: "Essential for location-based AI queries. 'Best X near me' results depend on this schema.", recommended_for: "Businesses with physical locations" },
  VideoObject:      { label: "Video Object",       importance: "medium",   aeo_impact: "Enables your video content to appear in AI multi-modal responses and video-related queries.", recommended_for: "Sites with video content" },
  Person:           { label: "Person / Author",    importance: "medium",   aeo_impact: "Author authority schema helps AI cite content from credible named individuals rather than anonymous sources.", recommended_for: "Personal brands, thought leaders" },
  Event:            { label: "Event",              importance: "low",      aeo_impact: "Enables AI to include your events in event-discovery queries.", recommended_for: "Event-driven businesses" },
  SoftwareApplication: { label: "Software App",   importance: "high",     aeo_impact: "Critical for apps and SaaS — lets AI answer 'what does X app do?' and include it in app comparison answers.", recommended_for: "App, SaaS, tool sites" },
  Service:          { label: "Service",            importance: "high",     aeo_impact: "Structured service data helps AI engines understand what you offer and match it to service-seeking queries.", recommended_for: "Service businesses" },
};

const IMPORTANCE_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };

async function fetchHomepage(domain: string): Promise<string> {
  const url = domain.startsWith("http") ? domain : `https://${domain}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; BrandEchoBot/1.0; +https://brandecho.app)",
      "Accept": "text/html,application/xhtml+xml",
    },
    signal: AbortSignal.timeout(10000),
    next: { revalidate: 0 },
  });
  if (!res.ok) throw new Error(`Could not fetch ${url} — status ${res.status}`);
  return res.text();
}

function extractJsonLd(html: string): object[] {
  const results: object[] = [];
  const regex = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim());
      if (Array.isArray(parsed)) results.push(...parsed);
      else results.push(parsed);
    } catch { /* skip malformed blocks */ }
  }
  return results;
}

function collectTypes(obj: object): string[] {
  const types: string[] = [];
  const process = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    const n = node as Record<string, unknown>;
    if (n["@type"]) {
      const t = n["@type"];
      if (Array.isArray(t)) types.push(...t.map(String));
      else types.push(String(t));
    }
    // Recurse into nested objects/arrays
    for (const v of Object.values(n)) {
      if (Array.isArray(v)) v.forEach(process);
      else if (v && typeof v === "object") process(v);
    }
  };
  process(obj);
  return types;
}

function checkMetaTags(html: string) {
  const meta: Record<string, string> = {};
  const ogType = html.match(/<meta[^>]+property=["']og:type["'][^>]+content=["']([^"']+)["']/i);
  if (ogType) meta["og:type"] = ogType[1];
  const twCard = html.match(/<meta[^>]+name=["']twitter:card["'][^>]+content=["']([^"']+)["']/i);
  if (twCard) meta["twitter:card"] = twCard[1];
  const canonical = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i);
  if (canonical) meta["canonical"] = canonical[1];
  return meta;
}

export async function POST(req: NextRequest) {
  try {
    const { domain } = await req.json();
    if (!domain) return NextResponse.json({ error: "domain required" }, { status: 400 });

    let html: string;
    try {
      html = await fetchHomepage(domain);
    } catch (e) {
      return NextResponse.json({
        error: `Could not fetch ${domain}: ${e}. The site may block crawlers or require JavaScript.`,
        domain,
        js_rendered: true,
      }, { status: 422 });
    }

    const jsonLdBlocks = extractJsonLd(html);
    const metaTags     = checkMetaTags(html);

    // Collect all @type values found
    const foundTypes = new Set<string>();
    for (const block of jsonLdBlocks) {
      collectTypes(block).forEach(t => {
        // Normalise: strip URL prefixes like "http://schema.org/Organization"
        const clean = t.replace(/^https?:\/\/schema\.org\//i, "");
        foundTypes.add(clean);
      });
    }

    // Build present / missing lists
    const present: typeof SCHEMA_CATALOG[string][] = [];
    const missing: typeof SCHEMA_CATALOG[string][] = [];

    for (const [type, info] of Object.entries(SCHEMA_CATALOG)) {
      if (foundTypes.has(type)) {
        present.push({ ...info, type } as typeof SCHEMA_CATALOG[string] & { type: string });
      } else {
        missing.push({ ...info, type } as typeof SCHEMA_CATALOG[string] & { type: string });
      }
    }

    // Sort by importance
    const sortByImportance = (a: { importance: string }, b: { importance: string }) =>
      (IMPORTANCE_ORDER[a.importance as keyof typeof IMPORTANCE_ORDER] ?? 9) -
      (IMPORTANCE_ORDER[b.importance as keyof typeof IMPORTANCE_ORDER] ?? 9);

    present.sort(sortByImportance);
    missing.sort(sortByImportance);

    // Schema health score: weighted by importance
    const weights = { critical: 4, high: 3, medium: 2, low: 1 };
    const maxScore = Object.values(SCHEMA_CATALOG).reduce((s, v) => s + weights[v.importance], 0);
    const gotScore = present.reduce((s, v) => s + weights[v.importance as keyof typeof weights], 0);
    const health_score = Math.round((gotScore / maxScore) * 100);

    // Count critical gaps
    const critical_missing = missing.filter(m => m.importance === "critical").length;

    return NextResponse.json({
      domain,
      url: domain.startsWith("http") ? domain : `https://${domain}`,
      health_score,
      critical_missing,
      schema_count:  foundTypes.size,
      present:       present.slice(0, 12),
      missing:       missing.slice(0, 10),
      meta_tags:     metaTags,
      raw_types:     [...foundTypes],
      checked_at:    new Date().toISOString(),
    });

  } catch (e) {
    console.error("Schema check error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
