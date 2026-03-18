"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, BarChart2, AlertCircle, RefreshCw, TrendingUp } from "lucide-react";
import SmartRecommendationsPanel from "@/components/SmartRecommendationsPanel";
import type { Recommendation } from "@/lib/types";
import { supabase } from "@/lib/supabase";

const A    = "#00FF96";
const BG   = "#ffffff";
const SURF = "#f9fafb";
const BORD = "#e5e7eb";

type GapRow = {
  query_id: string; query_text: string; query_type: string;
  brand_appears: boolean; competitors_appear: string[]; gap_type: "missing" | "weak" | "strong";
  opportunity: string;
};

const GAP_STYLE = {
  strong:  { bg: "rgba(0,255,150,0.12)",  color: A,         border: "rgba(0,255,150,0.3)",  label: "Strong" },
  weak:    { bg: "rgba(251,191,36,0.10)", color: "#fbbf24", border: "rgba(251,191,36,0.3)",  label: "Weak" },
  missing: { bg: "rgba(248,113,113,0.10)",color: "#f87171", border: "rgba(248,113,113,0.3)", label: "Gap" },
};

export default function CompetitorsPage() {
  const router = useRouter();
  const [gaps,       setGaps]       = useState<GapRow[]>([]);
  const [competitors,setCompetitors]= useState<string[]>([]);
  const [recs,       setRecs]       = useState<Recommendation[]>([]);
  const [brandName,  setBrandName]  = useState("");
  const [brandId,    setBrandId]    = useState("");
  const [loading,    setLoading]    = useState(false);
  const [done,       setDone]       = useState(false);
  const [error,      setError]      = useState("");
  const [filterGap,  setFilterGap]  = useState<"all" | "missing" | "weak" | "strong">("all");

  useEffect(() => {
    const id   = sessionStorage.getItem("brand_id")   || "";
    const name = sessionStorage.getItem("brand_name") || "";
    if (!id) { router.push("/"); return; }
    setBrandId(id);
    setBrandName(name);
    supabase.from("recommendations").select("*").eq("brand_id", id).then(r => setRecs(r.data || []));
  }, []);

  const runAnalysis = async () => {
    setLoading(true);
    setError("");
    try {
      const res  = await fetch("/api/competitors", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ brand_id: brandId }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Analysis failed");
      setGaps(data.gaps);
      setCompetitors(data.competitors);
      setDone(true);
    } catch (e) {
      setError(String(e));
    }
    setLoading(false);
  };

  const filtered = gaps.filter(g => filterGap === "all" || g.gap_type === filterGap);
  const missingCount = gaps.filter(g => g.gap_type === "missing").length;
  const weakCount    = gaps.filter(g => g.gap_type === "weak").length;
  const strongCount  = gaps.filter(g => g.gap_type === "strong").length;

  return (
    <div className="min-h-screen flex" style={{ background: BG }}>
      <div className="flex-1 pr-80">

        {/* Nav */}
        <header className="sticky top-0 z-30 backdrop-blur-sm border-b px-6 py-4 flex items-center gap-4"
          style={{ background: "rgba(255,255,255,0.92)", borderColor: BORD }}>
          <button onClick={() => router.push("/dashboard")} className="flex items-center gap-1.5 text-sm"
            style={{ color: "#888" }}
            onMouseEnter={e => (e.currentTarget.style.color = "#fff")}
            onMouseLeave={e => (e.currentTarget.style.color = "#888")}>
            <ChevronLeft className="w-4 h-4" /> Dashboard
          </button>
          <div className="h-4 w-px" style={{ background: BORD }} />
          <div className="flex items-center gap-2">
            <BarChart2 className="w-5 h-5" style={{ color: A }} />
            <h1 className="font-semibold" style={{ color: "#111827" }} className="">Competitor Gap Analysis</h1>
          </div>
          <div className="ml-auto">
            <img src="/logo.svg" alt="BrandEcho" style={{ height: "28px", width: "auto" }} />
          </div>
        </header>

        <main className="px-6 py-8">

          {/* Intro */}
          {!done && (
            <div className="rounded-2xl border p-10 text-center mb-8" style={{ background: SURF, borderColor: BORD }}>
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
                style={{ background: "rgba(0,255,150,0.1)", border: `1px solid ${A}` }}>
                <BarChart2 className="w-8 h-8" style={{ color: A }} />
              </div>
              <h2 className="text-xl font-bold mb-2">Competitor Gap Analysis for <span style={{ color: A }}>{brandName}</span></h2>
              <p className="text-sm mb-6 max-w-lg mx-auto" style={{ color: "#666" }}>
                For each query, we check whether <strong style={{ color: "#ccc" }}>your brand</strong> or your <strong style={{ color: "#ccc" }}>competitors</strong> are likely mentioned by AI engines — and show you exactly where to close the gap.
              </p>
              {error && (
                <div className="flex items-center gap-2 text-sm mb-4 p-3 rounded-xl justify-center"
                  style={{ background: "rgba(248,113,113,0.1)", color: "#f87171", border: "1px solid rgba(248,113,113,0.2)" }}>
                  <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
                </div>
              )}
              <button onClick={runAnalysis} disabled={loading}
                className="px-8 py-3 rounded-xl font-semibold text-sm"
                style={{ background: A, color: BG, opacity: loading ? 0.6 : 1 }}>
                {loading ? "Analysing… (~20 sec)" : "Run Gap Analysis"}
              </button>
              <p className="text-xs mt-3" style={{ color: "#444" }}>Uses 1 Claude API call · No Gemini required</p>
            </div>
          )}

          {/* Results */}
          {done && (
            <>
              {/* Summary */}
              <div className="grid grid-cols-4 gap-4 mb-6">
                {[
                  { label: "Total Queries",    value: gaps.length,    color: "#fff" },
                  { label: "Gaps to Fix",       value: missingCount,   color: "#f87171" },
                  { label: "Weak Positions",    value: weakCount,      color: "#fbbf24" },
                  { label: "Strong Positions",  value: strongCount,    color: A },
                ].map(c => (
                  <div key={c.label} className="rounded-2xl border p-5" style={{ background: SURF, borderColor: BORD }}>
                    <div className="text-3xl font-extrabold mb-1" style={{ color: c.color }}>{c.value}</div>
                    <div className="text-xs font-medium">{c.label}</div>
                  </div>
                ))}
              </div>

              {/* Competitor tags */}
              {competitors.length > 0 && (
                <div className="flex items-center gap-2 mb-5 flex-wrap">
                  <span className="text-xs" style={{ color: "#555" }}>Competitors analysed:</span>
                  {competitors.map(c => (
                    <span key={c} className="text-xs px-2.5 py-1 rounded-full border" style={{ borderColor: BORD, color: "#888", background: SURF }}>{c}</span>
                  ))}
                </div>
              )}

              {/* Filters + refresh */}
              <div className="flex items-center gap-2 mb-5">
                {(["all", "missing", "weak", "strong"] as const).map(f => {
                  const counts = { all: gaps.length, missing: missingCount, weak: weakCount, strong: strongCount };
                  const colors = { all: A, missing: "#f87171", weak: "#fbbf24", strong: A };
                  return (
                    <button key={f} onClick={() => setFilterGap(f)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize"
                      style={{ background: filterGap === f ? (colors[f]) : SURF, color: filterGap === f ? BG : "#888", border: `1px solid ${filterGap === f ? colors[f] : BORD}` }}>
                      {f} ({counts[f]})
                    </button>
                  );
                })}
                <button onClick={() => { setDone(false); setGaps([]); }} className="ml-auto flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border" style={{ borderColor: BORD, color: "#555" }}>
                  <RefreshCw className="w-3 h-3" /> Re-run
                </button>
              </div>

              {/* Heatmap / gap table */}
              <div className="rounded-2xl border overflow-hidden" style={{ background: SURF, borderColor: BORD }}>
                <div className="grid px-5 py-3 border-b text-xs font-medium uppercase tracking-wider"
                  style={{ gridTemplateColumns: "1fr 100px 160px 80px", borderColor: BORD, color: "#555" }}>
                  <span>Query</span>
                  <span>Your Brand</span>
                  <span>Competitors</span>
                  <span>Status</span>
                </div>
                <div className="divide-y" style={{ borderColor: BORD }}>
                  {filtered.map(g => {
                    const st = GAP_STYLE[g.gap_type];
                    return (
                      <div key={g.query_id} className="px-5 py-4 grid gap-4 items-start"
                        style={{ gridTemplateColumns: "1fr 100px 160px 80px" }}
                        onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.025)")}
                        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                        <div>
                          <p className="text-sm mb-1">{g.query_text}</p>
                          <p className="text-xs" style={{ color: "#555" }}>
                            <TrendingUp className="w-3 h-3 inline mr-1" style={{ color: A }} />
                            {g.opportunity}
                          </p>
                        </div>
                        <div>
                          <span className="text-xs font-semibold px-2 py-1 rounded-full"
                            style={{ background: g.brand_appears ? "rgba(0,255,150,0.12)" : "rgba(248,113,113,0.1)", color: g.brand_appears ? A : "#f87171" }}>
                            {g.brand_appears ? "✓ Appears" : "✗ Missing"}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {g.competitors_appear?.length > 0 ? g.competitors_appear.map(c => (
                            <span key={c} className="text-xs px-2 py-0.5 rounded-full border"
                              style={{ background: "rgba(248,113,113,0.08)", color: "#f87171", borderColor: "rgba(248,113,113,0.2)" }}>
                              {c}
                            </span>
                          )) : (
                            <span className="text-xs" style={{ color: "#444" }}>None</span>
                          )}
                        </div>
                        <div>
                          <span className="text-xs font-semibold px-2 py-1 rounded-full border" style={{ background: st.bg, color: st.color, borderColor: st.border }}>
                            {st.label}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </main>
      </div>

      <SmartRecommendationsPanel recommendations={recs} brandName={brandName} />
    </div>
  );
}
