"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, FileText, ChevronDown, ChevronUp, Copy, Check, Sparkles, AlertCircle } from "lucide-react";
import SmartRecommendationsPanel from "@/components/SmartRecommendationsPanel";
import type { Recommendation } from "@/lib/types";
import { supabase } from "@/lib/supabase";

const A    = "#00FF96";
const BG   = "#ffffff";
const SURF = "#f9fafb";
const BORD = "#e5e7eb";

type Brief = {
  query_id: string; query_text: string; recommended_title: string;
  content_type: string; word_count: number; h2_sections: string[];
  key_points: string[]; citation_hook: string; schema_markup: string;
  estimated_impact: "high" | "medium" | "low";
};

const IMPACT_STYLE: Record<string, { bg: string; color: string; border: string }> = {
  high:   { bg: "rgba(0,255,150,0.1)",   color: A,         border: "rgba(0,255,150,0.25)" },
  medium: { bg: "rgba(251,191,36,0.1)",  color: "#fbbf24", border: "rgba(251,191,36,0.25)" },
  low:    { bg: "rgba(156,163,175,0.1)", color: "#9ca3af", border: "rgba(156,163,175,0.2)" },
};

const TYPE_LABEL: Record<string, string> = {
  blog: "Blog Post", faq: "FAQ Page", comparison: "Comparison", guide: "Guide", case_study: "Case Study",
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={copy} className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg border transition-colors"
      style={{ borderColor: copied ? A : BORD, color: copied ? A : "#555" }}>
      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

export default function BriefsPage() {
  const router = useRouter();
  const [briefs,    setBriefs]    = useState<Brief[]>([]);
  const [recs,      setRecs]      = useState<Recommendation[]>([]);
  const [brandName, setBrandName] = useState("");
  const [brandId,   setBrandId]   = useState("");
  const [expanded,  setExpanded]  = useState<string | null>(null);
  const [loading,   setLoading]   = useState(false);
  const [done,      setDone]      = useState(false);
  const [cached,    setCached]    = useState(false);
  const [error,     setError]     = useState("");

  useEffect(() => {
    const id   = sessionStorage.getItem("brand_id")   || "";
    const name = sessionStorage.getItem("brand_name") || "";
    if (!id) { router.push("/"); return; }
    setBrandId(id);
    setBrandName(name);
    supabase.from("recommendations").select("*").eq("brand_id", id).then(r => setRecs(r.data || []));
  }, []);

  const generate = async () => {
    setLoading(true);
    setError("");
    try {
      const res  = await fetch("/api/briefs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ brand_id: brandId }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed");
      setBriefs(data.briefs);
      setCached(data.cached);
      setDone(true);
      if (data.briefs[0]) setExpanded(data.briefs[0].query_id);
    } catch (e) {
      setError(String(e));
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex" style={{ background: BG }}>
      <div className="flex-1 pr-80">

        {/* Nav */}
        <header className="sticky top-0 z-30 backdrop-blur-sm border-b px-6 py-4 flex items-center gap-4"
          style={{ background: "rgba(255,255,255,0.92)", borderColor: BORD }}>
          <button onClick={() => router.push("/dashboard")} className="flex items-center gap-1.5 text-sm"
            style={{ color: "#888" }}
            onMouseEnter={e => (e.currentTarget.style.color = "#111")}
            onMouseLeave={e => (e.currentTarget.style.color = "#888")}>
            <ChevronLeft className="w-4 h-4" /> Dashboard
          </button>
          <div className="h-4 w-px" style={{ background: BORD }} />
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5" style={{ color: A }} />
            <h1 className="font-semibold" style={{ color: "#111827" }} className="">Content Brief Generator</h1>
          </div>
          <div className="ml-auto">
            <img src="/logo.svg" alt="BrandEcho" style={{ height: "28px", width: "auto" }} />
          </div>
        </header>

        <main className="px-6 py-8">

          {/* Intro / trigger */}
          {!done && (
            <div className="rounded-2xl border p-10 text-center mb-8" style={{ background: SURF, borderColor: BORD }}>
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
                style={{ background: "rgba(0,255,150,0.1)", border: `1px solid ${A}` }}>
                <Sparkles className="w-8 h-8" style={{ color: A }} />
              </div>
              <h2 className="text-xl font-bold mb-2">Content Briefs for <span style={{ color: A }}>{brandName}</span></h2>
              <p className="text-sm mb-2 max-w-lg mx-auto" style={{ color: "#666" }}>
                We take your <strong style={{ color: "#ccc" }}>top 5 highest-revenue queries</strong> and generate structured content briefs — titles, H2s, key points, and the exact reason AI engines would cite your content.
              </p>
              <p className="text-xs mb-6" style={{ color: "#444" }}>1 Claude API call · Results cached for free re-visits</p>
              {error && (
                <div className="flex items-center gap-2 text-sm mb-4 p-3 rounded-xl justify-center"
                  style={{ background: "rgba(248,113,113,0.1)", color: "#f87171", border: "1px solid rgba(248,113,113,0.2)" }}>
                  <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
                </div>
              )}
              <button onClick={generate} disabled={loading}
                className="px-8 py-3 rounded-xl font-semibold text-sm"
                style={{ background: A, color: BG, opacity: loading ? 0.6 : 1 }}>
                {loading ? "Generating briefs… (~15 sec)" : "Generate Content Briefs"}
              </button>
            </div>
          )}

          {/* Brief cards */}
          {done && (
            <>
              <div className="flex items-center justify-between mb-5">
                <p className="text-sm" style={{ color: "#555" }}>
                  {cached ? "⚡ Loaded from cache" : "✓ Just generated"} — {briefs.length} content briefs
                </p>
                <button onClick={() => { setDone(false); setBriefs([]); }}
                  className="text-xs px-3 py-1.5 rounded-lg border"
                  style={{ borderColor: BORD, color: "#555" }}>
                  Regenerate
                </button>
              </div>

              <div className="space-y-4">
                {briefs.map((b, i) => {
                  const imp    = IMPACT_STYLE[b.estimated_impact] || IMPACT_STYLE.medium;
                  const isOpen = expanded === b.query_id;
                  const briefText = `Title: ${b.recommended_title}\n\nH2 Sections:\n${b.h2_sections?.map((h, i) => `${i + 1}. ${h}`).join("\n")}\n\nKey Points:\n${b.key_points?.map((p, i) => `• ${p}`).join("\n")}\n\nCitation Hook: ${b.citation_hook}`;

                  return (
                    <div key={b.query_id} className="rounded-2xl border overflow-hidden" style={{ background: SURF, borderColor: isOpen ? A : BORD }}>
                      {/* Header */}
                      <button className="w-full px-6 py-5 flex items-start gap-4 text-left transition-colors"
                        onClick={() => setExpanded(isOpen ? null : b.query_id)}
                        style={{ background: isOpen ? "rgba(0,255,150,0.04)" : "transparent" }}>
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-sm font-bold mt-0.5"
                          style={{ background: A, color: BG }}>{i + 1}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="text-xs px-2 py-0.5 rounded-full border" style={imp}>{b.estimated_impact} impact</span>
                            <span className="text-xs px-2 py-0.5 rounded-full border" style={{ background: "rgba(255,255,255,0.05)", borderColor: BORD, color: "#888" }}>
                              {TYPE_LABEL[b.content_type] || b.content_type}
                            </span>
                            <span className="text-xs" style={{ color: "#555" }}>{b.word_count?.toLocaleString()} words</span>
                          </div>
                          <h3 className="font-semibold" style={{ color: "#111827" }} className=" text-sm">{b.recommended_title}</h3>
                          <p className="text-xs mt-1" style={{ color: "#666" }}>Query: {b.query_text}</p>
                        </div>
                        <div className="flex-shrink-0" style={{ color: "#555" }}>
                          {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </div>
                      </button>

                      {/* Expanded content */}
                      {isOpen && (
                        <div className="px-6 pb-6 border-t" style={{ borderColor: BORD }}>
                          <div className="flex justify-end pt-4 mb-5">
                            <CopyButton text={briefText} />
                          </div>

                          <div className="grid grid-cols-2 gap-6">
                            {/* H2 Sections */}
                            <div className="rounded-xl border p-4" style={{ background: "#ffffff", borderColor: BORD }}>
                              <h4 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: A }}>H2 Sections</h4>
                              <ol className="space-y-2">
                                {b.h2_sections?.map((h, i) => (
                                  <li key={i} className="flex items-start gap-2 text-sm" style={{ color: "#ccc" }}>
                                    <span className="font-bold flex-shrink-0" style={{ color: A }}>H2</span>
                                    {h}
                                  </li>
                                ))}
                              </ol>
                            </div>

                            {/* Key Points */}
                            <div className="rounded-xl border p-4" style={{ background: "#ffffff", borderColor: BORD }}>
                              <h4 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "#fbbf24" }}>Key Points to Include</h4>
                              <ul className="space-y-2">
                                {b.key_points?.map((p, i) => (
                                  <li key={i} className="flex items-start gap-2 text-sm" style={{ color: "#ccc" }}>
                                    <span className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: "#fbbf24" }} />
                                    {p}
                                  </li>
                                ))}
                              </ul>
                            </div>

                            {/* Citation Hook */}
                            <div className="col-span-2 rounded-xl border p-4" style={{ background: "rgba(0,255,150,0.05)", borderColor: "rgba(0,255,150,0.2)" }}>
                              <h4 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: A }}>Why AI Engines Would Cite This</h4>
                              <p className="text-sm" style={{ color: "#ccc" }}>{b.citation_hook}</p>
                              <div className="flex items-center gap-2 mt-3 text-xs" style={{ color: "#555" }}>
                                <span>Schema: <span style={{ color: "#888" }}>{b.schema_markup}</span></span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </main>
      </div>

      <SmartRecommendationsPanel recommendations={recs} brandName={brandName} />
    </div>
  );
}
