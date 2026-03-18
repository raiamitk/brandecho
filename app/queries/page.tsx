"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MessageSquare, ChevronLeft, Search, TrendingUp } from "lucide-react";
import SmartRecommendationsPanel from "@/components/SmartRecommendationsPanel";
import type { Query, Recommendation } from "@/lib/types";
import { supabase } from "@/lib/supabase";

const A    = "#00FF96";
const BG   = "#141414";
const SURF = "#1c1c1c";
const BORD = "#2a2a2a";

const TYPE_CONFIG = {
  aeo:          { label: "AEO", bg: "rgba(167,139,250,0.12)", color: "#a78bfa", border: "rgba(167,139,250,0.25)" },
  geo:          { label: "GEO", bg: "rgba(0,255,150,0.10)",   color: A,          border: "rgba(0,255,150,0.25)" },
  seo_longtail: { label: "SEO", bg: "rgba(96,165,250,0.10)",  color: "#60a5fa",  border: "rgba(96,165,250,0.25)" },
};

const INTENT_COLOR: Record<string, string> = {
  awareness:     "#888",
  consideration: "#fbbf24",
  purchase:      A,
  comparison:    "#fb923c",
};

export default function QueriesPage() {
  const router = useRouter();
  const [queries,    setQueries]    = useState<Query[]>([]);
  const [recs,       setRecs]       = useState<Recommendation[]>([]);
  const [brandName,  setBrandName]  = useState("");
  const [search,     setSearch]     = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [loading,    setLoading]    = useState(true);

  useEffect(() => {
    const brandId = sessionStorage.getItem("brand_id");
    const name    = sessionStorage.getItem("brand_name") || "";
    setBrandName(name);
    if (!brandId) { router.push("/"); return; }
    loadData(brandId);
  }, []);

  const loadData = async (brandId: string) => {
    const [qRes, rRes] = await Promise.all([
      supabase.from("queries").select("*").eq("brand_id", brandId).order("revenue_proximity", { ascending: false }),
      supabase.from("recommendations").select("*").eq("brand_id", brandId),
    ]);
    if (qRes.data) setQueries(qRes.data);
    if (rRes.data) setRecs(rRes.data);
    setLoading(false);
  };

  const filtered = queries.filter(q => {
    const matchSearch = search === "" || q.text.toLowerCase().includes(search.toLowerCase());
    const matchType   = typeFilter === "all" || q.type === typeFilter;
    return matchSearch && matchType;
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: BG }}>
        <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: A, borderTopColor: "transparent" }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex" style={{ background: BG }}>
      <div className="flex-1 pr-80">

        {/* Nav */}
        <header
          className="sticky top-0 z-30 backdrop-blur-sm border-b px-6 py-4 flex items-center gap-4"
          style={{ background: "rgba(20,20,20,0.85)", borderColor: BORD }}
        >
          <button
            onClick={() => router.push("/dashboard")}
            className="flex items-center gap-1.5 text-sm transition-colors"
            style={{ color: "#888" }}
            onMouseEnter={e => (e.currentTarget.style.color = "#fff")}
            onMouseLeave={e => (e.currentTarget.style.color = "#888")}
          >
            <ChevronLeft className="w-4 h-4" /> Dashboard
          </button>
          <div className="h-4 w-px" style={{ background: BORD }} />
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" style={{ color: A }} />
            <h1 className="font-semibold text-white">
              Query Explorer · <span style={{ color: A }}>{queries.length} queries</span>
            </h1>
          </div>
          <div className="ml-auto">
            <img src="/logo.svg" alt="BrandEcho" style={{ height: "28px", width: "auto" }} />
          </div>
        </header>

        <main className="px-6 py-6 animate-fade-in">

          {/* Controls */}
          <div className="flex items-center gap-3 mb-6">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#555" }} />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search queries..."
                className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none transition-all"
                style={{ background: SURF, border: `1px solid ${BORD}` }}
                onFocus={e => (e.target.style.borderColor = A)}
                onBlur={e  => (e.target.style.borderColor = BORD)}
              />
            </div>
            {["all", "aeo", "geo", "seo_longtail"].map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className="px-4 py-2 rounded-xl text-sm font-medium transition-colors"
                style={{
                  background: typeFilter === t ? A : SURF,
                  color:      typeFilter === t ? BG : "#888",
                  border:     `1px solid ${typeFilter === t ? A : BORD}`,
                }}
              >
                {t === "all" ? "All" : t === "seo_longtail" ? "SEO" : t.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Table */}
          <div className="rounded-2xl border overflow-hidden" style={{ background: SURF, borderColor: BORD }}>
            <div
              className="grid grid-cols-[80px_1fr_110px_90px] gap-0 px-5 py-3 border-b text-xs font-medium uppercase tracking-wider"
              style={{ borderColor: BORD, color: "#555" }}
            >
              <span>Type</span>
              <span>Query</span>
              <span>Intent</span>
              <span>Rev %</span>
            </div>
            <div className="divide-y max-h-[600px] overflow-y-auto" style={{ borderColor: BORD }}>
              {filtered.length === 0 ? (
                <div className="px-5 py-12 text-center text-sm" style={{ color: "#555" }}>
                  No queries match your filters
                </div>
              ) : (
                filtered.map((q) => {
                  const cfg = TYPE_CONFIG[q.type as keyof typeof TYPE_CONFIG];
                  return (
                    <div
                      key={q.id}
                      className="grid grid-cols-[80px_1fr_110px_90px] gap-0 px-5 py-3.5 transition-colors items-center"
                      style={{ borderColor: BORD }}
                      onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                    >
                      <span
                        className="text-xs font-medium px-2 py-0.5 rounded-full border inline-flex w-fit"
                        style={{ background: cfg?.bg || "rgba(255,255,255,0.05)", color: cfg?.color || "#888", borderColor: cfg?.border || BORD }}
                      >
                        {cfg?.label || q.type}
                      </span>
                      <p className="text-sm pr-4" style={{ color: "#ddd" }}>{q.text}</p>
                      <span
                        className="text-xs capitalize font-medium"
                        style={{ color: INTENT_COLOR[q.intent] || "#888" }}
                      >
                        {q.intent}
                      </span>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-12 rounded-full overflow-hidden" style={{ background: "#2a2a2a" }}>
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${q.revenue_proximity}%`, background: A }}
                          />
                        </div>
                        <span className="text-xs font-medium" style={{ color: A }}>{q.revenue_proximity}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Stats row */}
          <div className="mt-4 flex items-center gap-6 text-sm" style={{ color: "#555" }}>
            <span>Showing <span style={{ color: "#aaa" }}>{filtered.length}</span> of <span style={{ color: "#aaa" }}>{queries.length}</span></span>
            <span className="flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5" style={{ color: A }} />
              Avg revenue proximity:{" "}
              <span style={{ color: A, fontWeight: 600 }}>
                {Math.round(filtered.reduce((a, q) => a + q.revenue_proximity, 0) / (filtered.length || 1))}%
              </span>
            </span>
          </div>
        </main>
      </div>

      <SmartRecommendationsPanel recommendations={recs} brandName={brandName} />
    </div>
  );
}
