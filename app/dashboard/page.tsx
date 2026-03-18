"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TrendingUp, Users, MessageSquare, Building2, ArrowRight, Globe, Bot, Download, FileText, Eye, BarChart2, Sparkles } from "lucide-react";
import SmartRecommendationsPanel from "@/components/SmartRecommendationsPanel";
import type { Brand, Persona, Query, Competitor, Recommendation } from "@/lib/types";
import { supabase } from "@/lib/supabase";

const A = "#00FF96";
const BG = "#141414";
const SURF = "#f9fafb";
const BORD = "#e5e7eb";

export default function DashboardPage() {
  const router = useRouter();
  const [brand,       setBrand]       = useState<Brand | null>(null);
  const [personas,    setPersonas]    = useState<Persona[]>([]);
  const [queries,     setQueries]     = useState<Query[]>([]);
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [recs,        setRecs]        = useState<Recommendation[]>([]);
  const [loading,     setLoading]     = useState(true);

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
    setLoading(false);
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: BG }}>
      <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: A, borderTopColor: "transparent" }} />
    </div>
  );

  const highRevQueries = queries.filter(q => q.revenue_proximity >= 70);

  // ── CSV Download ──────────────────────────────────────────────────────────
  const downloadCSV = () => {
    const rows = [
      ["BrandEcho Report —", brand?.name || "", "", ""],
      [""], ["QUERIES", "", "", ""],
      ["Query", "Type", "Intent", "Revenue Proximity (%)"],
      ...queries.map(q => [q.text, q.type, q.intent, q.revenue_proximity]),
      [""], ["COMPETITORS", "", "", ""],
      ["Competitor", "Domain", "Type", ""],
      ...competitors.map(c => [c.name, c.domain, c.type, ""]),
      [""], ["RECOMMENDATIONS", "", "", ""],
      ["Title", "Category", "Priority", "Projected Lift"],
      ...recs.map(r => [r.title, r.category, r.priority, r.projected_lift]),
    ];
    const csv  = rows.map(r => r.map(String).map(v => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = `${brand?.name || "brandecho"}-report.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  // ── PDF Download (browser print — zero API tokens) ───────────────────────
  const downloadPDF = () => {
    const personasHTML = personas.map(p => `
      <div class="persona-card">
        <div class="persona-header">
          <span class="persona-initial">${p.name.charAt(0)}</span>
          <div>
            <strong style="font-size:14px">${p.name}</strong>
            <span class="meta">${p.age_range || ""} · ${p.archetype || ""} · ${p.occupation || ""}</span>
          </div>
        </div>
        <div class="two-col">
          <div>
            <div class="label">Pain Points</div>
            <ul>${(p.pain_points || []).map((pt: string) => `<li>${pt}</li>`).join("")}</ul>
          </div>
          <div>
            <div class="label">Goals</div>
            <ul>${(p.goals || []).map((g: string) => `<li>${g}</li>`).join("")}</ul>
          </div>
        </div>
        <div class="label" style="margin-top:8px">AI Tools Used</div>
        <p style="margin:2px 0 6px">${(p.ai_tools_used || []).join(", ") || "—"}</p>
        <div class="label">Query Style</div>
        <p style="margin:2px 0">${p.query_style || "—"}</p>
      </div>`).join("");

    const recsHTML = recs.map((r, i) => `
      <div class="rec-card p-${r.priority}">
        <div style="display:flex;gap:10px;align-items:flex-start;margin-bottom:6px">
          <span class="num">${i + 1}</span>
          <div style="flex:1">
            <strong>${r.title}</strong>
            <span style="display:block;font-size:11px;color:#6b7280;margin-top:2px">
              ${r.category.toUpperCase()} · <span class="${r.priority}">${r.priority} priority</span> · <strong style="color:#059669">${r.projected_lift}</strong>
            </span>
          </div>
        </div>
        <p style="margin:0 0 8px;color:#374151;font-size:12px">${r.description}</p>
        <span class="action">${r.action_label}</span>
      </div>`).join("");

    const content = `<html><head><title>BrandEcho — ${brand?.name}</title>
    <style>
      *{box-sizing:border-box}
      body{font-family:-apple-system,Arial,sans-serif;padding:40px;color:#111;font-size:13px;line-height:1.6}
      h1{font-size:28px;font-weight:800;margin:0 0 4px}
      .sub{color:#6b7280;font-size:13px;padding-bottom:14px;border-bottom:3px solid #00FF96;margin-bottom:24px}
      .brand-desc{color:#374151;margin-bottom:28px;font-size:13px;padding:12px;background:#f0fdf4;border-radius:8px}
      h2{font-size:14px;font-weight:700;margin:28px 0 12px;padding:7px 12px;background:#f0fdf4;border-left:4px solid #00FF96;color:#111}
      table{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:8px}
      th{background:#111;color:#fff;padding:8px 10px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.5px}
      td{padding:8px 10px;border-bottom:1px solid #e5e7eb;vertical-align:top}
      tr:nth-child(even) td{background:#fafafa}
      .badge{display:inline-block;padding:2px 7px;border-radius:99px;font-size:11px;font-weight:600}
      .aeo{background:#ede9fe;color:#6d28d9}.geo{background:#dcfce7;color:#15803d}
      .seo,.seo_longtail{background:#dbeafe;color:#1d4ed8}
      .high{color:#dc2626;font-weight:700}.medium{color:#d97706;font-weight:600}.low{color:#15803d}
      .persona-card{border:1px solid #e5e7eb;border-radius:10px;padding:14px;margin-bottom:12px;background:#fafafa}
      .persona-header{display:flex;align-items:center;gap:12px;margin-bottom:10px}
      .persona-initial{width:38px;height:38px;border-radius:10px;background:#00FF96;color:#111;font-weight:800;display:flex;align-items:center;justify-content:center;font-size:17px;flex-shrink:0}
      .two-col{display:grid;grid-template-columns:1fr 1fr;gap:12px}
      .meta{display:block;color:#6b7280;font-size:11px;margin-top:2px}
      .label{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#059669;margin:4px 0 2px}
      ul{margin:0;padding-left:16px} li{margin-bottom:3px;color:#374151}
      .rec-card{border:1px solid #e5e7eb;border-radius:10px;padding:14px;margin-bottom:10px}
      .p-high{border-left:4px solid #dc2626}.p-medium{border-left:4px solid #d97706}.p-low{border-left:4px solid #15803d}
      .num{width:28px;height:28px;border-radius:8px;background:#00FF96;color:#111;font-weight:800;display:flex;align-items:center;justify-content:center;font-size:13px;flex-shrink:0}
      .action{display:inline-block;background:#f0fdf4;border:1px solid #bbf7d0;color:#15803d;padding:3px 10px;border-radius:99px;font-size:11px;font-weight:600}
      footer{margin-top:40px;padding-top:14px;border-top:1px solid #e5e7eb;font-size:11px;color:#aaa;text-align:center}
      @media print{body{padding:20px}}
    </style></head><body>

    <h1>BrandEcho Report — ${brand?.name}</h1>
    <div class="sub">Industry: ${brand?.industry} &nbsp;·&nbsp; Domain: ${brand?.domain} &nbsp;·&nbsp; Generated: ${new Date().toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"})}</div>
    <div class="brand-desc">${brand?.description || ""}</div>

    <h2>👤 User Personas (${personas.length})</h2>
    ${personasHTML}

    <h2>🔍 Queries (${queries.length} total)</h2>
    <table>
      <tr><th>Query</th><th style="width:70px">Type</th><th style="width:110px">Intent</th><th style="width:80px">Revenue %</th></tr>
      ${queries.map(q => `<tr>
        <td>${q.text}</td>
        <td><span class="badge ${q.type}">${q.type==="seo_longtail"?"SEO":q.type.toUpperCase()}</span></td>
        <td style="text-transform:capitalize">${q.intent}</td>
        <td style="font-weight:700;color:#059669">${q.revenue_proximity}%</td>
      </tr>`).join("")}
    </table>

    <h2>🏢 Competitors (${competitors.length} found)</h2>
    <table>
      <tr><th>Name</th><th>Domain</th><th style="width:140px">Type</th><th>Why Relevant</th></tr>
      ${competitors.map(c => `<tr>
        <td style="font-weight:600">${c.name}</td>
        <td style="color:#6b7280">${c.domain}</td>
        <td>${c.type==="direct"?"Direct Competitor":"Category Substitute"}</td>
        <td style="color:#6b7280">${c.why||""}</td>
      </tr>`).join("")}
    </table>

    <h2>💡 Smart Recommendations (${recs.length})</h2>
    ${recsHTML}

    <footer>Generated by BrandEcho &nbsp;·&nbsp; Powered by Claude AI &nbsp;·&nbsp; ${new Date().toLocaleString()}</footer>
    </body></html>`;

    const w = window.open("", "_blank")!;
    w.document.write(content);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); }, 600);
  };

  return (
    <div className="min-h-screen flex" style={{ background: BG }}>
      <div className="flex-1 pr-80">

        {/* Header */}
        <header className="sticky top-0 z-30 backdrop-blur-sm border-b px-6 py-4 flex items-center justify-between"
          style={{ background: "rgba(255,255,255,0.92)", borderColor: BORD }}>
          <div className="flex items-center gap-4">
            <img src="/logo.svg" alt="BrandEcho" style={{ height: "30px", width: "auto" }} />
            <div className="h-5 w-px" style={{ background: BORD }} />
            <div>
              <span className="text-gray-900 font-semibold">{brand?.name}</span>
              <span className="text-sm ml-2" style={{ color: "#555" }}>{brand?.industry}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={downloadCSV}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors border"
              style={{ borderColor: BORD, color: "#555", background: SURF }}
              onMouseEnter={e => (e.currentTarget.style.color = "#111")}
              onMouseLeave={e => (e.currentTarget.style.color = "#555")}>
              <Download className="w-4 h-4" /> CSV
            </button>
            <button onClick={downloadPDF}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-bold transition-all"
              style={{ background: A, color: BG }}
              onMouseEnter={e => (e.currentTarget.style.background = "#00cc78")}
              onMouseLeave={e => (e.currentTarget.style.background = A)}>
              <FileText className="w-4 h-4" /> Download PDF
            </button>
            <nav className="flex items-center gap-1 ml-2">
              {[{ label: "Overview", href: "/dashboard" }, { label: "Personas", href: "/personas" }, { label: "Queries", href: "/queries" }]
                .map(({ label, href }) => (
                  <button key={href} onClick={() => router.push(href)}
                    className="px-4 py-2 rounded-lg text-sm transition-colors"
                    style={{ background: href === "/dashboard" ? A : "transparent", color: href === "/dashboard" ? BG : "#888" }}>
                    {label}
                  </button>
                ))}
            </nav>
          </div>
        </header>

        <main className="px-6 py-8 space-y-8 animate-fade-in">

          {/* KPI cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Total Queries",        value: queries.length,        icon: MessageSquare },
              { label: "AI Engine Coverage",   value: "8",                   icon: Bot },
              { label: "Competitors Found",    value: competitors.length,    icon: Building2 },
              { label: "High-Revenue Queries", value: highRevQueries.length, icon: TrendingUp },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="rounded-2xl p-5 card-lift border" style={{ background: SURF, borderColor: BORD }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: "rgba(0,255,150,0.1)" }}>
                  <Icon className="w-5 h-5" style={{ color: A }} />
                </div>
                <div className="text-3xl font-bold text-gray-900 mb-1">{value}</div>
                <div className="text-sm text-gray-500">{label}</div>
              </div>
            ))}
          </div>

          {/* Personas */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                <Users className="w-4 h-4" style={{ color: A }} /> Personas
              </h2>
              <button onClick={() => router.push("/personas")} className="text-sm flex items-center gap-1" style={{ color: A }}>
                View all <ArrowRight className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {personas.slice(0, 3).map(p => (
                <div key={p.id} className="rounded-2xl p-5 card-lift border" style={{ background: SURF, borderColor: BORD }}>
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-black font-bold text-lg mb-3" style={{ background: A }}>
                    {p.name.charAt(0)}
                  </div>
                  <h3 className="font-semibold text-gray-900 text-sm mb-1">{p.name}</h3>
                  <p className="text-xs text-gray-500 mb-3">{p.age_range} · {p.archetype}</p>
                  {p.pain_points?.slice(0, 2).map((pt, j) => (
                    <p key={j} className="text-xs text-gray-500">• {pt}</p>
                  ))}
                </div>
              ))}
            </div>
          </section>

          {/* Competitors */}
          <section>
            <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2 mb-4">
              <Building2 className="w-4 h-4" style={{ color: A }} /> Competitors
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {competitors.map(c => (
                <div key={c.id} className="rounded-xl p-4 card-lift flex items-center gap-3 border" style={{ background: SURF, borderColor: BORD }}>
                  <Globe className="w-4 h-4 flex-shrink-0" style={{ color: A }} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{c.name}</p>
                    <p className="text-xs text-gray-400 truncate">{c.domain}</p>
                    <span className="text-xs" style={{ color: c.type === "direct" ? "#fb923c" : "#a78bfa" }}>
                      {c.type === "direct" ? "Direct" : "Substitute"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Queries preview */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                <MessageSquare className="w-4 h-4" style={{ color: A }} /> Query Preview
              </h2>
              <button onClick={() => router.push("/queries")} className="text-sm flex items-center gap-1" style={{ color: A }}>
                View all {queries.length} <ArrowRight className="w-4 h-4" />
              </button>
            </div>
            <div className="rounded-2xl overflow-hidden border" style={{ background: SURF, borderColor: BORD }}>
              {queries.slice(0, 5).map(q => (
                <div key={q.id} className="px-5 py-3 flex items-center gap-4 border-b" style={{ borderColor: BORD }}>
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0"
                    style={{ background: "rgba(0,255,150,0.1)", color: A }}>
                    {q.type === "seo_longtail" ? "SEO" : q.type.toUpperCase()}
                  </span>
                  <p className="text-sm text-gray-700 flex-1 truncate">{q.text}</p>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <div className="h-1.5 w-14 rounded-full overflow-hidden" style={{ background: BORD }}>
                      <div className="h-full rounded-full" style={{ width: `${q.revenue_proximity}%`, background: A }} />
                    </div>
                    <span className="text-xs text-gray-400">{q.revenue_proximity}%</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ── Phase 2 Feature Cards ─────────────────────────────────────── */}
          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" style={{ color: A }} /> Advanced Intelligence
            </h2>
            <div className="grid grid-cols-3 gap-4">

              {/* AI Visibility Checker */}
              <button onClick={() => router.push("/visibility")}
                className="rounded-2xl border p-6 text-left group transition-all hover:scale-[1.02]"
                style={{ background: SURF, borderColor: BORD }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = A; e.currentTarget.style.background = "rgba(0,255,150,0.05)"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = BORD; e.currentTarget.style.background = SURF; }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ background: "rgba(0,255,150,0.1)" }}>
                  <Eye className="w-5 h-5" style={{ color: A }} />
                </div>
                <h3 className="font-semibold text-gray-900 text-sm mb-2">AI Visibility Checker</h3>
                <p className="text-xs leading-relaxed" style={{ color: "#666" }}>
                  Score each query 0–100 for AI citability. Claude prediction + Gemini live check + web authority signals.
                </p>
                <div className="flex items-center gap-1.5 mt-4 text-xs font-medium" style={{ color: A }}>
                  Run analysis <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </button>

              {/* Content Brief Generator */}
              <button onClick={() => router.push("/briefs")}
                className="rounded-2xl border p-6 text-left group transition-all hover:scale-[1.02]"
                style={{ background: SURF, borderColor: BORD }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "#fbbf24"; e.currentTarget.style.background = "rgba(251,191,36,0.04)"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = BORD; e.currentTarget.style.background = SURF; }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ background: "rgba(251,191,36,0.1)" }}>
                  <Sparkles className="w-5 h-5" style={{ color: "#fbbf24" }} />
                </div>
                <h3 className="font-semibold text-gray-900 text-sm mb-2">Content Brief Generator</h3>
                <p className="text-xs leading-relaxed" style={{ color: "#666" }}>
                  Auto-generate structured briefs for top 5 revenue queries — titles, H2s, key points, and AI citation hooks.
                </p>
                <div className="flex items-center gap-1.5 mt-4 text-xs font-medium" style={{ color: "#fbbf24" }}>
                  Generate briefs <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </button>

              {/* Competitor Gap Analysis */}
              <button onClick={() => router.push("/competitors")}
                className="rounded-2xl border p-6 text-left group transition-all hover:scale-[1.02]"
                style={{ background: SURF, borderColor: BORD }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "#f87171"; e.currentTarget.style.background = "rgba(248,113,113,0.04)"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = BORD; e.currentTarget.style.background = SURF; }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ background: "rgba(248,113,113,0.1)" }}>
                  <BarChart2 className="w-5 h-5" style={{ color: "#f87171" }} />
                </div>
                <h3 className="font-semibold text-gray-900 text-sm mb-2">Competitor Gap Analysis</h3>
                <p className="text-xs leading-relaxed" style={{ color: "#666" }}>
                  Visual heatmap showing which queries competitors appear in that you don't — with specific fixes.
                </p>
                <div className="flex items-center gap-1.5 mt-4 text-xs font-medium" style={{ color: "#f87171" }}>
                  View gaps <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </button>

            </div>
          </section>
        </main>
      </div>

      <SmartRecommendationsPanel recommendations={recs} brandName={brand?.name || ""} />
    </div>
  );
}
