"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Eye, Sparkles, BarChart2, TrendingUp, Users, MessageSquare,
  Building2, Globe, Download, FileText, Zap, Gauge,
  CheckCircle, XCircle, ChevronDown, ChevronUp, Copy, Check,
} from "lucide-react";
import type { Brand, Persona, Query, Competitor, Recommendation } from "@/lib/types";
import { supabase } from "@/lib/supabase";

// ── Theme ─────────────────────────────────────────────────────────────────────
const A    = "#00FF96";
const AT   = "#059669";
const BG   = "#ffffff";
const SURF = "#f9fafb";
const BORD = "#e5e7eb";
const T1   = "#111827";
const T2   = "#374151";
const T3   = "#6b7280";

const PRIORITY_COLOR: Record<string, string> = {
  high: "#dc2626", medium: "#d97706", low: "#15803d",
};
const TYPE_STYLE: Record<string, { bg: string; color: string }> = {
  aeo:          { bg: "#ede9fe", color: "#6d28d9" },
  geo:          { bg: "#dcfce7", color: "#15803d" },
  seo:          { bg: "#dbeafe", color: "#1d4ed8" },
  seo_longtail: { bg: "#dbeafe", color: "#1d4ed8" },
};

// ── Tab config ────────────────────────────────────────────────────────────────
type TabId = "scan" | "visibility" | "briefs" | "gap" | "technical";
const TABS: { id: TabId; label: string; Icon: React.ElementType; accentColor: string; desc: string }[] = [
  { id: "scan",       label: "AEO / GEO Scan",    Icon: Zap,       accentColor: A,         desc: "Personas, queries, competitors & smart recommendations from your brand scan" },
  { id: "visibility", label: "AI Visibility",      Icon: Eye,       accentColor: A,         desc: "Score every query for AI citability — Claude + Gemini + web authority signals" },
  { id: "briefs",     label: "Content Briefs",     Icon: Sparkles,  accentColor: "#fbbf24", desc: "AI-optimised content briefs for your top queries — ready to publish" },
  { id: "gap",        label: "Competitor Gap",     Icon: BarChart2, accentColor: "#f87171", desc: "Queries where competitors appear in AI answers but your brand doesn't" },
  { id: "technical",  label: "Technical Audit",    Icon: Gauge,     accentColor: "#818cf8", desc: "PageSpeed + Core Web Vitals for mobile & desktop — with AEO impact per metric" },
];

// ── API response types ────────────────────────────────────────────────────────
interface VisScore {
  query_id: string; query_text: string; query_type: string;
  revenue_proximity: number; claude_score: number; web_score: number;
  gemini_check: boolean; gemini_available: boolean; combined_score: number; reason: string;
}
interface VisResult { overall_score: number; gemini_available: boolean; results: VisScore[]; }

interface Brief {
  query_id: string; query_text: string; recommended_title: string;
  content_type: string; word_count: number; h2_sections: string[];
  key_points: string[]; citation_hook: string; schema_markup: string; estimated_impact: string;
}

interface GapRow {
  query_id: string; query_text: string; query_type: string;
  brand_appears: boolean; competitors_appear: string[]; gap_type: string; opportunity: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function TypeBadge({ type }: { type: string }) {
  const s = TYPE_STYLE[type] || TYPE_STYLE.seo;
  return (
    <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 99,
      fontSize: 11, fontWeight: 600, background: s.bg, color: s.color, whiteSpace: "nowrap" }}>
      {type === "seo_longtail" ? "SEO" : type.toUpperCase()}
    </span>
  );
}

function Spinner() {
  return (
    <div style={{ width: 32, height: 32, border: `3px solid ${BORD}`, borderTopColor: A,
      borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto" }} />
  );
}

function RunCTA({ icon: Icon, title, desc, accentColor, label, loading, onClick }: {
  icon: React.ElementType; title: string; desc: string; accentColor: string;
  label: string; loading: boolean; onClick: () => void;
}) {
  return (
    <div style={{ textAlign: "center", padding: "72px 0" }}>
      <div style={{ width: 64, height: 64, borderRadius: 20, background: `${accentColor}18`,
        display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
        <Icon style={{ width: 28, height: 28, color: accentColor }} />
      </div>
      <h3 style={{ fontSize: 20, fontWeight: 700, color: T1, marginBottom: 10 }}>{title}</h3>
      <p style={{ color: T3, marginBottom: 28, maxWidth: 460, margin: "0 auto 28px", lineHeight: 1.6 }}>{desc}</p>
      <button onClick={onClick} disabled={loading}
        style={{ background: accentColor, color: "#111", fontWeight: 700, padding: "12px 36px",
          borderRadius: 12, border: "none", cursor: loading ? "default" : "pointer", fontSize: 14,
          opacity: loading ? 0.7 : 1, display: "inline-flex", alignItems: "center", gap: 8 }}>
        {loading ? <><Spinner /><span style={{ marginLeft: 8 }}>Running…</span></> : label}
      </button>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const router = useRouter();
  const [tab, setTab] = useState<TabId>("scan");

  // Core data
  const [brand,       setBrand]       = useState<Brand | null>(null);
  const [personas,    setPersonas]    = useState<Persona[]>([]);
  const [queries,     setQueries]     = useState<Query[]>([]);
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [recs,        setRecs]        = useState<Recommendation[]>([]);
  const [coreLoading, setCoreLoading] = useState(true);

  // Module data
  const [visData,      setVisData]      = useState<VisResult | null>(null);
  const [visLoading,   setVisLoading]   = useState(false);
  const [briefsData,   setBriefsData]   = useState<Brief[]>([]);
  const [briefsLoading,setBriefsLoading]= useState(false);
  const [gapData,      setGapData]      = useState<GapRow[]>([]);
  const [gapLoading,   setGapLoading]   = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [psData,         setPsData]         = useState<Record<string, any> | null>(null);
  const [psLoading,      setPsLoading]      = useState(false);
  const [psError,        setPsError]        = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [schemaData,     setSchemaData]     = useState<Record<string, any> | null>(null);
  const [schemaLoading,  setSchemaLoading]  = useState(false);
  const [schemaError,    setSchemaError]    = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [authData,       setAuthData]       = useState<Record<string, any> | null>(null);
  const [authLoading,    setAuthLoading]    = useState(false);
  const [authError,      setAuthError]      = useState<string | null>(null);

  // UI state
  const [expandedBrief,   setExpandedBrief]   = useState<string | null>(null);
  const [expandedQueryId, setExpandedQueryId] = useState<string | null>(null);
  const [copiedId,        setCopiedId]        = useState<string | null>(null);

  useEffect(() => {
    const brandId = sessionStorage.getItem("brand_id");
    if (!brandId) { router.push("/"); return; }
    loadData(brandId);
  }, []);

  const loadData = async (brandId: string) => {
    const [bR, pR, qR, cR, rR] = await Promise.all([
      supabase.from("brands").select("*").eq("id", brandId).single(),
      supabase.from("personas").select("*").eq("brand_id", brandId),
      supabase.from("queries").select("*").eq("brand_id", brandId),
      supabase.from("competitors").select("*").eq("brand_id", brandId),
      supabase.from("recommendations").select("*").eq("brand_id", brandId).order("priority"),
    ]);
    if (bR.data) setBrand(bR.data);
    if (pR.data) setPersonas(pR.data);
    if (qR.data) setQueries(qR.data);
    if (cR.data) setCompetitors(cR.data);
    if (rR.data) setRecs(rR.data);
    setCoreLoading(false);
  };

  // ── API runners ─────────────────────────────────────────────────────────────
  const runVisibility = async () => {
    const brand_id = sessionStorage.getItem("brand_id");
    if (!brand_id) return;
    setVisLoading(true);
    try {
      const res  = await fetch("/api/visibility", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ brand_id }) });
      const data = await res.json();
      setVisData(data);
    } catch (e) { console.error(e); }
    setVisLoading(false);
  };

  const runBriefs = async () => {
    const brand_id = sessionStorage.getItem("brand_id");
    if (!brand_id) return;
    setBriefsLoading(true);
    try {
      const res  = await fetch("/api/briefs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ brand_id }) });
      const data = await res.json();
      setBriefsData(data.briefs || []);
    } catch (e) { console.error(e); }
    setBriefsLoading(false);
  };

  const runGap = async () => {
    const brand_id = sessionStorage.getItem("brand_id");
    if (!brand_id) return;
    setGapLoading(true);
    try {
      const res  = await fetch("/api/competitors", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ brand_id }) });
      const data = await res.json();
      setGapData(data.gaps || []);
    } catch (e) { console.error(e); }
    setGapLoading(false);
  };

  const runPageSpeed = async () => {
    const brand_id = sessionStorage.getItem("brand_id");
    if (!brand_id || !brand?.domain) return;
    setPsLoading(true); setPsError(null);
    try {
      const res  = await fetch("/api/pagespeed", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ brand_id, domain: brand.domain }) });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setPsData(data);
    } catch (e) { setPsError(String(e)); }
    setPsLoading(false);
  };

  const runSchemaCheck = async () => {
    if (!brand?.domain) return;
    setSchemaLoading(true); setSchemaError(null);
    try {
      const res  = await fetch("/api/schema", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ domain: brand.domain }) });
      const data = await res.json();
      if (data.error && !data.present) throw new Error(data.error);
      setSchemaData(data);
    } catch (e) { setSchemaError(String(e)); }
    setSchemaLoading(false);
  };

  const runAuthorityCheck = async () => {
    const brand_id = sessionStorage.getItem("brand_id");
    if (!brand_id || !brand?.domain) return;
    setAuthLoading(true); setAuthError(null);
    try {
      const res  = await fetch("/api/authority", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ brand_id, domain: brand.domain }) });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setAuthData(data);
    } catch (e) { setAuthError(String(e)); }
    setAuthLoading(false);
  };

  // ── Copy brief ──────────────────────────────────────────────────────────────
  const copyBrief = (b: Brief) => {
    const text = [
      `TITLE: ${b.recommended_title}`,
      `TYPE: ${b.content_type} | SCHEMA: ${b.schema_markup} | WORDS: ${b.word_count}`,
      `\nH2 SECTIONS:\n${b.h2_sections.map(h => `• ${h}`).join("\n")}`,
      `\nKEY POINTS:\n${b.key_points.map(p => `• ${p}`).join("\n")}`,
      `\nCITATION HOOK:\n${b.citation_hook}`,
    ].join("\n");
    navigator.clipboard.writeText(text);
    setCopiedId(b.query_id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // ── PDF helpers ─────────────────────────────────────────────────────────────
  const openPrint = (html: string) => {
    const w = window.open("", "_blank")!;
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 600);
  };

  const BASE_STYLE = `
    *{box-sizing:border-box}
    body{font-family:-apple-system,Arial,sans-serif;padding:40px;color:#111;font-size:13px;line-height:1.6}
    h1{font-size:26px;font-weight:800;margin:0 0 4px}
    .sub{color:#6b7280;font-size:12px;padding-bottom:14px;border-bottom:3px solid #00FF96;margin-bottom:24px}
    h2{font-size:13px;font-weight:700;margin:28px 0 10px;padding:7px 12px;background:#f0fdf4;border-left:4px solid #00FF96}
    table{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:8px}
    th{background:#111;color:#fff;padding:7px 10px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.5px}
    td{padding:7px 10px;border-bottom:1px solid #e5e7eb;vertical-align:top}
    tr:nth-child(even) td{background:#fafafa}
    .badge{display:inline-block;padding:2px 7px;border-radius:99px;font-size:10px;font-weight:600}
    .aeo{background:#ede9fe;color:#6d28d9}.geo{background:#dcfce7;color:#15803d}
    .seo,.seo_longtail{background:#dbeafe;color:#1d4ed8}
    footer{margin-top:40px;padding-top:12px;border-top:1px solid #e5e7eb;font-size:10px;color:#aaa;text-align:center}
    @media print{body{padding:20px}}`;

  const downloadScanPDF = () => {
    const personasHTML = personas.map(p => {
      const pp = Array.isArray(p.pain_points) ? p.pain_points : [];
      const gg = Array.isArray(p.goals)       ? p.goals       : [];
      return `<div style="border:1px solid #e5e7eb;border-radius:10px;padding:14px;margin-bottom:12px;background:#fafafa">
        <strong style="font-size:14px">${p.name}</strong>
        <span style="display:block;font-size:11px;color:#6b7280">${p.age_range || ""} · ${p.archetype || ""}</span>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:8px">
          <div><div style="font-size:10px;font-weight:700;text-transform:uppercase;color:#059669">Pain Points</div><ul style="margin:4px 0;padding-left:16px">${pp.map((x: string) => `<li>${x}</li>`).join("")}</ul></div>
          <div><div style="font-size:10px;font-weight:700;text-transform:uppercase;color:#059669">Goals</div><ul style="margin:4px 0;padding-left:16px">${gg.map((x: string) => `<li>${x}</li>`).join("")}</ul></div>
        </div>
      </div>`;
    }).join("");

    const recsHTML = recs.map((r, i) => `
      <div style="border:1px solid #e5e7eb;border-left:4px solid ${PRIORITY_COLOR[r.priority] || "#aaa"};border-radius:10px;padding:14px;margin-bottom:10px">
        <strong>${i + 1}. ${r.title}</strong>
        <span style="display:block;font-size:11px;color:#6b7280;margin:4px 0">${r.category.toUpperCase()} · ${r.priority} priority · <strong style="color:#059669">${r.projected_lift}</strong></span>
        <p style="margin:6px 0;color:#374151;font-size:12px">${r.description}</p>
        <span style="background:#f0fdf4;border:1px solid #bbf7d0;color:#15803d;padding:3px 10px;border-radius:99px;font-size:11px;font-weight:600">${r.action_label}</span>
      </div>`).join("");

    openPrint(`<html><head><title>BrandEcho — ${brand?.name}</title><style>${BASE_STYLE}</style></head><body>
      <h1>BrandEcho — ${brand?.name}</h1>
      <div class="sub">Industry: ${brand?.industry} &nbsp;·&nbsp; Domain: ${brand?.domain} &nbsp;·&nbsp; ${new Date().toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"})}</div>
      <p style="color:#374151;margin-bottom:24px">${brand?.description || ""}</p>
      <h2>👤 User Personas</h2>${personasHTML}
      <h2>🔍 Optimisation Queries (${queries.length})</h2>
      <table><tr><th>Query</th><th>Type</th><th>Intent</th><th>Revenue %</th></tr>
        ${queries.map(q => `<tr><td>${q.text}</td><td><span class="badge ${q.type}">${q.type==="seo_longtail"?"SEO":q.type.toUpperCase()}</span></td><td style="text-transform:capitalize">${q.intent}</td><td style="font-weight:700;color:#059669">${q.revenue_proximity}%</td></tr>`).join("")}
      </table>
      <h2>🏢 Competitors</h2>
      <table><tr><th>Name</th><th>Domain</th><th>Type</th></tr>
        ${competitors.map(c => `<tr><td style="font-weight:600">${c.name}</td><td style="color:#6b7280">${c.domain}</td><td>${c.type==="direct"?"Direct":"Substitute"}</td></tr>`).join("")}
      </table>
      <h2>💡 Recommendations</h2>${recsHTML}
      <footer>Generated by BrandEcho · Powered by Claude AI · ${new Date().toLocaleString()}</footer>
    </body></html>`);
  };

  const downloadVisibilityPDF = () => {
    if (!visData) return;
    openPrint(`<html><head><title>AI Visibility — ${brand?.name}</title><style>${BASE_STYLE}</style></head><body>
      <h1>AI Visibility Report — ${brand?.name}</h1>
      <div class="sub">Overall Score: <strong>${visData.overall_score}/100</strong> &nbsp;·&nbsp; ${visData.results?.length || 0} queries scored &nbsp;·&nbsp; ${new Date().toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"})}</div>
      <table>
        <tr><th>Query</th><th>Claude</th><th>Gemini</th><th>Web</th><th>Combined</th></tr>
        ${(visData.results || []).map(s => `<tr>
          <td>${s.query_text}</td>
          <td style="text-align:center">${s.claude_score}</td>
          <td style="text-align:center">${s.gemini_available ? (s.gemini_check ? "✓ Cited" : "✗ Missing") : "—"}</td>
          <td style="text-align:center">${s.web_score}</td>
          <td style="text-align:center;font-weight:700;color:${s.combined_score>=70?"#15803d":s.combined_score>=40?"#d97706":"#dc2626"}">${s.combined_score}</td>
        </tr>`).join("")}
      </table>
      <footer>Generated by BrandEcho · Powered by Claude AI · ${new Date().toLocaleString()}</footer>
    </body></html>`);
  };

  const downloadBriefsPDF = () => {
    if (!briefsData.length) return;
    const html = briefsData.map(b => `
      <div style="border:1px solid #e5e7eb;border-radius:10px;padding:18px;margin-bottom:16px;background:#fafafa">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:#059669;margin-bottom:6px">${b.content_type} · ${b.schema_markup} · ~${b.word_count} words · <span style="color:${b.estimated_impact==="high"?"#dc2626":b.estimated_impact==="medium"?"#d97706":"#15803d"}">${b.estimated_impact} impact</span></div>
        <h3 style="font-size:15px;margin:0 0 10px;color:#111">${b.recommended_title}</h3>
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#6b7280;margin-bottom:4px">H2 Sections</div>
        <ul style="margin:0 0 10px;padding-left:18px">${b.h2_sections.map(h => `<li style="margin-bottom:2px">${h}</li>`).join("")}</ul>
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#6b7280;margin-bottom:4px">Key Points</div>
        <ul style="margin:0 0 10px;padding-left:18px">${b.key_points.map(p => `<li style="margin-bottom:2px">${p}</li>`).join("")}</ul>
        <div style="background:#f0fdf4;border-left:3px solid #00FF96;padding:8px 12px;border-radius:4px;font-size:12px;color:#374151"><strong>Citation Hook:</strong> ${b.citation_hook}</div>
      </div>`).join("");
    openPrint(`<html><head><title>Content Briefs — ${brand?.name}</title><style>${BASE_STYLE}</style></head><body>
      <h1>Content Briefs — ${brand?.name}</h1>
      <div class="sub">Top ${briefsData.length} queries · ${new Date().toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"})}</div>
      ${html}
      <footer>Generated by BrandEcho · Powered by Claude AI · ${new Date().toLocaleString()}</footer>
    </body></html>`);
  };

  const downloadGapPDF = () => {
    if (!gapData.length) return;
    openPrint(`<html><head><title>Competitor Gap — ${brand?.name}</title><style>${BASE_STYLE}</style></head><body>
      <h1>Competitor Gap Report — ${brand?.name}</h1>
      <div class="sub">${gapData.filter(g => !g.brand_appears).length} gap queries identified · ${new Date().toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"})}</div>
      <table>
        <tr><th>Query</th><th>Brand</th><th>Competitors</th><th>Gap</th><th>Opportunity</th></tr>
        ${gapData.map(g => `<tr>
          <td>${g.query_text}</td>
          <td style="text-align:center;color:${g.brand_appears?"#15803d":"#dc2626"}">${g.brand_appears?"✓":"✗"}</td>
          <td>${g.competitors_appear.join(", ") || "—"}</td>
          <td style="font-weight:600;color:${g.gap_type==="missing"?"#dc2626":g.gap_type==="weak"?"#d97706":"#15803d"}">${g.gap_type}</td>
          <td style="font-size:11px;color:#374151">${g.opportunity}</td>
        </tr>`).join("")}
      </table>
      <footer>Generated by BrandEcho · Powered by Claude AI · ${new Date().toLocaleString()}</footer>
    </body></html>`);
  };

  // ── Loading ────────────────────────────────────────────────────────────────
  if (coreLoading) return (
    <div style={{ minHeight: "100vh", background: BG, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <Spinner />
    </div>
  );

  // ── Tab renders ────────────────────────────────────────────────────────────

  // SCAN TAB ─────────────────────────────────────────────────────────────────
  const ScanTab = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16 }}>
        {[
          { label: "Optimisation Queries", value: queries.length,                                  Icon: MessageSquare },
          { label: "Competitors Tracked",  value: competitors.length,                              Icon: Building2 },
          { label: "High-Revenue Queries", value: queries.filter(q => q.revenue_proximity >= 70).length, Icon: TrendingUp },
          { label: "Recommendations",      value: recs.length,                                     Icon: Zap },
        ].map(({ label, value, Icon }) => (
          <div key={label} style={{ background: SURF, border: `1px solid ${BORD}`, borderRadius: 16, padding: 20 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(0,255,150,0.1)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
              <Icon style={{ width: 20, height: 20, color: A }} />
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, color: T1, marginBottom: 4 }}>{value}</div>
            <div style={{ fontSize: 13, color: T3 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Personas */}
      <section>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: T1, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
          <Users style={{ width: 16, height: 16, color: A }} /> User Personas
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
          {personas.map(p => {
            const pp = Array.isArray(p.pain_points) ? p.pain_points : [];
            const gg = Array.isArray(p.goals)       ? p.goals       : [];
            return (
              <div key={p.id} style={{ background: SURF, border: `1px solid ${BORD}`, borderRadius: 16, padding: 20 }}>
                <div style={{ width: 42, height: 42, borderRadius: "50%", background: A, color: "#111", fontWeight: 800, fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
                  {p.name.charAt(0)}
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: T1, marginBottom: 2 }}>{p.name}</div>
                <div style={{ fontSize: 12, color: T3, marginBottom: 14 }}>{p.age_range} · {p.archetype}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: AT, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>Pain Points</div>
                {pp.slice(0, 2).map((pt: string, i: number) => (
                  <div key={i} style={{ fontSize: 12, color: T2, marginBottom: 2 }}>• {pt}</div>
                ))}
                <div style={{ fontSize: 11, fontWeight: 700, color: AT, textTransform: "uppercase", letterSpacing: "0.5px", marginTop: 10, marginBottom: 4 }}>Goals</div>
                {gg.slice(0, 1).map((g: string, i: number) => (
                  <div key={i} style={{ fontSize: 12, color: T2 }}>• {g}</div>
                ))}
              </div>
            );
          })}
        </div>
      </section>

      {/* Queries */}
      <section>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: T1, marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}>
          <MessageSquare style={{ width: 16, height: 16, color: A }} /> Optimisation Queries
        </h2>
        <p style={{ fontSize: 13, color: T3, marginBottom: 16 }}>
          Pre-decision queries — real searches where {brand?.name} should appear in AI answers. Click any row to see AI citation sources.
        </p>
        <div style={{ border: `1px solid ${BORD}`, borderRadius: 16, overflow: "hidden" }}>
          {/* Table header */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 74px 110px 180px 20px",
            padding: "10px 20px", background: "#f3f4f6",
            fontSize: 11, fontWeight: 700, color: T3, textTransform: "uppercase", letterSpacing: "0.5px" }}>
            <span>Query</span><span>Type</span><span>Intent</span><span>Purchase Stage</span><span />
          </div>
          {queries.map((q, i) => {
            const ts    = TYPE_STYLE[q.type] || TYPE_STYLE.seo;
            const open  = expandedQueryId === q.id;
            const stage = q.revenue_proximity >= 90 ? { label: "Ready to Buy",  color: "#15803d", bg: "#f0fdf4" }
                        : q.revenue_proximity >= 70 ? { label: "Evaluating",    color: "#1d4ed8", bg: "#eff6ff" }
                        : q.revenue_proximity >= 50 ? { label: "Considering",   color: "#d97706", bg: "#fffbeb" }
                        : q.revenue_proximity >= 20 ? { label: "Researching",   color: "#7c3aed", bg: "#f5f3ff" }
                        :                             { label: "Awareness",     color: T3,        bg: SURF };
            const citations: { source: string; url_pattern: string; type: string; why: string }[] =
              Array.isArray(q.citations) ? q.citations : [];
            const CITE_ICON: Record<string, string> = {
              forum: "💬", review_site: "⭐", comparison_site: "⚖️",
              news: "📰", expert_guide: "📚", video: "🎬",
            };
            return (
              <div key={q.id} style={{ borderTop: `1px solid ${BORD}`, background: open ? "#fafffe" : i % 2 === 1 ? "rgba(0,0,0,0.012)" : BG }}>
                {/* Main row — clickable */}
                <button onClick={() => setExpandedQueryId(open ? null : q.id)}
                  style={{ width: "100%", display: "grid", gridTemplateColumns: "1fr 74px 110px 180px 20px",
                    padding: "13px 20px", alignItems: "center", background: "none", border: "none",
                    cursor: "pointer", textAlign: "left", gap: 0 }}>
                  <span style={{ fontSize: 13, color: T1, paddingRight: 16 }}>{q.text}</span>
                  <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 99,
                    fontSize: 11, fontWeight: 600, background: ts.bg, color: ts.color, justifySelf: "start" }}>
                    {q.type === "seo_longtail" ? "SEO" : q.type.toUpperCase()}
                  </span>
                  <span style={{ fontSize: 12, color: T2, textTransform: "capitalize" }}>{q.intent}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ height: 6, flex: 1, borderRadius: 99, background: BORD, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${q.revenue_proximity}%`, background: stage.color, borderRadius: 99 }} />
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 99,
                      background: stage.bg, color: stage.color, whiteSpace: "nowrap" }}>
                      {stage.label}
                    </span>
                  </div>
                  {open
                    ? <ChevronUp  style={{ width: 14, height: 14, color: T3 }} />
                    : <ChevronDown style={{ width: 14, height: 14, color: T3 }} />}
                </button>

                {/* Citations panel */}
                {open && (
                  <div style={{ padding: "0 20px 16px 20px", borderTop: `1px dashed ${BORD}` }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: AT, textTransform: "uppercase",
                      letterSpacing: "0.5px", margin: "12px 0 8px" }}>
                      📎 AI Citation Sources — where {brand?.name} needs to earn mentions for this query
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {citations.length > 0 ? citations.map((c, ci) => (
                        <div key={ci} style={{ display: "flex", alignItems: "flex-start", gap: 12,
                          background: SURF, border: `1px solid ${BORD}`, borderRadius: 10, padding: "10px 14px" }}>
                          <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>
                            {CITE_ICON[c.type] || "🔗"}
                          </span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                              <span style={{ fontSize: 13, fontWeight: 600, color: T1 }}>{c.source}</span>
                              <span style={{ fontSize: 10, fontWeight: 600, color: T3, background: "#f3f4f6",
                                padding: "1px 6px", borderRadius: 99, textTransform: "uppercase" }}>
                                {c.type.replace("_", " ")}
                              </span>
                            </div>
                            <div style={{ fontSize: 12, color: T3 }}>{c.url_pattern}</div>
                            <div style={{ fontSize: 12, color: T2, marginTop: 4 }}>{c.why}</div>
                          </div>
                        </div>
                      )) : (
                        <div style={{ fontSize: 12, color: T3, fontStyle: "italic" }}>
                          Citations will appear for newly scanned brands. Re-scan to generate citations.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Competitors */}
      <section>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: T1, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
          <Building2 style={{ width: 16, height: 16, color: A }} /> Competitors
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
          {competitors.map(c => (
            <div key={c.id} style={{ background: SURF, border: `1px solid ${BORD}`, borderRadius: 14, padding: 16, display: "flex", alignItems: "center", gap: 12 }}>
              <Globe style={{ width: 16, height: 16, color: A, flexShrink: 0 }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: T1 }}>{c.name}</div>
                <div style={{ fontSize: 12, color: T3 }}>{c.domain}</div>
                <div style={{ fontSize: 11, marginTop: 2, color: c.type === "direct" ? "#fb923c" : "#a78bfa" }}>
                  {c.type === "direct" ? "Direct Competitor" : "Category Substitute"}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Recommendations */}
      <section>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: T1, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
          <TrendingUp style={{ width: 16, height: 16, color: A }} /> Smart Recommendations
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {recs.map((r, i) => (
            <div key={r.id} style={{ background: SURF, border: `1px solid ${BORD}`,
              borderLeft: `4px solid ${PRIORITY_COLOR[r.priority] || "#aaa"}`,
              borderRadius: 14, padding: 20 }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 8 }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: A, color: "#111",
                  fontWeight: 800, fontSize: 13, display: "flex", alignItems: "center",
                  justifyContent: "center", flexShrink: 0 }}>
                  {i + 1}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: T1 }}>{r.title}</div>
                  <div style={{ fontSize: 12, color: T3, marginTop: 3 }}>
                    {r.category.toUpperCase()} ·&nbsp;
                    <span style={{ color: PRIORITY_COLOR[r.priority] }}>{r.priority} priority</span>
                    &nbsp;·&nbsp;<strong style={{ color: AT }}>{r.projected_lift}</strong>
                  </div>
                </div>
              </div>
              <p style={{ fontSize: 13, color: T2, margin: "0 0 12px" }}>{r.description}</p>
              <span style={{ display: "inline-block", background: "#f0fdf4", border: "1px solid #bbf7d0",
                color: "#15803d", padding: "4px 14px", borderRadius: 99, fontSize: 12, fontWeight: 600 }}>
                {r.action_label}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Download button */}
      <button onClick={downloadScanPDF}
        style={{ alignSelf: "flex-start", display: "flex", alignItems: "center", gap: 8,
          background: A, color: "#111", fontWeight: 700, padding: "11px 24px", borderRadius: 10,
          border: "none", cursor: "pointer", fontSize: 13 }}>
        <FileText style={{ width: 16, height: 16 }} /> Download Full Scan Report (PDF)
      </button>
    </div>
  );

  // VISIBILITY TAB ───────────────────────────────────────────────────────────
  const VisibilityTab = () => {
    if (!visData) return (
      <RunCTA
        icon={Eye} accentColor={A}
        title="AI Visibility Checker"
        desc="Score each query 0–100 for how likely AI engines (ChatGPT, Perplexity, Gemini) are to cite your brand. Uses Claude prediction + Gemini live check + web authority signals."
        label="Run Visibility Analysis"
        loading={visLoading}
        onClick={runVisibility}
      />
    );
    const scores = visData.results || [];
    const strong = scores.filter(s => s.combined_score >= 70).length;
    const gaps   = scores.filter(s => s.combined_score < 40).length;
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {/* Score cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16 }}>
          {[
            { label: "Overall Score",    value: `${visData.overall_score}/100` },
            { label: "Queries Scored",   value: scores.length },
            { label: "Strong Visibility",value: strong },
            { label: "Gap Queries",      value: gaps },
          ].map(({ label, value }) => (
            <div key={label} style={{ background: SURF, border: `1px solid ${BORD}`, borderRadius: 16, padding: 20 }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: T1, marginBottom: 4 }}>{value}</div>
              <div style={{ fontSize: 13, color: T3 }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Scores table */}
        <div style={{ background: SURF, border: `1px solid ${BORD}`, borderRadius: 16, overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 90px 110px 90px 130px",
            padding: "10px 20px", background: "#f3f4f6",
            fontSize: 11, fontWeight: 700, color: T3, textTransform: "uppercase", letterSpacing: "0.5px" }}>
            <span>Query</span><span>Claude</span><span>Gemini</span><span>Web</span><span>Combined</span>
          </div>
          {scores.map((s, i) => (
            <div key={s.query_id} style={{ display: "grid", gridTemplateColumns: "1fr 90px 110px 90px 130px",
              padding: "12px 20px", borderTop: `1px solid ${BORD}`, alignItems: "center",
              background: i % 2 === 1 ? "rgba(0,0,0,0.015)" : BG }}>
              <span style={{ fontSize: 13, color: T1 }}>{s.query_text}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: T1 }}>{s.claude_score}/100</span>
              <span>
                {!s.gemini_available
                  ? <span style={{ fontSize: 12, color: T3 }}>—</span>
                  : s.gemini_check
                    ? <span style={{ fontSize: 12, color: "#15803d", display: "flex", alignItems: "center", gap: 4 }}><CheckCircle style={{ width: 13, height: 13 }} /> Cited</span>
                    : <span style={{ fontSize: 12, color: "#dc2626", display: "flex", alignItems: "center", gap: 4 }}><XCircle style={{ width: 13, height: 13 }} /> Missing</span>
                }
              </span>
              <span style={{ fontSize: 13, fontWeight: 600, color: T1 }}>{s.web_score}/100</span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ flex: 1, height: 6, borderRadius: 99, background: BORD, overflow: "hidden" }}>
                  <div style={{ height: "100%", borderRadius: 99,
                    width: `${s.combined_score}%`,
                    background: s.combined_score >= 70 ? A : s.combined_score >= 40 ? "#fbbf24" : "#f87171" }} />
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: T1, minWidth: 28 }}>{s.combined_score}</span>
              </div>
            </div>
          ))}
        </div>

        <button onClick={downloadVisibilityPDF}
          style={{ alignSelf: "flex-start", display: "flex", alignItems: "center", gap: 8,
            background: A, color: "#111", fontWeight: 700, padding: "11px 24px",
            borderRadius: 10, border: "none", cursor: "pointer", fontSize: 13 }}>
          <FileText style={{ width: 16, height: 16 }} /> Download Visibility Report (PDF)
        </button>
      </div>
    );
  };

  // BRIEFS TAB ───────────────────────────────────────────────────────────────
  const BriefsTab = () => {
    if (!briefsData.length) return (
      <RunCTA
        icon={Sparkles} accentColor="#fbbf24"
        title="Content Brief Generator"
        desc="Auto-generate fully structured content briefs for your top 5 revenue queries — titles, H2 sections, key points, citation hooks, and schema markup. Ready to hand to a writer."
        label="Generate Content Briefs"
        loading={briefsLoading}
        onClick={runBriefs}
      />
    );
    const IMPACT_COLOR: Record<string, string> = { high: "#dc2626", medium: "#d97706", low: "#15803d" };
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {briefsData.map(b => {
          const open = expandedBrief === b.query_id;
          return (
            <div key={b.query_id} style={{ background: SURF, border: `1px solid ${BORD}`, borderRadius: 16, overflow: "hidden" }}>
              {/* Brief header — always visible */}
              <button onClick={() => setExpandedBrief(open ? null : b.query_id)}
                style={{ width: "100%", display: "flex", alignItems: "center", gap: 16,
                  padding: "18px 20px", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: IMPACT_COLOR[b.estimated_impact] || T3,
                      textTransform: "uppercase", letterSpacing: "0.5px" }}>
                      {b.estimated_impact} impact
                    </span>
                    <span style={{ fontSize: 11, color: T3 }}>·</span>
                    <span style={{ fontSize: 11, color: T3 }}>{b.content_type}</span>
                    <span style={{ fontSize: 11, color: T3 }}>·</span>
                    <span style={{ fontSize: 11, color: T3 }}>~{b.word_count} words</span>
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: T1, marginBottom: 4 }}>{b.recommended_title}</div>
                  <div style={{ fontSize: 12, color: T3 }}>Query: {b.query_text}</div>
                </div>
                <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                  <button onClick={e => { e.stopPropagation(); copyBrief(b); }}
                    style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px",
                      borderRadius: 8, border: `1px solid ${BORD}`, background: BG,
                      color: copiedId === b.query_id ? "#15803d" : T3, fontSize: 12, cursor: "pointer" }}>
                    {copiedId === b.query_id
                      ? <><Check style={{ width: 13, height: 13 }} /> Copied!</>
                      : <><Copy style={{ width: 13, height: 13 }} /> Copy</>}
                  </button>
                  {open
                    ? <ChevronUp  style={{ width: 20, height: 20, color: T3 }} />
                    : <ChevronDown style={{ width: 20, height: 20, color: T3 }} />}
                </div>
              </button>

              {/* Expanded content */}
              {open && (
                <div style={{ padding: "0 20px 20px", borderTop: `1px solid ${BORD}` }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginTop: 16 }}>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: AT, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>H2 Sections</div>
                      {b.h2_sections.map((h, i) => (
                        <div key={i} style={{ fontSize: 13, color: T2, padding: "6px 0", borderBottom: `1px solid ${BORD}` }}>
                          {i + 1}. {h}
                        </div>
                      ))}
                    </div>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: AT, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>Key Points to Cover</div>
                      {b.key_points.map((pt, i) => (
                        <div key={i} style={{ fontSize: 13, color: T2, padding: "6px 0", borderBottom: `1px solid ${BORD}` }}>
                          • {pt}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={{ marginTop: 16, background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, padding: "12px 16px" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: AT, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>AI Citation Hook</div>
                    <div style={{ fontSize: 13, color: T2 }}>{b.citation_hook}</div>
                  </div>
                  <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
                    <span style={{ fontSize: 11, background: "#ede9fe", color: "#6d28d9", padding: "3px 10px", borderRadius: 99, fontWeight: 600 }}>
                      Schema: {b.schema_markup}
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        <button onClick={downloadBriefsPDF}
          style={{ alignSelf: "flex-start", display: "flex", alignItems: "center", gap: 8,
            background: "#fbbf24", color: "#111", fontWeight: 700, padding: "11px 24px",
            borderRadius: 10, border: "none", cursor: "pointer", fontSize: 13 }}>
          <FileText style={{ width: 16, height: 16 }} /> Download All Briefs (PDF)
        </button>
      </div>
    );
  };

  // GAP TAB ──────────────────────────────────────────────────────────────────
  const GapTab = () => {
    if (!gapData.length) return (
      <RunCTA
        icon={BarChart2} accentColor="#f87171"
        title="Competitor Gap Analysis"
        desc="See exactly which queries competitors appear in AI engine answers — but your brand doesn't. Each gap comes with a specific action to close it."
        label="Analyze Competitor Gaps"
        loading={gapLoading}
        onClick={runGap}
      />
    );
    const GAP_COLOR: Record<string, { bg: string; color: string }> = {
      missing: { bg: "#fef2f2", color: "#dc2626" },
      weak:    { bg: "#fffbeb", color: "#d97706" },
      strong:  { bg: "#f0fdf4", color: "#15803d" },
    };
    const missingCount = gapData.filter(g => g.gap_type === "missing").length;
    const weakCount    = gapData.filter(g => g.gap_type === "weak").length;
    const strongCount  = gapData.filter(g => g.gap_type === "strong").length;
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {/* Summary chips */}
        <div style={{ display: "flex", gap: 12 }}>
          {[
            { label: "Critical Gaps",     value: missingCount, ...GAP_COLOR.missing },
            { label: "Weak Presence",     value: weakCount,    ...GAP_COLOR.weak },
            { label: "Strong Positions",  value: strongCount,  ...GAP_COLOR.strong },
          ].map(({ label, value, bg, color }) => (
            <div key={label} style={{ background: bg, border: `1px solid ${color}40`, borderRadius: 12, padding: "12px 20px" }}>
              <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
              <div style={{ fontSize: 12, color, fontWeight: 600 }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Gap table */}
        <div style={{ background: SURF, border: `1px solid ${BORD}`, borderRadius: 16, overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 160px 90px 1fr",
            padding: "10px 20px", background: "#f3f4f6",
            fontSize: 11, fontWeight: 700, color: T3, textTransform: "uppercase", letterSpacing: "0.5px" }}>
            <span>Query</span><span>Brand</span><span>Competitors Seen</span><span>Gap Type</span><span>Opportunity</span>
          </div>
          {gapData.map((g, i) => {
            const gs = GAP_COLOR[g.gap_type] || GAP_COLOR.strong;
            return (
              <div key={g.query_id} style={{ display: "grid", gridTemplateColumns: "1fr 80px 160px 90px 1fr",
                padding: "12px 20px", borderTop: `1px solid ${BORD}`, alignItems: "start",
                background: i % 2 === 1 ? "rgba(0,0,0,0.015)" : BG }}>
                <div>
                  <div style={{ fontSize: 13, color: T1, marginBottom: 2 }}>{g.query_text}</div>
                  <TypeBadge type={g.query_type} />
                </div>
                <span style={{ fontSize: 18 }}>{g.brand_appears ? "✅" : "❌"}</span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {g.competitors_appear.length
                    ? g.competitors_appear.map((c, ci) => (
                        <span key={ci} style={{ fontSize: 11, background: "#fef2f2", color: "#dc2626",
                          padding: "2px 8px", borderRadius: 99, fontWeight: 600 }}>{c}</span>
                      ))
                    : <span style={{ fontSize: 12, color: T3 }}>None</span>}
                </div>
                <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: 99,
                  fontSize: 11, fontWeight: 700, background: gs.bg, color: gs.color, whiteSpace: "nowrap" }}>
                  {g.gap_type}
                </span>
                <span style={{ fontSize: 12, color: T2, lineHeight: 1.5 }}>{g.opportunity}</span>
              </div>
            );
          })}
        </div>

        <button onClick={downloadGapPDF}
          style={{ alignSelf: "flex-start", display: "flex", alignItems: "center", gap: 8,
            background: "#f87171", color: "#fff", fontWeight: 700, padding: "11px 24px",
            borderRadius: 10, border: "none", cursor: "pointer", fontSize: 13 }}>
          <FileText style={{ width: 16, height: 16 }} /> Download Gap Report (PDF)
        </button>
      </div>
    );
  };

  // ── Shared sub-section wrapper ─────────────────────────────────────────────
  const SectionPanel = ({ title, icon: Icon, color, children }: {
    title: string; icon: React.ElementType; color: string; children: React.ReactNode;
  }) => (
    <div style={{ border: `1px solid ${BORD}`, borderRadius: 18, overflow: "hidden" }}>
      <div style={{ padding: "14px 20px", background: SURF, borderBottom: `1px solid ${BORD}`,
        display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 32, height: 32, borderRadius: 10, background: `${color}18`,
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Icon style={{ width: 16, height: 16, color }} />
        </div>
        <span style={{ fontSize: 14, fontWeight: 700, color: T1 }}>{title}</span>
      </div>
      <div style={{ padding: 20 }}>{children}</div>
    </div>
  );

  // TECHNICAL TAB ───────────────────────────────────────────────────────────
  const TechnicalTab = () => {
    const SCORE_COLOR = (s: number) => s >= 90 ? "#15803d" : s >= 50 ? "#d97706" : "#dc2626";
    const SCORE_BG    = (s: number) => s >= 90 ? "#f0fdf4" : s >= 50 ? "#fffbeb" : "#fef2f2";
    const STATUS_COLOR: Record<string, string> = { good: "#15803d", "needs-improvement": "#d97706", poor: "#dc2626" };
    const STATUS_BG:    Record<string, string> = { good: "#f0fdf4", "needs-improvement": "#fffbeb", poor: "#fef2f2" };

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

        {/* ── 1. PageSpeed ──────────────────────────────────────────────── */}
        <SectionPanel title="PageSpeed Insights" icon={Gauge} color="#818cf8">
          {!psData && !psError && (
            <div style={{ textAlign: "center", padding: "32px 0" }}>
              <p style={{ color: T3, fontSize: 13, marginBottom: 16, maxWidth: 440, margin: "0 auto 16px" }}>
                Mobile &amp; desktop performance scores with Core Web Vitals and AEO impact per metric.
              </p>
              <button onClick={runPageSpeed} disabled={psLoading}
                style={{ background: "#818cf8", color: "#fff", fontWeight: 700, padding: "10px 28px",
                  borderRadius: 10, border: "none", cursor: psLoading ? "default" : "pointer",
                  fontSize: 13, opacity: psLoading ? 0.7 : 1 }}>
                {psLoading ? "Running…" : "Run PageSpeed Audit"}
              </button>
            </div>
          )}
          {psError && (
            <div style={{ color: "#dc2626", fontSize: 13, padding: "8px 0" }}>
              ⚠️ {psError} <button onClick={runPageSpeed} style={{ marginLeft: 12, color: "#818cf8", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>Retry</button>
            </div>
          )}
          {psData && (() => {
            const vitals        = psData.vitals        || [];
            const opportunities = psData.opportunities || [];
            const mScore        = psData.mobile_score;
            const dScore        = psData.desktop_score;
            return (
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                {/* Scores */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, maxWidth: 360 }}>
                  {[{ label: "Mobile", score: mScore, icon: "📱" }, { label: "Desktop", score: dScore, icon: "🖥️" }].map(({ label, score, icon }) => (
                    <div key={label} style={{ background: score != null ? SCORE_BG(score) : SURF,
                      border: `1px solid ${score != null ? SCORE_COLOR(score) + "40" : BORD}`,
                      borderRadius: 14, padding: "16px 20px", textAlign: "center" }}>
                      <div style={{ fontSize: 18, marginBottom: 4 }}>{icon}</div>
                      <div style={{ fontSize: 36, fontWeight: 900, color: score != null ? SCORE_COLOR(score) : T3, lineHeight: 1 }}>{score ?? "—"}</div>
                      <div style={{ fontSize: 12, color: T2, marginTop: 4, fontWeight: 600 }}>{label}</div>
                      <div style={{ fontSize: 11, color: T3 }}>{score == null ? "N/A" : score >= 90 ? "Good" : score >= 50 ? "Needs Work" : "Poor"}</div>
                    </div>
                  ))}
                </div>
                {/* Vitals */}
                <div style={{ border: `1px solid ${BORD}`, borderRadius: 12, overflow: "hidden" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "100px 1fr 90px 90px 60px",
                    padding: "8px 14px", background: "#f3f4f6",
                    fontSize: 10, fontWeight: 700, color: T3, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    <span>Metric</span><span>Name</span><span>Mobile</span><span>Desktop</span><span>Status</span>
                  </div>
                  {vitals.map((v: Record<string, string>, i: number) => {
                    const st = v.status || "poor";
                    return (
                      <div key={v.id} style={{ borderTop: `1px solid ${BORD}`, background: i % 2 === 1 ? "rgba(0,0,0,0.012)" : BG }}>
                        <div style={{ display: "grid", gridTemplateColumns: "100px 1fr 90px 90px 60px", padding: "10px 14px", alignItems: "center" }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: T1 }}>{v.short}</span>
                          <span style={{ fontSize: 12, color: T2 }}>{v.label}</span>
                          <span style={{ fontSize: 13, fontWeight: 700, color: STATUS_COLOR[st] || T3 }}>{v.display}</span>
                          <span style={{ fontSize: 12, color: T3 }}>{v.desktop_display || "—"}</span>
                          <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 99,
                            background: STATUS_BG[st] || SURF, color: STATUS_COLOR[st] || T3, textTransform: "uppercase", whiteSpace: "nowrap" }}>
                            {st === "needs-improvement" ? "Avg" : st}
                          </span>
                        </div>
                        {v.aeo_impact && (
                          <div style={{ padding: "0 14px 8px 114px" }}>
                            <div style={{ fontSize: 11, color: "#7c3aed", background: "#f5f3ff", border: "1px solid #ddd6fe", borderRadius: 8, padding: "5px 10px", display: "flex", gap: 5 }}>
                              <span>🤖</span><span><strong>AEO:</strong> {v.aeo_impact}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {/* Opportunities */}
                {opportunities.length > 0 && (
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: T1, marginBottom: 10 }}>⚡ Top Fixes</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {opportunities.map((op: Record<string, string | number>, i: number) => (
                        <div key={i} style={{ background: SURF, border: `1px solid ${BORD}`, borderRadius: 10, padding: "12px 14px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 4 }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: T1 }}>{op.title}</span>
                            {(op.savings_ms as number) > 0 && (
                              <span style={{ fontSize: 11, fontWeight: 700, color: "#d97706", background: "#fffbeb", border: "1px solid #fde68a", padding: "1px 8px", borderRadius: 99, whiteSpace: "nowrap", flexShrink: 0 }}>
                                −{((op.savings_ms as number) / 1000).toFixed(1)}s
                              </span>
                            )}
                          </div>
                          {op.aeo_impact && (
                            <div style={{ fontSize: 11, color: "#7c3aed", background: "#f5f3ff", border: "1px solid #ddd6fe", borderRadius: 7, padding: "5px 9px", display: "flex", gap: 5, marginTop: 4 }}>
                              <span>🤖</span><span><strong>AEO:</strong> {op.aeo_impact}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <button onClick={runPageSpeed} style={{ fontSize: 12, color: T3, background: SURF, border: `1px solid ${BORD}`, padding: "7px 14px", borderRadius: 8, cursor: "pointer" }}>🔄 Re-run</button>
                  <span style={{ fontSize: 11, color: T3 }}>Powered by Google PageSpeed Insights · {new Date(psData.checked_at).toLocaleTimeString()}</span>
                </div>
              </div>
            );
          })()}
        </SectionPanel>

        {/* ── 2. Schema Markup ──────────────────────────────────────────── */}
        <SectionPanel title="Schema Markup Checker" icon={FileText} color="#0ea5e9">
          {!schemaData && !schemaError && (
            <div style={{ textAlign: "center", padding: "32px 0" }}>
              <p style={{ color: T3, fontSize: 13, marginBottom: 16, maxWidth: 440, margin: "0 auto 16px" }}>
                Crawls your homepage to detect JSON-LD schema types. Shows what's present, what's missing, and the AEO impact of each gap.
              </p>
              <button onClick={runSchemaCheck} disabled={schemaLoading}
                style={{ background: "#0ea5e9", color: "#fff", fontWeight: 700, padding: "10px 28px",
                  borderRadius: 10, border: "none", cursor: schemaLoading ? "default" : "pointer",
                  fontSize: 13, opacity: schemaLoading ? 0.7 : 1 }}>
                {schemaLoading ? "Scanning…" : "Check Schema Markup"}
              </button>
            </div>
          )}
          {schemaError && (
            <div style={{ color: "#dc2626", fontSize: 13, padding: "8px 0" }}>
              ⚠️ {schemaError} <button onClick={runSchemaCheck} style={{ marginLeft: 12, color: "#0ea5e9", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>Retry</button>
            </div>
          )}
          {schemaData && (() => {
            const present  = schemaData.present  || [];
            const missing  = schemaData.missing  || [];
            const score    = schemaData.health_score ?? 0;
            const critGaps = schemaData.critical_missing ?? 0;
            const SCORE_C  = score >= 70 ? "#15803d" : score >= 40 ? "#d97706" : "#dc2626";
            const IMP_COLOR: Record<string, string> = { critical: "#dc2626", high: "#d97706", medium: "#059669", low: "#6b7280" };
            const IMP_BG:    Record<string, string> = { critical: "#fef2f2", high: "#fffbeb", medium: "#f0fdf4", low: "#f9fafb" };
            return (
              <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                {/* Summary row */}
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  {[
                    { label: "Schema Health",    value: `${score}/100`, color: SCORE_C, bg: score >= 70 ? "#f0fdf4" : score >= 40 ? "#fffbeb" : "#fef2f2" },
                    { label: "Schemas Found",    value: present.length, color: "#059669", bg: "#f0fdf4" },
                    { label: "Critical Missing", value: critGaps,       color: "#dc2626", bg: "#fef2f2" },
                  ].map(({ label, value, color, bg }) => (
                    <div key={label} style={{ background: bg, border: `1px solid ${color}30`, borderRadius: 12, padding: "10px 18px" }}>
                      <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
                      <div style={{ fontSize: 11, color, fontWeight: 600 }}>{label}</div>
                    </div>
                  ))}
                </div>

                {/* Present schemas */}
                {present.length > 0 && (
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#15803d", marginBottom: 8 }}>✅ Found ({present.length})</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {present.map((s: Record<string, string>) => (
                        <span key={s.type} title={s.aeo_impact}
                          style={{ fontSize: 12, fontWeight: 600, padding: "4px 12px", borderRadius: 99,
                            background: "#f0fdf4", color: "#15803d", border: "1px solid #bbf7d0", cursor: "help" }}>
                          {s.label}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Missing schemas */}
                {missing.length > 0 && (
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: T1, marginBottom: 8 }}>❌ Missing — sorted by AEO impact</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {missing.slice(0, 6).map((s: Record<string, string>) => (
                        <div key={s.type} style={{ background: IMP_BG[s.importance] || SURF,
                          border: `1px solid ${IMP_COLOR[s.importance] || BORD}30`,
                          borderLeft: `3px solid ${IMP_COLOR[s.importance] || BORD}`,
                          borderRadius: 10, padding: "10px 14px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: T1 }}>{s.label}</span>
                            <span style={{ fontSize: 10, fontWeight: 700, color: IMP_COLOR[s.importance],
                              background: IMP_BG[s.importance], padding: "1px 7px", borderRadius: 99, textTransform: "uppercase" }}>
                              {s.importance}
                            </span>
                          </div>
                          <div style={{ fontSize: 12, color: "#7c3aed", background: "#f5f3ff", border: "1px solid #ddd6fe", borderRadius: 7, padding: "5px 9px", display: "flex", gap: 5 }}>
                            <span>🤖</span><span><strong>AEO:</strong> {s.aeo_impact}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <button onClick={runSchemaCheck} style={{ alignSelf: "flex-start", fontSize: 12, color: T3, background: SURF, border: `1px solid ${BORD}`, padding: "7px 14px", borderRadius: 8, cursor: "pointer" }}>🔄 Re-scan</button>
              </div>
            );
          })()}
        </SectionPanel>

        {/* ── 3. Domain Authority ───────────────────────────────────────── */}
        <SectionPanel title="Domain Authority vs Competitors" icon={TrendingUp} color="#f59e0b">
          {!authData && !authError && (
            <div style={{ textAlign: "center", padding: "32px 0" }}>
              <p style={{ color: T3, fontSize: 13, marginBottom: 16, maxWidth: 440, margin: "0 auto 16px" }}>
                Compare your domain's PageRank against competitors. Higher authority = more likely to be cited in AI answers.
                {!process.env.NEXT_PUBLIC_HAS_OPR && <span style={{ display: "block", marginTop: 8, color: "#d97706" }}>⚠️ Add <strong>OPENPR_API_KEY</strong> in Vercel for live scores (free at domainranker.com)</span>}
              </p>
              <button onClick={runAuthorityCheck} disabled={authLoading}
                style={{ background: "#f59e0b", color: "#fff", fontWeight: 700, padding: "10px 28px",
                  borderRadius: 10, border: "none", cursor: authLoading ? "default" : "pointer",
                  fontSize: 13, opacity: authLoading ? 0.7 : 1 }}>
                {authLoading ? "Checking…" : "Check Domain Authority"}
              </button>
            </div>
          )}
          {authError && (
            <div style={{ color: "#dc2626", fontSize: 13, padding: "8px 0" }}>
              ⚠️ {authError} <button onClick={runAuthorityCheck} style={{ marginLeft: 12, color: "#f59e0b", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>Retry</button>
            </div>
          )}
          {authData && (() => {
            const comps   = authData.competitors || [];
            const allRows = [
              { name: brand?.name || authData.brand_domain, domain: authData.brand_domain, pr: authData.brand_pr, label: authData.brand_label, color: authData.brand_color, bg: authData.brand_bg, isBrand: true },
              ...comps.map((c: Record<string, string | number | boolean>) => ({ ...c, isBrand: false })),
            ].sort((a, b) => (b.pr as number) - (a.pr as number));
            const maxPr = Math.max(...allRows.map(r => r.pr as number), 1);
            const apiAvail = authData.api_available;
            return (
              <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                {!apiAvail && (
                  <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, padding: "10px 14px", fontSize: 12, color: "#92400e" }}>
                    📊 <strong>Live scores unavailable</strong> — Add <code style={{ background: "#fef3c7", padding: "1px 5px", borderRadius: 4 }}>OPENPR_API_KEY</code> in Vercel env vars for real scores (free at <strong>domainranker.com</strong>).
                  </div>
                )}

                {/* Bar chart */}
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {allRows.map((r) => (
                    <div key={r.domain as string} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ width: 140, flexShrink: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: r.isBrand ? 800 : 600, color: r.isBrand ? AT : T1 }}>{r.name as string}</div>
                        <div style={{ fontSize: 11, color: T3 }}>{r.domain as string}</div>
                      </div>
                      <div style={{ flex: 1, height: 28, background: "#f3f4f6", borderRadius: 8, overflow: "hidden", position: "relative" }}>
                        {(r.pr as number) >= 0 ? (
                          <div style={{ height: "100%", width: `${((r.pr as number) / 10) * 100}%`,
                            background: r.isBrand ? A : r.ahead_of_brand ? "#fca5a5" : "#d1fae5",
                            borderRadius: 8, display: "flex", alignItems: "center", paddingLeft: 10,
                            minWidth: 40, transition: "width 0.5s ease" }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: "#111", whiteSpace: "nowrap" }}>{r.pr}</span>
                          </div>
                        ) : (
                          <div style={{ height: "100%", display: "flex", alignItems: "center", paddingLeft: 10 }}>
                            <span style={{ fontSize: 12, color: T3 }}>Score unavailable — add API key</span>
                          </div>
                        )}
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 99,
                        background: r.bg as string, color: r.color as string, minWidth: 60, textAlign: "center" }}>
                        {r.label as string}
                      </span>
                    </div>
                  ))}
                  <div style={{ fontSize: 11, color: T3 }}>Scale: 0–10 PageRank (OpenPageRank)</div>
                </div>

                {/* AEO note */}
                <div style={{ background: "#f5f3ff", border: "1px solid #ddd6fe", borderRadius: 10, padding: "12px 14px", fontSize: 12, color: "#7c3aed" }}>
                  🤖 <strong>AEO Impact:</strong> {authData.aeo_note}
                </div>

                {/* Recommendations */}
                {authData.recommendations?.length > 0 && (
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: T1, marginBottom: 8 }}>📈 Recommendations</div>
                    {authData.recommendations.map((r: string, i: number) => (
                      <div key={i} style={{ fontSize: 13, color: T2, padding: "6px 0", borderBottom: `1px solid ${BORD}` }}>• {r}</div>
                    ))}
                  </div>
                )}
                <button onClick={runAuthorityCheck} style={{ alignSelf: "flex-start", fontSize: 12, color: T3, background: SURF, border: `1px solid ${BORD}`, padding: "7px 14px", borderRadius: 8, cursor: "pointer" }}>🔄 Re-check</button>
              </div>
            );
          })()}
        </SectionPanel>
      </div>
    );
  };


  const activeTab = TABS.find(t => t.id === tab)!;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ background: BG, minHeight: "100vh" }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Sticky header */}
      <header style={{ position: "sticky", top: 0, zIndex: 30, background: "rgba(255,255,255,0.97)",
        borderBottom: `1px solid ${BORD}`, backdropFilter: "blur(8px)" }}>
        <div style={{ maxWidth: 1140, margin: "0 auto", padding: "14px 28px",
          display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <img src="/logo.svg" alt="BrandEcho" style={{ height: 28 }} />
            <div style={{ width: 1, height: 20, background: BORD }} />
            <div>
              <span style={{ fontWeight: 700, color: T1 }}>{brand?.name}</span>
              <span style={{ fontSize: 13, color: T3, marginLeft: 8 }}>{brand?.industry}</span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => {
              const rows = [
                ["BrandEcho Report", brand?.name, ""],
                [""], ["QUERIES", "", ""],
                ["Query", "Type", "Revenue %"],
                ...queries.map(q => [q.text, q.type, q.revenue_proximity]),
                [""], ["COMPETITORS", "", ""],
                ["Name", "Domain", "Type"],
                ...competitors.map(c => [c.name, c.domain, c.type]),
              ];
              const csv  = rows.map(r => r.map(String).map(v => `"${v}"`).join(",")).join("\n");
              const blob = new Blob([csv], { type: "text/csv" });
              const url  = URL.createObjectURL(blob);
              const a    = document.createElement("a");
              a.href = url; a.download = `${brand?.name || "brandecho"}-report.csv`; a.click();
              URL.revokeObjectURL(url);
            }} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px",
              borderRadius: 8, border: `1px solid ${BORD}`, background: SURF, color: T3, fontSize: 13, cursor: "pointer" }}>
              <Download style={{ width: 14, height: 14 }} /> CSV
            </button>
            <button onClick={downloadScanPDF}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px",
                borderRadius: 8, border: "none", background: A, color: "#111",
                fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              <FileText style={{ width: 14, height: 14 }} /> Download PDF
            </button>
          </div>
        </div>

        {/* Tab bar */}
        <div style={{ maxWidth: 1140, margin: "0 auto", padding: "0 28px", display: "flex", gap: 0 }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{ padding: "14px 22px", fontSize: 13, fontWeight: tab === t.id ? 700 : 500,
                color: tab === t.id ? T1 : T3, background: "none", border: "none",
                borderBottom: `2px solid ${tab === t.id ? t.accentColor : "transparent"}`,
                cursor: "pointer", display: "flex", alignItems: "center", gap: 7,
                transition: "color 0.15s, border-color 0.15s" }}>
              <t.Icon style={{ width: 15, height: 15, color: tab === t.id ? t.accentColor : T3 }} />
              {t.label}
            </button>
          ))}
        </div>
      </header>

      {/* Tab description strip */}
      <div style={{ background: SURF, borderBottom: `1px solid ${BORD}`, padding: "10px 28px" }}>
        <div style={{ maxWidth: 1140, margin: "0 auto", fontSize: 13, color: T3 }}>
          {activeTab.desc}
        </div>
      </div>

      {/* Main content */}
      <main style={{ maxWidth: 1140, margin: "0 auto", padding: "36px 28px" }}>
        {tab === "scan"       && <ScanTab />}
        {tab === "visibility" && <VisibilityTab />}
        {tab === "briefs"     && <BriefsTab />}
        {tab === "gap"        && <GapTab />}
        {tab === "technical"  && <TechnicalTab />}
      </main>
    </div>
  );
}
