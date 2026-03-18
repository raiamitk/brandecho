"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Eye, Zap, Globe, Bot, RefreshCw, AlertCircle } from "lucide-react";
import SmartRecommendationsPanel from "@/components/SmartRecommendationsPanel";
import type { Recommendation } from "@/lib/types";
import { supabase } from "@/lib/supabase";

const A    = "#00FF96";
const BG   = "#ffffff";
const SURF = "#f9fafb";
const BORD = "#e5e7eb";

type VisibilityResult = {
  query_id: string; query_text: string; query_type: string;
  revenue_proximity: number; claude_score: number; web_score: number;
  gemini_check: boolean; gemini_score: number; gemini_excerpt: string;
  gemini_available: boolean; combined_score: number; reason: string;
};

function ScoreBadge({ score, size = "sm" }: { score: number; size?: "sm" | "lg" }) {
  const color = score >= 70 ? A : score >= 40 ? "#fbbf24" : "#f87171";
  const fs    = size === "lg" ? "2rem" : "0.75rem";
  const fw    = size === "lg" ? 800 : 600;
  return <span style={{ color, fontSize: fs, fontWeight: fw }}>{score >= 0 ? score : "—"}</span>;
}

function ScoreBar({ value, color = A }: { value: number; color?: string }) {
  return (
    <div style={{ background: "#2a2a2a", borderRadius: 4, height: 6, width: "100%", overflow: "hidden" }}>
      <div style={{ width: `${Math.max(value, 0)}%`, height: "100%", background: color, borderRadius: 4, transition: "width 0.6s ease" }} />
    </div>
  );
}

export default function VisibilityPage() {
  const router = useRouter();
  const [results,    setResults]    = useState<VisibilityResult[]>([]);
  const [recs,       setRecs]       = useState<Recommendation[]>([]);
  const [brandName,  setBrandName]  = useState("");
  const [brandId,    setBrandId]    = useState("");
  const [overall,    setOverall]    = useState(0);
  const [geminiOn,   setGeminiOn]   = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [done,       setDone]       = useState(false);
  const [error,      setError]      = useState("");
  const [filter,     setFilter]     = useState<"all" | "gap" | "strong">("all");

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
      const res  = await fetch("/api/visibility", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ brand_id: brandId }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Analysis failed");
      setResults(data.results);
      setOverall(data.overall_score);
      setGeminiOn(data.gemini_available);
      setDone(true);
    } catch (e) {
      setError(String(e));
    }
    setLoading(false);
  };

  const filtered = results.filter(r => {
    if (filter === "gap")    return r.combined_score < 40;
    if (filter === "strong") return r.combined_score >= 70;
    return true;
  });

  const gaps    = results.filter(r => r.combined_score < 40).length;
  const strong  = results.filter(r => r.combined_score >= 70).length;

  return (
    <div className="min-h-screen flex" style={{ background: BG }}>
      <div className="flex-1 pr-80">

        {/* Nav */}
        <header className="sticky top-0 z-30 backdrop-blur-sm border-b px-6 py-4 flex items-center gap-4"
          style={{ background: "rgba(255,255,255,0.92)", borderColor: BORD }}>
          <button onClick={() => router.push("/dashboard")} className="flex items-center gap-1.5 text-sm transition-colors"
            style={{ color: "#888" }}
            onMouseEnter={e => (e.currentTarget.style.color = "#111")}
            onMouseLeave={e => (e.currentTarget.style.color = "#888")}>
            <ChevronLeft className="w-4 h-4" /> Dashboard
          </button>
          <div className="h-4 w-px" style={{ background: BORD }} />
          <div className="flex items-center gap-2">
            <Eye className="w-5 h-5" style={{ color: A }} />
            <h1 className="font-semibold" style={{ color: "#111827" }}>AI Visibility Checker</h1>
          </div>
          <div className="ml-auto">
            <img src="/logo.svg" alt="BrandEcho" style={{ height: "28px", width: "auto" }} />
          </div>
        </header>

        <main className="px-6 py-8">

          {/* Hero / run panel */}
          {!done && (
            <div className="rounded-2xl border p-10 text-center mb-8" style={{ background: SURF, borderColor: BORD }}>
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5" style={{ background: "rgba(0,255,150,0.1)", border: `1px solid ${A}` }}>
                <Eye className="w-8 h-8" style={{ color: A }} />
              </div>
              <h2 className="text-xl font-bold mb-2">Check AI Visibility for <span style={{ color: A }}>{brandName}</span></h2>
              <p className="text-sm mb-6 max-w-lg mx-auto" style={{ color: "#666" }}>
                We score each of your queries across <strong style={{ color: "#374151" }}>3 signals</strong>: Claude prediction, Gemini live check (free tier), and web authority signals. Combined into a 0–100 visibility score.
              </p>
              <div className="flex items-center justify-center gap-6 mb-8 text-xs" style={{ color: "#555" }}>
                <span className="flex items-center gap-1.5"><Bot className="w-3.5 h-3.5" style={{ color: A }} /> Claude Prediction</span>
                <span className="flex items-center gap-1.5"><Zap className="w-3.5 h-3.5" style={{ color: "#60a5fa" }} /> Gemini Live Check</span>
                <span className="flex items-center gap-1.5"><Globe className="w-3.5 h-3.5" style={{ color: "#fbbf24" }} /> Web Authority</span>
              </div>
              {error && (
                <div className="flex items-center gap-2 text-sm mb-4 p-3 rounded-xl justify-center" style={{ background: "rgba(248,113,113,0.1)", color: "#f87171", border: "1px solid rgba(248,113,113,0.2)" }}>
                  <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
                </div>
              )}
              <button onClick={runAnalysis} disabled={loading}
                className="px-8 py-3 rounded-xl font-semibold text-sm transition-opacity"
                style={{ background: A, color: BG, opacity: loading ? 0.6 : 1 }}>
                {loading ? "Analysing… (~20 sec)" : "Run AI Visibility Analysis"}
              </button>
              <p className="text-xs mt-3" style={{ color: "#444" }}>Uses ~1 Claude API call + up to 5 Gemini free checks</p>
            </div>
          )}

          {/* Results */}
          {done && (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-4 gap-4 mb-6">
                {[
                  { label: "Overall Score",    value: <ScoreBadge score={overall} size="lg" />, sub: overall >= 70 ? "Strong" : overall >= 40 ? "Moderate" : "Needs Work" },
                  { label: "Queries Analysed", value: <span style={{ fontSize: "2rem", fontWeight: 800, color: "#fff" }}>{results.length}</span>, sub: "total queries" },
                  { label: "Gaps Found",        value: <span style={{ fontSize: "2rem", fontWeight: 800, color: "#f87171" }}>{gaps}</span>, sub: "score < 40" },
                  { label: "Strong Positions",  value: <span style={{ fontSize: "2rem", fontWeight: 800, color: A }}>{strong}</span>, sub: "score ≥ 70" },
                ].map((c) => (
                  <div key={c.label} className="rounded-2xl border p-5" style={{ background: SURF, borderColor: BORD }}>
                    <div className="mb-1">{c.value}</div>
                    <div className="text-xs font-medium text-white">{c.label}</div>
                    <div className="text-xs mt-0.5" style={{ color: "#555" }}>{c.sub}</div>
                  </div>
                ))}
              </div>

              {/* Gemini status + filter */}
              <div className="flex items-center gap-3 mb-5">
                <div className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border"
                  style={{ background: geminiOn ? "rgba(0,255,150,0.08)" : "rgba(255,255,255,0.04)", borderColor: geminiOn ? A : BORD, color: geminiOn ? A : "#555" }}>
                  <Zap className="w-3 h-3" /> {geminiOn ? "Gemini live checks active" : "Gemini not configured (add GEMINI_API_KEY)"}
                </div>
                <div className="ml-auto flex gap-2">
                  {(["all", "gap", "strong"] as const).map(f => (
                    <button key={f} onClick={() => setFilter(f)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                      style={{ background: filter === f ? A : SURF, color: filter === f ? BG : "#888", border: `1px solid ${filter === f ? A : BORD}` }}>
                      {f === "all" ? `All (${results.length})` : f === "gap" ? `Gaps (${gaps})` : `Strong (${strong})`}
                    </button>
                  ))}
                </div>
                <button onClick={() => { setDone(false); setResults([]); }}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border"
                  style={{ borderColor: BORD, color: "#555" }}>
                  <RefreshCw className="w-3 h-3" /> Re-run
                </button>
              </div>

              {/* Results table */}
              <div className="rounded-2xl border overflow-hidden" style={{ background: SURF, borderColor: BORD }}>
                <div className="grid px-5 py-3 border-b text-xs font-medium uppercase tracking-wider"
                  style={{ gridTemplateColumns: "1fr 70px 70px 80px 80px 80px", borderColor: BORD, color: "#555" }}>
                  <span>Query</span>
                  <span>Claude</span>
                  <span>Web</span>
                  <span>Gemini</span>
                  <span>Combined</span>
                  <span>Rev %</span>
                </div>
                <div className="divide-y" style={{ borderColor: BORD }}>
                  {filtered.map((r) => (
                    <div key={r.query_id}
                      className="grid px-5 py-4 items-center group transition-colors"
                      style={{ gridTemplateColumns: "1fr 70px 70px 80px 80px 80px" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "rgba(0,0,0,0.03)")}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                      <div>
                        <p className="text-sm mb-1 pr-4">{r.query_text}</p>
                        <p className="text-xs" style={{ color: "#555" }}>{r.reason}</p>
                      </div>
                      <div>
                        <ScoreBadge score={r.claude_score} />
                        <ScoreBar value={r.claude_score} color={A} />
                      </div>
                      <div>
                        <ScoreBadge score={r.web_score} />
                        <ScoreBar value={r.web_score} color="#fbbf24" />
                      </div>
                      <div className="flex items-center gap-1.5">
                        {r.gemini_available ? (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                            style={{ background: r.gemini_check ? "rgba(0,255,150,0.15)" : "rgba(248,113,113,0.1)", color: r.gemini_check ? A : "#f87171" }}>
                            {r.gemini_check ? "✓ Cited" : "✗ Missing"}
                          </span>
                        ) : (
                          <span className="text-xs" style={{ color: "#444" }}>—</span>
                        )}
                      </div>
                      <div>
                        <ScoreBadge score={r.combined_score} />
                        <ScoreBar value={r.combined_score}
                          color={r.combined_score >= 70 ? A : r.combined_score >= 40 ? "#fbbf24" : "#f87171"} />
                      </div>
                      <span className="text-sm font-semibold" style={{ color: A }}>{r.revenue_proximity}</span>
                    </div>
                  ))}
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
