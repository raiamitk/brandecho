"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Eye, Sparkles, BarChart2, TrendingUp, Users, MessageSquare,
  Building2, Globe, Download, FileText, Zap, Gauge,
  CheckCircle, XCircle, ChevronDown, ChevronUp, Copy, Check, Bot,
} from "lucide-react";
import type { Brand, Persona, Query, Competitor, Recommendation } from "@/lib/types";

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
type TabId = "scan" | "answers" | "visibility" | "briefs" | "technical";
const TABS: { id: TabId; label: string; Icon: React.ElementType; accentColor: string; desc: string }[] = [
  { id: "scan",       label: "AEO / GEO Scan",     Icon: Zap,       accentColor: A,         desc: "Personas, queries, competitors & smart recommendations from your brand scan" },
  { id: "answers",    label: "AI Answers & Gaps",   Icon: Bot,       accentColor: "#06b6d4", desc: "See what AI assistants say for your queries — brand & competitor mentions highlighted, with gap analysis" },
  { id: "visibility", label: "Query Scores",        Icon: BarChart2, accentColor: A,         desc: "Per-platform citation scores (Gemini · Grok · Claude · ChatGPT) for all 15 queries" },
  { id: "briefs",     label: "Content Briefs",      Icon: Sparkles,  accentColor: "#fbbf24", desc: "AI-optimised content briefs for your top queries — ready to publish" },
  { id: "technical",  label: "Technical Audit",     Icon: Gauge,     accentColor: "#818cf8", desc: "PageSpeed + Core Web Vitals for mobile & desktop — with AEO impact per metric" },
];

// ── API response types ────────────────────────────────────────────────────────
interface ScoreSignal { score: number; note: string; }
interface PlatformScore {
  // kept for estimated "Online Score" card
  platform: string;
  ai_visibility_score: number;
  share_of_voice: number;
  sentiment: "positive" | "neutral" | "negative";
  reasoning: string;
  mentions: number;
  avg_position: number;
  has_citations: boolean;
  insight: string;
  score_breakdown?: {
    brand_authority: ScoreSignal;
    content_signals: ScoreSignal;
    social_proof: ScoreSignal;
    platform_affinity: ScoreSignal;
  };
  sov_formula?: {
    brand_mentions: number;
    total_competitor_mentions: number;
    competitor_breakdown: string;
  };
}

interface VisibilityLog {
  query_id: string; query_text: string; answer: string;
  brand_mentioned: boolean; brand_mention_count: number;
  competitor_mentions: Record<string, number>;
}
interface RealPlatformResult {
  platform: string; available: boolean; reason: string;
  logs: VisibilityLog[];
  appeared_count: number; total_queries: number; visibility_pct: number;
  total_brand_mentions: number; total_competitor_mentions: number;
  competitor_totals: Record<string, number>; sov_pct: number;
}
interface RealVisibilityData {
  brand_name: string; platforms: RealPlatformResult[];
  avg_visibility_pct: number; avg_sov_pct: number;
}

interface VisScore {
  query_id: string; query_text: string; query_type: string;
  revenue_proximity: number;
  claude_score: number; grok_score: number; gemini_score: number; chatgpt_score: number;
  web_score: number; combined_score: number; reason: string;
  live_mentioned: boolean; live_available: boolean; live_excerpt: string;
}
interface VisResult { overall_score: number; live_available: boolean; ai_check_source?: string; results: VisScore[]; }

interface Brief {
  query_id: string; query_text: string; recommended_title: string;
  content_type: string; word_count: number; h2_sections: string[];
  key_points: string[]; citation_hook: string; schema_markup: string; estimated_impact: string;
}

interface GapRow {
  query_id: string; query_text: string; query_type: string;
  brand_appears: boolean; competitors_appear: string[]; gap_type: string; opportunity: string;
}

interface AnswerResult {
  query_id: string; query_text: string; type: string; revenue_proximity: number;
  answer: string; brand_mentioned: boolean; brand_mention_count: number;
  competitors_mentioned: string[]; error: string | null;
}
interface AnswersData {
  brand_name: string; competitor_names: string[]; total_queries: number;
  brand_mentioned_count: number; competitor_only_count: number;
  available: boolean; ai_source?: string; answers: AnswerResult[];
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

function ReRunBar({ label, loading, onClick, accentColor = A }: {
  label: string; loading: boolean; onClick: () => void; accentColor?: string;
}) {
  return (
    <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 4 }}>
      <button onClick={onClick} disabled={loading}
        style={{ display: "inline-flex", alignItems: "center", gap: 6,
          fontSize: 12, fontWeight: 700, color: loading ? T3 : accentColor,
          background: "none", border: `1px solid ${loading ? BORD : accentColor}`,
          borderRadius: 8, padding: "5px 14px", cursor: loading ? "default" : "pointer",
          opacity: loading ? 0.6 : 1, transition: "all 0.15s" }}>
        <span style={{ fontSize: 14, lineHeight: 1 }}>↺</span>
        {loading ? "Running…" : label}
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
  const [answersData,  setAnswersData]  = useState<AnswersData | null>(null);
  const [answersLoading, setAnswersLoading] = useState(false);
  const [answersError, setAnswersError] = useState<string | null>(null);
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

  // Platform visibility (estimated "Online Score")
  const [platformScores,  setPlatformScores]  = useState<PlatformScore[]>([]);
  const [platformLoading, setPlatformLoading] = useState(false);
  const [platformError,   setPlatformError]   = useState<string | null>(null);
  const [platformDone,    setPlatformDone]    = useState(false);

  // Real AI visibility (actual queries → actual answers → real mention counts)
  const [realVisData,    setRealVisData]    = useState<RealVisibilityData | null>(null);
  const [realVisLoading, setRealVisLoading] = useState(false);
  const [realVisError,   setRealVisError]   = useState<string | null>(null);

  // More queries
  const [extraQueries,      setExtraQueries]      = useState<Query[]>([]);
  const [moreQueriesLoading,setMoreQueriesLoading] = useState(false);
  const [funnelFilter,      setFunnelFilter]      = useState<"ALL"|"TOFU"|"MOFU"|"BOFU">("ALL");

  // Competitor management
  const [newCompetitorInput, setNewCompetitorInput] = useState("");
  const [showAddCompetitor,  setShowAddCompetitor]  = useState(false);

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
    try {
      const raw = localStorage.getItem("brandecho_analysis");
      if (raw) {
        const data = JSON.parse(raw);
        if (data.brand)         setBrand({ id: brandId, ...data.brand, name: data.brand_name || sessionStorage.getItem("brand_name") || "" });
        if (data.personas)      setPersonas(data.personas.map((p: Record<string,unknown>, i: number) => ({ id: `p_${i}`, brand_id: brandId, ...p })));
        if (data.queries)       setQueries(data.queries.map((q: Record<string,unknown>) => ({ brand_id: brandId, ...q })));
        if (data.competitors)   setCompetitors(data.competitors.map((c: Record<string,unknown>, i: number) => ({ id: `c_${i}`, brand_id: brandId, ...c })));
        if (data.recommendations) setRecs(data.recommendations.map((r: Record<string,unknown>, i: number) => ({ id: `r_${i}`, brand_id: brandId, ...r })));
      }
    } catch (_) {}
    setCoreLoading(false);
  };

  // ── API runners ─────────────────────────────────────────────────────────────
  const runVisibility = async () => {
    if (!brand || queries.length === 0) return;
    setVisLoading(true);
    try {
      const res = await fetch("/api/visibility", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand_name:  brand.name,
          industry:    brand.industry,
          description: brand.description,
          queries:     queries.map(q => ({ id: q.id, text: q.text, type: q.type, intent: q.intent, revenue_proximity: q.revenue_proximity })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setVisData(data);
    } catch (e) {
      console.error(e);
    } finally {
      setVisLoading(false);
    }
  };

  const runBriefs = async () => {
    if (!brand || queries.length === 0) return;
    setBriefsLoading(true);
    try {
      const res = await fetch("/api/briefs", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand_name: brand.name,
          industry:   brand.industry,
          queries:    queries.map(q => ({ id: q.id, text: q.text, intent: q.intent, type: q.type, revenue_proximity: q.revenue_proximity })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setBriefsData(data.briefs || []);
    } catch (e) {
      console.error(e);
    } finally {
      setBriefsLoading(false);
    }
  };

  const runGap = async () => {
    if (!brand || queries.length === 0) return;
    setGapLoading(true);
    try {
      const res = await fetch("/api/competitors", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand_name:  brand.name,
          description: brand.description,
          competitors: competitors.map(c => ({ name: c.name, type: c.type })),
          queries:     queries.map(q => ({ id: q.id, text: q.text, type: q.type, intent: q.intent })),
        }),
      });
      const data = await res.json();
      setGapData(data.gaps || []);
    } catch (e) { console.error(e); }
    setGapLoading(false);
  };

  const runAnswers = async () => {
    if (!brand || queries.length === 0) return;
    setAnswersLoading(true); setAnswersError(null);
    try {
      const res = await fetch("/api/answers", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand_name:  brand.name,
          competitors: competitors.map(c => c.name),
          queries:     queries.map(q => ({ id: q.id, text: q.text, type: q.type, revenue_proximity: q.revenue_proximity })),
        }),
      });
      const data = await res.json();
      if (data.error && !data.answers) throw new Error(data.error);
      setAnswersData(data);
    } catch (e) { setAnswersError(String(e)); }
    setAnswersLoading(false);
  };

  const runRealVisibility = async () => {
    if (!brand || queries.length === 0) return;
    setRealVisLoading(true); setRealVisError(null);
    try {
      const res = await fetch("/api/ai-visibility-real", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand_name:  brand.name,
          competitors: competitors.map(c => c.name),
          queries:     queries.map(q => ({ id: q.id, text: q.text })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setRealVisData(data);
    } catch (e) { setRealVisError(e instanceof Error ? e.message : "Unknown error"); }
    setRealVisLoading(false);
  };

  const addCompetitor = () => {
    if (!newCompetitorInput.trim() || !brand) return;
    const newC: Competitor = {
      id: `c_manual_${Date.now()}`, brand_id: brand.id || "",
      name: newCompetitorInput.trim(),
      domain: newCompetitorInput.trim().toLowerCase().replace(/\s+/g, "") + ".com",
      type: "direct", aeo_score: 0, seo_score: 0,
      created_at: new Date().toISOString(),
    };
    const updated = [...competitors, newC];
    setCompetitors(updated);
    try {
      const raw = localStorage.getItem("brandecho_analysis");
      if (raw) { const d = JSON.parse(raw); d.competitors = updated.map(c => ({ name: c.name, domain: c.domain, type: c.type, why: "" })); localStorage.setItem("brandecho_analysis", JSON.stringify(d)); }
    } catch { /* ignore */ }
    setNewCompetitorInput(""); setShowAddCompetitor(false);
  };

  const deleteCompetitor = (id: string) => {
    const updated = competitors.filter(c => c.id !== id);
    setCompetitors(updated);
    try {
      const raw = localStorage.getItem("brandecho_analysis");
      if (raw) { const d = JSON.parse(raw); d.competitors = updated.map(c => ({ name: c.name, domain: c.domain, type: c.type, why: "" })); localStorage.setItem("brandecho_analysis", JSON.stringify(d)); }
    } catch { /* ignore */ }
  };

  const deleteQuery = (id: string) => {
    const updated = queries.filter(q => q.id !== id);
    setQueries(updated);
    try {
      const raw = localStorage.getItem("brandecho_analysis");
      if (raw) { const d = JSON.parse(raw); d.queries = updated; localStorage.setItem("brandecho_analysis", JSON.stringify(d)); }
    } catch { /* ignore */ }
  };

  const runMoreQueries = async () => {
    if (!brand) return;
    setMoreQueriesLoading(true);
    try {
      const stored = (() => { try { return JSON.parse(localStorage.getItem("brandecho_analysis") || "{}"); } catch { return {}; } })();
      const res = await fetch("/api/more-queries", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand_name: brand.name, industry: brand.industry,
          existing_texts: [...queries, ...extraQueries].map(q => q.text),
          funnel_filter: funnelFilter,
          country: stored.country || "India", city: stored.city || "",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      const newQs = (data.queries || []).map((q: Record<string,unknown>, i: number) => ({
        id: `extra_${Date.now()}_${i}`, brand_id: brand.id || "", persona_id: "",
        created_at: new Date().toISOString(), citations: [], ...q,
      })) as Query[];
      setExtraQueries(prev => [...prev, ...newQs]);
    } catch (e) { console.error(e); }
    setMoreQueriesLoading(false);
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
    if (!brand?.domain) return;
    setAuthLoading(true); setAuthError(null);
    try {
      const res  = await fetch("/api/authority", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ domain: brand.domain, competitors }) });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setAuthData(data);
    } catch (e) { setAuthError(String(e)); }
    setAuthLoading(false);
  };

  const runPlatformVisibility = async () => {
    if (!brand) return;
    // Run both real queries and estimated online score in parallel
    setPlatformLoading(true); setPlatformError(null);
    const geo = (() => { try { const d = JSON.parse(localStorage.getItem("brandecho_analysis") || "{}"); return { country: d.country || "India", city: d.city || "" }; } catch { return { country: "India", city: "" }; } })();
    try {
      await Promise.all([
        // Real visibility: actually query platforms
        (async () => {
          if (queries.length > 0) await runRealVisibility();
        })(),
        // Estimated online score
        (async () => {
          try {
            const res = await fetch("/api/visibility-platform", {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ brand_name: brand.name, industry: brand.industry, description: brand.description, country: geo.country, city: geo.city }),
            });
            const data = await res.json();
            if (res.ok) { setPlatformScores(data.scores || []); setPlatformDone(true); }
          } catch { /* non-fatal */ }
        })(),
      ]);
    } catch (err) {
      setPlatformError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setPlatformLoading(false);
    }
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
        <tr><th>Query</th><th>Gemini</th><th>Grok</th><th>Claude</th><th>ChatGPT</th><th>Web</th><th>Combined</th></tr>
        ${(visData.results || []).map(s => `<tr>
          <td>${s.query_text}</td>
          <td style="text-align:center">${s.gemini_score}</td>
          <td style="text-align:center">${s.grok_score}</td>
          <td style="text-align:center">${s.claude_score}</td>
          <td style="text-align:center">${s.chatgpt_score}</td>
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

  // ── Brand not found — stale cache or deleted record ────────────────────────
  if (!brand) return (
    <div style={{ minHeight: "100vh", background: BG, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ width: 64, height: 64, borderRadius: 20, background: "rgba(0,255,150,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Building2 style={{ width: 28, height: 28, color: A }} />
      </div>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: T1, margin: 0 }}>Brand data not found</h2>
      <p style={{ fontSize: 14, color: T3, margin: 0, textAlign: "center", maxWidth: 360 }}>
        This brand&apos;s scan data may have expired or been removed. Re-scan to get fresh results.
      </p>
      <button onClick={() => router.push("/")}
        style={{ background: A, color: "#111", fontWeight: 700, padding: "12px 32px",
          borderRadius: 12, border: "none", cursor: "pointer", fontSize: 14,
          display: "inline-flex", alignItems: "center", gap: 8, marginTop: 8 }}>
        ← Re-scan this brand
      </button>
    </div>
  );

  // ── Tab renders ────────────────────────────────────────────────────────────

  // SCAN TAB ─────────────────────────────────────────────────────────────────
  const ScanTab = () => {
    const stored = (() => { try { return JSON.parse(localStorage.getItem("brandecho_analysis") || "{}"); } catch { return {}; } })();
    const geo = [stored.city, stored.country].filter(Boolean).join(", ");
    return (
    <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>

      {/* Brand summary card */}
      {brand && (
        <div style={{ background: SURF, border: `1px solid ${BORD}`, borderRadius: 18, padding: "20px 24px",
          display: "flex", alignItems: "flex-start", gap: 20 }}>
          <div style={{ width: 52, height: 52, borderRadius: 16, background: `${A}18`, border: `1px solid ${A}40`,
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Globe style={{ width: 22, height: 22, color: AT }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <span style={{ fontSize: 17, fontWeight: 800, color: T1 }}>{brand.name}</span>
              {brand.industry && (
                <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 99,
                  background: `${A}20`, color: AT, border: `1px solid ${A}40` }}>{brand.industry}</span>
              )}
              {brand.brand_tone && (
                <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 9px", borderRadius: 99,
                  background: "#f3f4f6", color: T3 }}>{brand.brand_tone}</span>
              )}
            </div>
            {brand.description && (
              <p style={{ fontSize: 13, color: T2, lineHeight: 1.65, margin: 0 }}>{brand.description}</p>
            )}
          </div>
          {geo && (
            <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 5,
              fontSize: 12, color: T3, background: "#f3f4f6", padding: "5px 12px", borderRadius: 99 }}>
              📍 {geo}
            </div>
          )}
        </div>
      )}

      {/* AI Visibility Stats (Platform Tab merged here) */}
      <section>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: T1, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
          <Eye style={{ width: 16, height: 16, color: A }} /> AI Visibility
        </h2>
        <PlatformTab />
      </section>

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
          <div style={{ display: "grid", gridTemplateColumns: "1fr 74px 80px 110px 160px 32px 20px",
            padding: "10px 20px", background: "#f3f4f6",
            fontSize: 11, fontWeight: 700, color: T3, textTransform: "uppercase", letterSpacing: "0.5px" }}>
            <span>Query</span><span>Type</span><span>Funnel</span><span>Intent</span><span>Purchase Stage</span><span /><span />
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
                  style={{ width: "100%", display: "grid", gridTemplateColumns: "1fr 74px 80px 110px 160px 32px 20px",
                    padding: "13px 20px", alignItems: "center", background: "none", border: "none",
                    cursor: "pointer", textAlign: "left", gap: 0 }}>
                  <span style={{ fontSize: 13, color: T1, paddingRight: 16 }}>{q.text}</span>
                  <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 99,
                    fontSize: 11, fontWeight: 600, background: ts.bg, color: ts.color, justifySelf: "start" }}>
                    {q.type === "seo_longtail" ? "SEO" : q.type.toUpperCase()}
                  </span>
                  {(() => {
                    const fs = q.funnel_stage || "";
                    const fStyle = fs === "TOFU" ? { bg: "#dbeafe", color: "#1d4ed8" }
                                 : fs === "MOFU" ? { bg: "#fef3c7", color: "#d97706" }
                                 : fs === "BOFU" ? { bg: "#dcfce7", color: "#15803d" }
                                 : { bg: SURF, color: T3 };
                    return (
                      <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 99,
                        fontSize: 11, fontWeight: 700, background: fStyle.bg, color: fStyle.color, justifySelf: "start" }}>
                        {fs || "—"}
                      </span>
                    );
                  })()}
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
                  <button onClick={e => { e.stopPropagation(); deleteQuery(q.id); }}
                    title="Remove query"
                    style={{ background: "none", border: "none", cursor: "pointer", color: T3, fontSize: 15, lineHeight: 1, padding: "2px 4px", borderRadius: 4 }}>
                    ×
                  </button>
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
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: T1, margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
            <Building2 style={{ width: 16, height: 16, color: A }} /> Competitors
          </h2>
          <button onClick={() => setShowAddCompetitor(v => !v)}
            style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 700, color: A,
              background: "none", border: `1px solid ${A}`, borderRadius: 8, padding: "5px 12px", cursor: "pointer" }}>
            + Add Competitor
          </button>
        </div>
        {showAddCompetitor && (
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            <input
              value={newCompetitorInput}
              onChange={e => setNewCompetitorInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addCompetitor()}
              placeholder="Competitor name (e.g. Hootsuite)"
              style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: `1px solid ${BORD}`, fontSize: 13, outline: "none" }}
            />
            <button onClick={addCompetitor}
              style={{ background: A, color: "#111", fontWeight: 700, padding: "8px 18px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13 }}>
              Add
            </button>
            <button onClick={() => { setShowAddCompetitor(false); setNewCompetitorInput(""); }}
              style={{ background: SURF, color: T3, fontWeight: 600, padding: "8px 14px", borderRadius: 8, border: `1px solid ${BORD}`, cursor: "pointer", fontSize: 13 }}>
              Cancel
            </button>
          </div>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
          {competitors.map(c => (
            <div key={c.id} style={{ background: SURF, border: `1px solid ${BORD}`, borderRadius: 14, padding: 16, display: "flex", alignItems: "center", gap: 12 }}>
              <Globe style={{ width: 16, height: 16, color: A, flexShrink: 0 }} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: T1 }}>{c.name}</div>
                <div style={{ fontSize: 12, color: T3 }}>{c.domain}</div>
                <div style={{ fontSize: 11, marginTop: 2, color: c.type === "direct" ? "#fb923c" : "#a78bfa" }}>
                  {c.type === "direct" ? "Direct Competitor" : "Category Substitute"}
                </div>
              </div>
              <button onClick={() => deleteCompetitor(c.id)}
                title="Remove competitor"
                style={{ background: "none", border: "none", cursor: "pointer", color: T3, fontSize: 16, lineHeight: 1, padding: 4, flexShrink: 0 }}>
                ×
              </button>
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

      {/* Generate more queries */}
      <section>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: T1, margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
            <Zap style={{ width: 16, height: 16, color: A }} /> Generate More Queries
          </h2>
          {(["ALL","TOFU","MOFU","BOFU"] as const).map(f => (
            <button key={f} onClick={() => setFunnelFilter(f)}
              style={{ padding: "4px 14px", borderRadius: 99, fontSize: 12, fontWeight: 700, cursor: "pointer", border: "none",
                background: funnelFilter === f ? (f === "ALL" ? A : f === "TOFU" ? "#dbeafe" : f === "MOFU" ? "#fef3c7" : "#dcfce7") : SURF,
                color: funnelFilter === f ? (f === "ALL" ? "#111" : f === "TOFU" ? "#1d4ed8" : f === "MOFU" ? "#d97706" : "#15803d") : T3,
              }}>
              {f === "ALL" ? "All Funnel" : f}
            </button>
          ))}
          <button onClick={runMoreQueries} disabled={moreQueriesLoading}
            style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6,
              background: A, color: "#111", fontWeight: 700, padding: "8px 20px", borderRadius: 10,
              border: "none", cursor: moreQueriesLoading ? "default" : "pointer", fontSize: 13,
              opacity: moreQueriesLoading ? 0.7 : 1 }}>
            {moreQueriesLoading ? "Generating…" : "+ Generate 10 More Queries"}
          </button>
        </div>
        {extraQueries.length > 0 && (
          <div style={{ border: `1px solid ${BORD}`, borderRadius: 16, overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 74px 80px 110px 160px",
              padding: "10px 20px", background: "#f3f4f6",
              fontSize: 11, fontWeight: 700, color: T3, textTransform: "uppercase", letterSpacing: "0.5px" }}>
              <span>Query</span><span>Type</span><span>Funnel</span><span>Intent</span><span>Stage</span>
            </div>
            {extraQueries.map((q, i) => {
              const ts = TYPE_STYLE[q.type] || TYPE_STYLE.seo;
              const fs = q.funnel_stage || "";
              const fStyle = fs === "TOFU" ? { bg: "#dbeafe", color: "#1d4ed8" } : fs === "MOFU" ? { bg: "#fef3c7", color: "#d97706" } : fs === "BOFU" ? { bg: "#dcfce7", color: "#15803d" } : { bg: SURF, color: T3 };
              const stage = q.revenue_proximity >= 80 ? { label: "Ready to Buy", color: "#15803d", bg: "#f0fdf4" } : q.revenue_proximity >= 60 ? { label: "Evaluating", color: "#1d4ed8", bg: "#eff6ff" } : q.revenue_proximity >= 40 ? { label: "Considering", color: "#d97706", bg: "#fffbeb" } : { label: "Researching", color: "#7c3aed", bg: "#f5f3ff" };
              return (
                <div key={q.id} style={{ display: "grid", gridTemplateColumns: "1fr 74px 80px 110px 160px",
                  padding: "12px 20px", borderTop: `1px solid ${BORD}`, alignItems: "center",
                  background: i % 2 === 1 ? "rgba(0,255,150,0.02)" : BG }}>
                  <span style={{ fontSize: 13, color: T1 }}>{q.text}</span>
                  <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 99, fontSize: 11, fontWeight: 600, background: ts.bg, color: ts.color }}>{q.type === "seo_longtail" ? "SEO" : q.type.toUpperCase()}</span>
                  <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 99, fontSize: 11, fontWeight: 700, background: fStyle.bg, color: fStyle.color }}>{fs || "—"}</span>
                  <span style={{ fontSize: 12, color: T2, textTransform: "capitalize" }}>{q.intent}</span>
                  <span style={{ display: "inline-block", padding: "2px 10px", borderRadius: 99, fontSize: 11, fontWeight: 700, background: stage.bg, color: stage.color }}>{stage.label}</span>
                </div>
              );
            })}
          </div>
        )}
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
  };

  // PLATFORM VISIBILITY TAB ─────────────────────────────────────────────────
  const PlatformTab = () => {
    const [expandedPlatform, setExpandedPlatform] = useState<string | null>(null);
    const [expandedLog,      setExpandedLog]      = useState<string | null>(null);

    // Highlight brand (green) and competitors (red) in any text
    const highlight = (text: string) => {
      if (!text || !brand) return <span style={{ fontSize: 13, color: T2, lineHeight: 1.7 }}>{text}</span>;
      const terms = [brand.name, ...competitors.map(c => c.name)].filter(Boolean);
      if (!terms.length) return <span style={{ fontSize: 13, color: T2, lineHeight: 1.7 }}>{text}</span>;
      const escaped = terms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
      const regex = new RegExp(`(${escaped.join("|")})`, "gi");
      const parts = text.split(regex);
      return (
        <span style={{ fontSize: 13, color: T2, lineHeight: 1.7 }}>
          {parts.map((part, i) => {
            if (part.toLowerCase() === brand.name.toLowerCase())
              return <mark key={i} style={{ background: "#dcfce7", color: "#15803d", fontWeight: 700, borderRadius: 3, padding: "0 2px" }}>{part}</mark>;
            if (competitors.some(c => c.name.toLowerCase() === part.toLowerCase()))
              return <mark key={i} style={{ background: "#fef2f2", color: "#dc2626", fontWeight: 700, borderRadius: 3, padding: "0 2px" }}>{part}</mark>;
            return <span key={i}>{part}</span>;
          })}
        </span>
      );
    };

    const isLoading = platformLoading || realVisLoading;
    const hasData   = realVisData !== null || platformDone;

    if (isLoading && !hasData) return (
      <div style={{ textAlign: "center", padding: "72px 0" }}>
        <Spinner />
        <p style={{ color: T3, marginTop: 16, fontSize: 14 }}>Querying {realVisLoading ? "platforms with all your queries" : "online presence signals"}…</p>
      </div>
    );

    if (!hasData && !platformError && !realVisError) return (
      <RunCTA
        icon={Eye} accentColor="#00FF96"
        title="AI Visibility — Real Calculation"
        desc={`Your ${queries.length} queries will be sent to every available AI platform. We count how many responses actually mention your brand. Visibility = brand_appeared ÷ total_queries. SoV = brand_mentions ÷ (brand + competitor mentions). No guessing.`}
        label="Run AI Visibility Analysis"
        loading={isLoading}
        onClick={runPlatformVisibility}
      />
    );

    if ((platformError || realVisError) && !hasData) return (
      <div style={{ textAlign: "center", padding: "48px 0" }}>
        <div style={{ fontSize: 14, color: "#dc2626", marginBottom: 16 }}>⚠️ {platformError || realVisError}</div>
        <button onClick={runPlatformVisibility} style={{ background: A, color: "#111", fontWeight: 700, padding: "10px 28px", borderRadius: 10, border: "none", cursor: "pointer", fontSize: 13 }}>Retry</button>
      </div>
    );

    const pColor: Record<string, string> = { Gemini: "#1a73e8", Grok: "#7c3aed", Claude: "#7e22ce", ChatGPT: "#10a37f" };
    const pEmoji: Record<string, string> = { Gemini: "🔵", Grok: "🟣", Claude: "🟤", ChatGPT: "🟢" };
    const visPct  = (n: number) => n >= 60 ? "#15803d" : n >= 30 ? "#d97706" : "#dc2626";
    const visBg   = (n: number) => n >= 60 ? "#dcfce7" : n >= 30 ? "#fef3c7" : "#fef2f2";

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <ReRunBar label="Re-run AI Visibility" loading={isLoading} accentColor="#00FF96"
          onClick={() => { setPlatformDone(false); setPlatformScores([]); setRealVisData(null); runPlatformVisibility(); }} />

        {/* Real visibility KPIs */}
        {realVisData && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
            {[
              { label: "Avg AI Visibility", value: `${realVisData.avg_visibility_pct}%`, sub: "queries where brand appeared / total", color: visPct(realVisData.avg_visibility_pct), bg: visBg(realVisData.avg_visibility_pct) },
              { label: "Avg Share of Voice", value: `${realVisData.avg_sov_pct}%`, sub: "brand mentions / (brand + competitor mentions)", color: visPct(realVisData.avg_sov_pct), bg: visBg(realVisData.avg_sov_pct) },
              { label: "Platforms Queried", value: `${realVisData.platforms.filter(p => p.available).length} / 4`, sub: "active platforms with API keys", color: AT, bg: "#f0fdf4" },
            ].map(({ label, value, sub, color, bg }) => (
              <div key={label} style={{ background: bg, border: `1px solid ${color}30`, borderRadius: 16, padding: "20px 24px" }}>
                <div style={{ fontSize: 36, fontWeight: 900, color, lineHeight: 1, marginBottom: 4 }}>{value}</div>
                <div style={{ fontSize: 13, color, fontWeight: 700, marginBottom: 2 }}>{label}</div>
                <div style={{ fontSize: 11, color }}>{sub}</div>
              </div>
            ))}
          </div>
        )}

        {/* Formula box */}
        <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 12, padding: "12px 16px", fontSize: 12, color: "#166534", lineHeight: 1.8 }}>
          <strong>AI Visibility %</strong> = queries where brand name appeared ÷ total queries sent × 100<br />
          <code style={{ background: "#dcfce7", padding: "1px 6px", borderRadius: 4 }}>e.g. 4 of 15 = 27%</code>&nbsp;&nbsp;
          <strong>Share of Voice %</strong> = brand mentions ÷ (brand + all competitor mentions) × 100<br />
          <code style={{ background: "#dcfce7", padding: "1px 6px", borderRadius: 4 }}>e.g. 3 ÷ (3+17) = 15%</code>
          &nbsp;&nbsp;Platforms without API keys show as unavailable. Add <code>GROK_API_KEY</code> for Grok, <code>OPENAI_API_KEY</code> for ChatGPT.
        </div>

        {/* Per-platform cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 16 }}>
          {(realVisData?.platforms || [{ platform: "Claude", available: false, reason: "Loading…", logs: [], appeared_count: 0, total_queries: 0, visibility_pct: 0, total_brand_mentions: 0, total_competitor_mentions: 0, competitor_totals: {}, sov_pct: 0 }]).map(rp => {
            const pc = pColor[rp.platform] || "#6b7280";
            const onlineScore = platformScores.find(s => s.platform === rp.platform);
            const cardOpen = expandedPlatform === rp.platform;
            const logOpen  = expandedLog === rp.platform;

            return (
              <div key={rp.platform} style={{ background: BG, border: `2px solid ${cardOpen || logOpen ? pc : BORD}`, borderRadius: 20, overflow: "hidden" }}>
                {/* Card header */}
                <div style={{ padding: "20px 22px", display: "flex", flexDirection: "column", gap: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: `${pc}15`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>
                      {pEmoji[rp.platform] || "🤖"}
                    </div>
                    <span style={{ fontSize: 17, fontWeight: 800, color: T1 }}>{rp.platform}</span>
                    {!rp.available && (
                      <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 99, background: "#f3f4f6", color: T3 }}>
                        No API key
                      </span>
                    )}
                  </div>

                  {rp.available ? (
                    <>
                      {/* Real visibility + SoV */}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                        <div style={{ background: visBg(rp.visibility_pct), borderRadius: 12, padding: "12px 16px" }}>
                          <div style={{ fontSize: 30, fontWeight: 900, color: visPct(rp.visibility_pct), lineHeight: 1 }}>{rp.visibility_pct}%</div>
                          <div style={{ fontSize: 10, fontWeight: 700, color: visPct(rp.visibility_pct), textTransform: "uppercase", marginTop: 3 }}>AI Visibility</div>
                          <div style={{ fontSize: 11, color: visPct(rp.visibility_pct), marginTop: 2 }}>{rp.appeared_count} of {rp.total_queries} queries</div>
                        </div>
                        <div style={{ background: visBg(rp.sov_pct), borderRadius: 12, padding: "12px 16px" }}>
                          <div style={{ fontSize: 30, fontWeight: 900, color: visPct(rp.sov_pct), lineHeight: 1 }}>{rp.sov_pct}%</div>
                          <div style={{ fontSize: 10, fontWeight: 700, color: visPct(rp.sov_pct), textTransform: "uppercase", marginTop: 3 }}>Share of Voice</div>
                          <div style={{ fontSize: 11, color: visPct(rp.sov_pct), marginTop: 2 }}>{rp.total_brand_mentions} brand vs {rp.total_competitor_mentions} competitor mentions</div>
                        </div>
                      </div>

                      {/* SoV bar */}
                      <div style={{ height: 6, borderRadius: 99, background: BORD, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${rp.sov_pct}%`, background: pc, borderRadius: 99 }} />
                      </div>

                      {/* Competitor breakdown */}
                      {Object.keys(rp.competitor_totals).length > 0 && (
                        <div style={{ fontSize: 11, color: T3 }}>
                          <strong style={{ color: T2 }}>SoV: </strong>
                          {rp.total_brand_mentions} ÷ ({rp.total_brand_mentions} + {rp.total_competitor_mentions}) × 100 = {rp.sov_pct}%
                          <div style={{ marginTop: 3 }}>
                            {Object.entries(rp.competitor_totals).map(([c, n]) => (
                              <span key={c} style={{ marginRight: 6, fontSize: 10, background: "#fef2f2", color: "#dc2626", padding: "1px 6px", borderRadius: 99, fontWeight: 600 }}>{c}: {n}</span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Online Score (estimated) — secondary */}
                      {onlineScore && (
                        <div style={{ background: "#f9fafb", border: `1px solid ${BORD}`, borderRadius: 10, padding: "10px 14px" }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: T3, textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: 6 }}>
                            Online Presence Score (estimated)
                          </div>
                          <button onClick={() => setExpandedPlatform(cardOpen ? null : rp.platform)}
                            style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                            <span style={{ fontSize: 18, fontWeight: 800, color: T1 }}>{onlineScore.ai_visibility_score}/100</span>
                            <span style={{ fontSize: 11, color: T3 }}>
                              {cardOpen ? "▲ hide breakdown" : "▼ show breakdown"}
                            </span>
                          </button>
                          {cardOpen && onlineScore.score_breakdown && (() => {
                            const bd = onlineScore.score_breakdown!;
                            const sigs = [
                              { k: "Brand Authority",   s: bd.brand_authority },
                              { k: "Content Signals",   s: bd.content_signals },
                              { k: "Social Proof",      s: bd.social_proof },
                              { k: "Platform Affinity", s: bd.platform_affinity },
                            ];
                            return (
                              <div style={{ marginTop: 10 }}>
                                <div style={{ fontSize: 10, color: T3, marginBottom: 6 }}>
                                  {sigs.map(x => x.s.score).join(" + ")} = {sigs.reduce((a, x) => a + x.s.score, 0)}/100
                                </div>
                                {sigs.map(({ k, s }) => (
                                  <div key={k} style={{ display: "grid", gridTemplateColumns: "130px 38px 1fr", gap: 8, padding: "5px 0", borderTop: `1px solid ${BORD}` }}>
                                    <span style={{ fontSize: 11, fontWeight: 700, color: T1 }}>{k}</span>
                                    <span style={{ fontSize: 12, fontWeight: 800, color: s.score >= 20 ? "#15803d" : s.score >= 12 ? "#d97706" : "#dc2626" }}>{s.score}/25</span>
                                    <span style={{ fontSize: 10, color: T3 }}>{s.note}</span>
                                  </div>
                                ))}
                                {onlineScore.insight && (
                                  <div style={{ marginTop: 8, fontSize: 11, color: T2, background: `${pc}08`, borderLeft: `3px solid ${pc}`, padding: "6px 10px", borderRadius: 6 }}>
                                    💡 {onlineScore.insight}
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </>
                  ) : (
                    <div style={{ fontSize: 12, color: T3, lineHeight: 1.6 }}>{rp.reason}</div>
                  )}
                </div>

                {/* Query Log toggle */}
                {rp.available && rp.logs.length > 0 && (
                  <>
                    <button onClick={() => setExpandedLog(logOpen ? null : rp.platform)}
                      style={{ width: "100%", padding: "10px 22px", background: `${pc}08`,
                        borderTop: `1px solid ${BORD}`, border: "none", cursor: "pointer",
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        fontSize: 12, fontWeight: 700, color: pc }}>
                      View Query Log ({rp.logs.length} queries)
                      {logOpen ? <ChevronUp style={{ width: 14, height: 14 }} /> : <ChevronDown style={{ width: 14, height: 14 }} />}
                    </button>

                    {logOpen && (
                      <div style={{ borderTop: `1px solid ${BORD}`, maxHeight: 520, overflowY: "auto" }}>
                        {/* Log legend */}
                        <div style={{ padding: "8px 16px", background: "#f9fafb", borderBottom: `1px solid ${BORD}`, display: "flex", gap: 12, fontSize: 11 }}>
                          <span><mark style={{ background: "#dcfce7", color: "#15803d", fontWeight: 700, padding: "0 4px", borderRadius: 3 }}>Brand</mark> = your brand</span>
                          <span><mark style={{ background: "#fef2f2", color: "#dc2626", fontWeight: 700, padding: "0 4px", borderRadius: 3 }}>Competitor</mark> = competitor mention</span>
                        </div>
                        {rp.logs.map((log, li) => (
                          <div key={log.query_id} style={{ padding: "12px 16px", borderTop: li > 0 ? `1px solid ${BORD}` : "none",
                            background: log.brand_mentioned ? "#fafffc" : "#fffafa" }}>
                            <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 6 }}>
                              <span style={{ width: 20, height: 20, borderRadius: 6, background: log.brand_mentioned ? "#dcfce7" : "#fef2f2",
                                color: log.brand_mentioned ? "#15803d" : "#dc2626", fontWeight: 800, fontSize: 11,
                                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                {li + 1}
                              </span>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 12, fontWeight: 700, color: T1, marginBottom: 4 }}>{log.query_text}</div>
                                <div style={{ fontSize: 12 }}>{highlight(log.answer)}</div>
                                {log.brand_mentioned && (
                                  <span style={{ display: "inline-block", marginTop: 5, fontSize: 10, fontWeight: 700, background: "#dcfce7", color: "#15803d", padding: "1px 7px", borderRadius: 99 }}>
                                    ✓ Brand mentioned ×{log.brand_mention_count}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // VISIBILITY TAB ───────────────────────────────────────────────────────────
  const VisibilityTab = () => {
    const [expandedRow, setExpandedRow] = useState<string | null>(null);

    if (!visData) return (
      <RunCTA
        icon={Eye} accentColor={A}
        title="Query Scores — All 4 Platforms"
        desc="Score each query 0–100 for how likely each AI platform (Gemini, Grok, Claude, ChatGPT) is to cite your brand. Scores are estimated by Claude based on your brand, industry, and query type."
        label="Run Query Score Analysis"
        loading={visLoading}
        onClick={runVisibility}
      />
    );
    const scores = visData.results || [];
    const strong = scores.filter(s => s.combined_score >= 70).length;
    const gaps   = scores.filter(s => s.combined_score < 40).length;
    const avgPlatform = scores.length
      ? Math.round(scores.reduce((s, r) => s + (r.claude_score + r.grok_score + r.gemini_score + r.chatgpt_score) / 4, 0) / scores.length)
      : 0;

    const ScoreBar = ({ score }: { score: number }) => (
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <div style={{ flex: 1, height: 5, borderRadius: 99, background: BORD, overflow: "hidden" }}>
          <div style={{ height: "100%", borderRadius: 99, width: `${score}%`,
            background: score >= 70 ? A : score >= 40 ? "#fbbf24" : "#f87171" }} />
        </div>
        <span style={{ fontSize: 12, fontWeight: 700, color: score >= 70 ? "#059669" : score >= 40 ? "#d97706" : "#dc2626", minWidth: 24 }}>{score}</span>
      </div>
    );

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <ReRunBar label="Re-run Query Scores" loading={visLoading} accentColor={A}
          onClick={() => { setVisData(null); runVisibility(); }} />

        {/* KPI cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16 }}>
          {[
            { label: "Overall Score",      value: `${visData.overall_score}/100` },
            { label: "Avg Platform Score", value: `${avgPlatform}/100` },
            { label: "Strong (≥70)",       value: strong },
            { label: "Gap Queries (<40)",  value: gaps },
          ].map(({ label, value }) => (
            <div key={label} style={{ background: SURF, border: `1px solid ${BORD}`, borderRadius: 16, padding: 20 }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: T1, marginBottom: 4 }}>{value}</div>
              <div style={{ fontSize: 13, color: T3 }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Formula explanation */}
        <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 12, padding: "12px 16px",
          fontSize: 12, color: "#166534", lineHeight: 1.7 }}>
          <strong>How scores are calculated:</strong> Claude estimates each platform&apos;s citation probability based on your brand, industry, and query type.
          Combined = Avg(Gemini+Grok+Claude+ChatGPT) × 60% + Web Authority × 20% + Live Check × 20% (if available).
          Scores are predictive, not live data — run AI Answers for live verification.
        </div>

        {/* Live check source */}
        {visData.ai_check_source && visData.ai_check_source !== "none" && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{
              fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 99,
              background: visData.ai_check_source === "gemini" ? "#e0f2fe" : "#f3e8ff",
              color:      visData.ai_check_source === "gemini" ? "#0369a1" : "#7e22ce",
              border:     `1px solid ${visData.ai_check_source === "gemini" ? "#bae6fd" : "#d8b4fe"}`,
            }}>
              {visData.ai_check_source === "gemini" ? "⚡ Live check: Gemini (top 5 queries)" : "🤖 Live check: Claude (top 5 queries)"}
            </span>
          </div>
        )}

        {/* 4-platform scores table */}
        <div style={{ background: SURF, border: `1px solid ${BORD}`, borderRadius: 16, overflow: "hidden" }}>
          {/* Header */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 80px 80px 80px 80px 120px",
            padding: "10px 16px", background: "#f3f4f6",
            fontSize: 10, fontWeight: 700, color: T3, textTransform: "uppercase", letterSpacing: "0.5px", gap: 8 }}>
            <span>Query</span>
            <span style={{ color: "#0369a1" }}>Gemini</span>
            <span style={{ color: "#7c3aed" }}>Grok</span>
            <span style={{ color: "#7e22ce" }}>Claude</span>
            <span style={{ color: "#d97706" }}>ChatGPT</span>
            <span>Web</span>
            <span>Combined</span>
          </div>
          {scores.map((s, i) => {
            const open = expandedRow === s.query_id;
            return (
              <div key={s.query_id} style={{ borderTop: `1px solid ${BORD}`, background: i % 2 === 1 ? "rgba(0,0,0,0.013)" : BG }}>
                {/* Main row */}
                <button onClick={() => setExpandedRow(open ? null : s.query_id)}
                  style={{ width: "100%", display: "grid", gridTemplateColumns: "1fr 80px 80px 80px 80px 80px 120px",
                    padding: "12px 16px", background: "none", border: "none", cursor: "pointer", textAlign: "left",
                    alignItems: "center", gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 13, color: T1, marginBottom: 2, lineHeight: 1.4 }}>{s.query_text}</div>
                    <TypeBadge type={s.query_type} />
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: s.gemini_score >= 70 ? "#059669" : s.gemini_score >= 40 ? "#d97706" : "#dc2626" }}>{s.gemini_score}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: s.grok_score >= 70 ? "#059669" : s.grok_score >= 40 ? "#d97706" : "#dc2626" }}>{s.grok_score}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: s.claude_score >= 70 ? "#059669" : s.claude_score >= 40 ? "#d97706" : "#dc2626" }}>{s.claude_score}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: s.chatgpt_score >= 70 ? "#059669" : s.chatgpt_score >= 40 ? "#d97706" : "#dc2626" }}>{s.chatgpt_score}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: T2 }}>{s.web_score}</span>
                  <ScoreBar score={s.combined_score} />
                </button>

                {/* Expanded: live check + reason */}
                {open && (
                  <div style={{ padding: "0 16px 14px", borderTop: `1px dashed ${BORD}` }}>
                    {s.live_available && (
                      <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: T3 }}>Live check:</span>
                        {s.live_mentioned
                          ? <span style={{ fontSize: 12, fontWeight: 700, color: "#15803d", background: "#dcfce7", padding: "2px 10px", borderRadius: 99 }}>✓ Brand mentioned in AI answer</span>
                          : <span style={{ fontSize: 12, fontWeight: 700, color: "#dc2626", background: "#fef2f2", padding: "2px 10px", borderRadius: 99 }}>✗ Brand absent from AI answer</span>}
                      </div>
                    )}
                    {s.live_excerpt && (
                      <div style={{ marginTop: 8, background: SURF, border: `1px solid ${BORD}`, borderRadius: 8, padding: "8px 12px", fontSize: 12, color: T2 }}>
                        <strong style={{ color: T3, fontSize: 10, textTransform: "uppercase" }}>Excerpt: </strong>{s.live_excerpt}
                      </div>
                    )}
                    {s.reason && (
                      <div style={{ marginTop: 8, background: "#fafafa", border: `1px solid ${BORD}`, borderRadius: 8, padding: "8px 12px", fontSize: 12, color: T2, lineHeight: 1.5 }}>
                        <strong style={{ color: T3, fontSize: 10, textTransform: "uppercase" }}>Why this score: </strong>{s.reason}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
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
        <ReRunBar label="Re-generate Briefs" loading={briefsLoading} accentColor="#fbbf24"
          onClick={() => { setBriefsData([]); runBriefs(); }} />
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
        <ReRunBar label="Re-run Gap Analysis" loading={gapLoading} accentColor="#f87171"
          onClick={() => { setGapData([]); runGap(); }} />
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
                <ReRunBar label="Re-run PageSpeed" loading={psLoading} accentColor="#818cf8"
                  onClick={() => { setPsData(null); setPsError(null); runPageSpeed(); }} />
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
                <ReRunBar label="Re-run Schema Check" loading={schemaLoading} accentColor="#06b6d4"
                  onClick={() => { setSchemaData(null); setSchemaError(null); runSchemaCheck(); }} />
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
                Compare your domain&apos;s PageRank against competitors. Higher authority = more likely to be cited in AI answers.
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
                <ReRunBar label="Re-check Authority" loading={authLoading} accentColor="#f59e0b"
                  onClick={() => { setAuthData(null); setAuthError(null); runAuthorityCheck(); }} />
                {!apiAvail && (
                  <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, padding: "12px 16px", fontSize: 12, color: "#92400e", lineHeight: 1.7 }}>
                    📊 <strong>Live scores unavailable</strong> — scores below are estimates only.<br />
                    To enable real PageRank data: <strong>1)</strong> Register free at{" "}
                    <a href="https://openpagerank.com" target="_blank" rel="noreferrer" style={{ color: "#d97706", fontWeight: 700 }}>openpagerank.com</a>{" "}
                    → copy your API key → <strong>2)</strong> In Vercel dashboard go to <em>Settings → Environment Variables</em> → add{" "}
                    <code style={{ background: "#fef3c7", padding: "1px 5px", borderRadius: 4 }}>OPENPR_API_KEY</code> → <strong>3)</strong> Redeploy.
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


  // ANSWERS TAB ─────────────────────────────────────────────────────────────
  const AnswersTab = () => {
    const [expandedAnswer, setExpandedAnswer] = useState<string | null>(null);
    const GAP_COLOR: Record<string, { bg: string; color: string }> = {
      missing: { bg: "#fef2f2", color: "#dc2626" },
      weak:    { bg: "#fffbeb", color: "#d97706" },
      strong:  { bg: "#f0fdf4", color: "#15803d" },
    };

    // Highlight brand (green) and competitors (red) within answer text
    const HighlightedText = ({ text, brandName, competitorNames }: {
      text: string; brandName: string; competitorNames: string[];
    }) => {
      if (!text) return <span />;
      // Build regex from brand + all competitors
      const terms = [brandName, ...competitorNames].filter(Boolean);
      if (!terms.length) return <span style={{ fontSize: 13, color: T2, lineHeight: 1.7 }}>{text}</span>;
      const escaped = terms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
      const regex = new RegExp(`(${escaped.join("|")})`, "gi");
      const parts = text.split(regex);
      return (
        <span style={{ fontSize: 13, color: T2, lineHeight: 1.7 }}>
          {parts.map((part, i) => {
            if (part.toLowerCase() === brandName.toLowerCase()) {
              return <mark key={i} style={{ background: "#dcfce7", color: "#15803d", fontWeight: 700, borderRadius: 3, padding: "0 2px" }}>{part}</mark>;
            }
            if (competitorNames.some(c => c.toLowerCase() === part.toLowerCase())) {
              return <mark key={i} style={{ background: "#fef2f2", color: "#dc2626", fontWeight: 700, borderRadius: 3, padding: "0 2px" }}>{part}</mark>;
            }
            return <span key={i}>{part}</span>;
          })}
        </span>
      );
    };

    if (!answersData && !answersError) return (
      <RunCTA
        icon={Bot} accentColor="#06b6d4"
        title="AI Answers & Competitor Gaps"
        desc="See what AI assistants say for your target queries — brand mentions highlighted green, competitors in red. Competitor gap analysis runs in parallel to show which queries competitors dominate."
        label="Run AI Answers + Gap Analysis"
        loading={answersLoading || gapLoading}
        onClick={() => { runAnswers(); runGap(); }}
      />
    );

    if (answersError && !answersData) return (
      <div style={{ textAlign: "center", padding: "48px 0" }}>
        <div style={{ fontSize: 14, color: "#dc2626", marginBottom: 16 }}>⚠️ {answersError}</div>
        <button onClick={runAnswers} style={{ background: "#06b6d4", color: "#fff", fontWeight: 700, padding: "10px 28px", borderRadius: 10, border: "none", cursor: "pointer", fontSize: 13 }}>
          Retry
        </button>
      </div>
    );

    if (!answersData) return null;

    const answers = answersData.answers || [];
    const brandCount = answersData.brand_mentioned_count;
    const competitorOnly = answersData.competitor_only_count;
    const total = answersData.total_queries;
    const missedCount = total - brandCount;

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <ReRunBar label="Re-run AI Answers + Gaps" loading={answersLoading || gapLoading} accentColor="#06b6d4"
          onClick={() => { setAnswersData(null); setAnswersError(null); setGapData([]); runAnswers(); runGap(); }} />

        {/* Summary KPI chips */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {[
            { label: "Queries checked",      value: total,          bg: SURF,       color: T1 },
            { label: "Brand appeared",        value: brandCount,     bg: "#f0fdf4",  color: "#15803d" },
            { label: "Brand missing",         value: missedCount,    bg: "#fef2f2",  color: "#dc2626" },
            { label: "Competitor-only gaps",  value: competitorOnly, bg: "#fffbeb",  color: "#d97706" },
          ].map(({ label, value, bg, color }) => (
            <div key={label} style={{ background: bg, border: `1px solid ${color}30`, borderRadius: 14, padding: "14px 20px", minWidth: 140 }}>
              <div style={{ fontSize: 26, fontWeight: 800, color, marginBottom: 2 }}>{value}</div>
              <div style={{ fontSize: 12, color, fontWeight: 600 }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Legend + AI source badge */}
        <div style={{ display: "flex", gap: 16, fontSize: 12, color: T3, alignItems: "center", flexWrap: "wrap" }}>
          {answersData.ai_source && (
            <span style={{
              fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 99,
              background: answersData.ai_source === "gemini" ? "#e0f2fe" : "#f3e8ff",
              color:      answersData.ai_source === "gemini" ? "#0369a1" : "#7e22ce",
              border:     `1px solid ${answersData.ai_source === "gemini" ? "#bae6fd" : "#d8b4fe"}`,
            }}>
              {answersData.ai_source === "gemini" ? "⚡ Powered by Gemini" : "🤖 Powered by Claude (Gemini rate-limited)"}
            </span>
          )}
          <span>Highlight key:</span>
          <span style={{ background: "#dcfce7", color: "#15803d", fontWeight: 700, padding: "2px 8px", borderRadius: 4 }}>{answersData.brand_name}</span>
          <span style={{ fontSize: 11 }}>= brand mention</span>
          <span style={{ background: "#fef2f2", color: "#dc2626", fontWeight: 700, padding: "2px 8px", borderRadius: 4 }}>Competitor</span>
          <span style={{ fontSize: 11 }}>= competitor mention</span>
        </div>

        {/* Answer cards */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {answers.map((a, i) => {
            const open = expandedAnswer === a.query_id;
            const ts = TYPE_STYLE[a.type] || TYPE_STYLE.seo;
            const stage = a.revenue_proximity >= 90 ? { label: "Ready to Buy",  color: "#15803d", bg: "#f0fdf4" }
                        : a.revenue_proximity >= 70 ? { label: "Evaluating",    color: "#1d4ed8", bg: "#eff6ff" }
                        : a.revenue_proximity >= 50 ? { label: "Considering",   color: "#d97706", bg: "#fffbeb" }
                        : a.revenue_proximity >= 20 ? { label: "Researching",   color: "#7c3aed", bg: "#f5f3ff" }
                        :                             { label: "Awareness",     color: T3,        bg: SURF };
            return (
              <div key={a.query_id} style={{
                border: `1px solid ${a.error ? BORD : a.brand_mentioned ? "#bbf7d0" : "#fecaca"}`,
                borderLeft: `4px solid ${a.error ? BORD : a.brand_mentioned ? "#16a34a" : "#dc2626"}`,
                borderRadius: 14, overflow: "hidden",
                background: a.brand_mentioned ? "#fafffc" : "#fffafa",
              }}>
                {/* Card header — always visible */}
                <button onClick={() => setExpandedAnswer(open ? null : a.query_id)}
                  style={{ width: "100%", display: "flex", alignItems: "center", gap: 12,
                    padding: "14px 16px", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}>

                  {/* Query number */}
                  <div style={{ width: 24, height: 24, borderRadius: 8, background: a.brand_mentioned ? "#dcfce7" : "#fef2f2",
                    color: a.brand_mentioned ? "#15803d" : "#dc2626", fontWeight: 800, fontSize: 12,
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {i + 1}
                  </div>

                  {/* Query text */}
                  <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: T1 }}>{a.query_text}</span>

                  {/* Type badge */}
                  <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 99,
                    background: ts.bg, color: ts.color, flexShrink: 0 }}>
                    {a.type === "seo_longtail" ? "SEO" : a.type.toUpperCase()}
                  </span>

                  {/* Purchase stage badge */}
                  <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 99,
                    background: stage.bg, color: stage.color, flexShrink: 0 }}>
                    {stage.label}
                  </span>

                  {/* Brand mention badge */}
                  {!a.error && (
                    a.brand_mentioned
                      ? <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700,
                          padding: "3px 10px", borderRadius: 99, background: "#dcfce7", color: "#15803d", flexShrink: 0 }}>
                          ✓ Brand mentioned {a.brand_mention_count > 1 ? `×${a.brand_mention_count}` : ""}
                        </span>
                      : <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700,
                          padding: "3px 10px", borderRadius: 99, background: "#fef2f2", color: "#dc2626", flexShrink: 0 }}>
                          ✗ Brand absent
                        </span>
                  )}

                  {open
                    ? <ChevronUp  style={{ width: 16, height: 16, color: T3, flexShrink: 0 }} />
                    : <ChevronDown style={{ width: 16, height: 16, color: T3, flexShrink: 0 }} />}
                </button>

                {/* Competitor mentions strip (always visible if any) */}
                {!a.error && a.competitors_mentioned.length > 0 && (
                  <div style={{ padding: "0 16px 10px 52px", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 11, color: T3 }}>Competitors in answer:</span>
                    {a.competitors_mentioned.map((c, ci) => (
                      <span key={ci} style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 99,
                        background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca" }}>{c}</span>
                    ))}
                  </div>
                )}

                {/* Expanded answer text */}
                {open && (
                  <div style={{ padding: "12px 16px 16px", borderTop: `1px dashed ${BORD}` }}>
                    {a.error ? (
                      <div style={{ fontSize: 13, color: "#dc2626", fontStyle: "italic" }}>
                        ⚠️ Could not fetch Gemini answer: {a.error}
                      </div>
                    ) : (
                      <>
                        <div style={{ fontSize: 11, fontWeight: 700, color: T3, textTransform: "uppercase",
                          letterSpacing: "0.5px", marginBottom: 8 }}>
                          🤖 Gemini Answer
                        </div>
                        <div style={{ background: SURF, border: `1px solid ${BORD}`, borderRadius: 10, padding: "14px 16px" }}>
                          <HighlightedText
                            text={a.answer}
                            brandName={answersData.brand_name}
                            competitorNames={answersData.competitor_names}
                          />
                        </div>
                        {!a.brand_mentioned && (
                          <div style={{ marginTop: 10, background: "#fffbeb", border: "1px solid #fde68a",
                            borderRadius: 10, padding: "10px 14px", fontSize: 12, color: "#92400e" }}>
                            💡 <strong>Gap identified:</strong> {answersData.brand_name} wasn't mentioned. Create authoritative content targeting this query to earn AI citations.
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ── Competitor Gap Analysis section ──────────────────────────── */}
        <div style={{ marginTop: 8 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: "#fef2f220",
                border: "1px solid #fecaca", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <TrendingUp style={{ width: 14, height: 14, color: "#dc2626" }} />
              </div>
              <span style={{ fontSize: 15, fontWeight: 700, color: T1 }}>Competitor Gap Analysis</span>
            </div>
            {gapData.length > 0 && (
              <button onClick={() => { setGapData([]); runGap(); }} disabled={gapLoading}
                style={{ fontSize: 12, fontWeight: 700, color: gapLoading ? T3 : "#dc2626",
                  background: "none", border: `1px solid ${gapLoading ? BORD : "#fecaca"}`,
                  borderRadius: 8, padding: "5px 14px", cursor: gapLoading ? "default" : "pointer" }}>
                ↺ {gapLoading ? "Running…" : "Re-run Gaps"}
              </button>
            )}
          </div>

          {gapLoading && !gapData.length && (
            <div style={{ textAlign: "center", padding: "24px 0" }}><Spinner /></div>
          )}

          {gapData.length > 0 && (() => {
            const missingCount = gapData.filter(g => g.gap_type === "missing").length;
            const weakCount    = gapData.filter(g => g.gap_type === "weak").length;
            const strongCount  = gapData.filter(g => g.gap_type === "strong").length;
            return (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {/* Summary chips */}
                <div style={{ display: "flex", gap: 10 }}>
                  {[
                    { label: "Critical Gaps",    value: missingCount, ...GAP_COLOR.missing },
                    { label: "Weak Presence",    value: weakCount,    ...GAP_COLOR.weak    },
                    { label: "Strong Positions", value: strongCount,  ...GAP_COLOR.strong  },
                  ].map(({ label, value, bg, color }) => (
                    <div key={label} style={{ background: bg, border: `1px solid ${color}40`, borderRadius: 12, padding: "10px 18px" }}>
                      <div style={{ fontSize: 20, fontWeight: 800, color }}>{value}</div>
                      <div style={{ fontSize: 11, color, fontWeight: 600 }}>{label}</div>
                    </div>
                  ))}
                </div>

                {/* Gap table */}
                <div style={{ background: SURF, border: `1px solid ${BORD}`, borderRadius: 14, overflow: "hidden" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 70px 160px 90px 1fr",
                    padding: "8px 16px", background: "#f3f4f6",
                    fontSize: 10, fontWeight: 700, color: T3, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    <span>Query</span><span>Brand</span><span>Competitors Seen</span><span>Gap Type</span><span>Opportunity</span>
                  </div>
                  {gapData.map((g, i) => {
                    const gs = GAP_COLOR[g.gap_type] || GAP_COLOR.strong;
                    return (
                      <div key={g.query_id} style={{ display: "grid", gridTemplateColumns: "1fr 70px 160px 90px 1fr",
                        padding: "10px 16px", borderTop: `1px solid ${BORD}`, alignItems: "start",
                        background: i % 2 === 1 ? "rgba(0,0,0,0.015)" : BG }}>
                        <div>
                          <div style={{ fontSize: 12, color: T1, marginBottom: 2 }}>{g.query_text}</div>
                          <TypeBadge type={g.query_type} />
                        </div>
                        <span style={{ fontSize: 16 }}>{g.brand_appears ? "✅" : "❌"}</span>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                          {g.competitors_appear.length
                            ? g.competitors_appear.map((c, ci) => (
                                <span key={ci} style={{ fontSize: 10, background: "#fef2f2", color: "#dc2626",
                                  padding: "2px 7px", borderRadius: 99, fontWeight: 600 }}>{c}</span>
                              ))
                            : <span style={{ fontSize: 12, color: T3 }}>None</span>}
                        </div>
                        <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 99,
                          fontSize: 10, fontWeight: 700, background: gs.bg, color: gs.color, whiteSpace: "nowrap" }}>
                          {g.gap_type}
                        </span>
                        <span style={{ fontSize: 11, color: T2, lineHeight: 1.5 }}>{g.opportunity}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </div>
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
            <button onClick={() => router.push("/")}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px",
                borderRadius: 8, border: `1px solid ${BORD}`, background: SURF, color: T3, fontSize: 13, cursor: "pointer" }}>
              🏠 New Scan
            </button>
            <button onClick={() => router.push("/brands")}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px",
                borderRadius: 8, border: `1px solid ${BORD}`, background: SURF, color: T3, fontSize: 13, cursor: "pointer" }}>
              ← My Brands
            </button>
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
        {tab === "answers"    && <AnswersTab />}
        {tab === "visibility" && <VisibilityTab />}
        {tab === "briefs"     && <BriefsTab />}
        {tab === "technical"  && <TechnicalTab />}
      </main>
    </div>
  );
}
