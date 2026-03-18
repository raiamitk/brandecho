"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MessageSquare, ChevronLeft, Search, TrendingUp } from "lucide-react";
import SmartRecommendationsPanel from "@/components/SmartRecommendationsPanel";
import type { Query, Recommendation } from "@/lib/types";
import { supabase } from "@/lib/supabase";

const A    = "#00FF96";
const BG   = "#ffffff";
const SURF = "#f9fafb";
const BORD = "#e5e7eb";
const AT   = "#059669";

const TYPE_CONFIG = {
  aeo:          { label: "AEO", bg: "rgba(124,58,237,0.08)",  color: "#7c3aed", border: "rgba(124,58,237,0.2)" },
  geo:          { label: "GEO", bg: "rgba(5,150,105,0.08)",   color: AT,         border: "rgba(5,150,105,0.2)" },
  seo_longtail: { label: "SEO", bg: "rgba(37,99,235,0.08)",   color: "#2563eb",  border: "rgba(37,99,235,0.2)" },
};

const INTENT_COLOR: Record<string, string> = {
  awareness:     "#9ca3af",
  consideration: "#d97706",
  purchase:      AT,
  comparison:    "#ea580c",
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
        <div className="w-8 h-8 rounded-full border-2 animate-spin" style={{ borderColor: A, borderTopColor: "transparent" }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex" style={{ background: BG }}>
      <div className="flex-1 pr-80">

        {/* Nav */}
        <header className="sticky top-0 z-30 backdrop-blur-sm border-b px-6 py-4 flex items-center gap-4"
          style={{ background: "rgba(255,255,255,0.92)", borderColor: BORD }}>
          <button onClick={() => router.push("/dashboard")}
            className="flex items-center gap-1.5 text-sm transition-colors"
            style={{ color: "#888" }}
            onMouseEnter={e => (e.currentTarget.style.color = "#111")}
            onMouseLeave={e => (e.currentTarget.style.color = "#888")}>
            <ChevronLeft className="w-4 h-4" /> Dashboard
          </button>
          <div className="h-4 w-px" style={{ background: BORD }} />
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" style={{ color: A }} />
            <h1 className="font-semibold" style={{ color: "#111827" }}>
              Query Explorer · <span style={{ color: AT }}>{queries.length} queries</span>
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
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#9ca3af" }} />
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Search queries..."
                className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm focus:outline-none transition-all"
                style={{ background: SURF, border: `1px solid ${BORD}`, color: "#111827" }}
                onFocus={e => (e.target.style.borderColor = A)}
                onBlur={e  => (e.target.style.borderColor = BORD)} />
            </div>
            {["all", "aeo", "geo", "seo_longtail"].map((t) => (
              <button key={t} onClick={() => setTypeFilter(t)}
                className="px-4 py-2 rounded-xl text-sm font-medium transition-colors"
                style={{
                  background: typeFilter === t ? A : SURF,
                  color:      typeFilter === t ? "#111827" : "#6b7280",
                  border:     `1px solid ${typeFilter === t ? A : BORD}`,
                }}>
                {t === "all" ? "All" : t === "seo_longtail" ? "SEO" : t.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Table */}
          <div className="rounded-2xl border overflow-hidden" style={{ background: "#fff", borderColor: BORD }}>
            <div className="grid px-5 py-3 border-b text-xs font-medium uppercase tracking-wider"
              style={{ gridTemplateColumns: "80px 1fr 110px 90px", borderColor: BORD, color: "#9ca3af" }}>
              <span>Type</span><span>Query</span><span>Intent</span><span>Rev %</span>
            </div>
            <div className="divide-y" style={{ borderColor: BORD }}>
              {filtered.length === 0 ? (
                <div className="px-5 py-12 text-center text-sm" style={{ color: "#9ca3af" }}>No queries match your filters</div>
              ) : filtered.map((q) => {
                const cfg = TYPE_CONFIG[q.type as keyof typeof TYPE_CONFIG];
                return (
                  <div key={q.id} className="grid px-5 py-3.5 items-center transition-colors"
                    style={{ gridTemplateColumns: "80px 1fr 110px 90px" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#f9fafb")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full border inline-flex w-fit"
                      style={{ background: cfg?.bg || SURF, color: cfg?.color || "#6b7280", borderColor: cfg?.border || BORD }}>
                      {cfg?.label || q.type}
                    </span>
                    <p className="text-sm pr-4" style={{ color: "#374151" }}>{q.text}</p>
                    <span className="text-xs capitalize font-medium" style={{ color: INTENT_COLOR[q.intent] || "#9ca3af" }}>{q.intent}</span>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-12 rounded-full overflow-hidden" style={{ background: "#e5e7eb" }}>
                        <div className="h-full rounded-full" style={{ width: `${q.revenue_proximity}%`, background: A }} />
                      </div>
                      <span className="text-xs font-semibold" style={{ color: AT }}>{q.revenue_proximity}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Stats */}
          <div className="mt-4 flex items-center gap-6 text-sm" style={{ color: "#9ca3af" }}>
            <span>Showing <span style={{ color: "#374151" }}>{filtered.length}</span> of <span style={{ color: "#374151" }}>{queries.length}</span></span>
            <span className="flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5" style={{ color: AT }} />
              Avg revenue proximity: <span style={{ color: AT, fontWeight: 600 }}>{Math.round(filtered.reduce((a, q) => a + q.revenue_proximity, 0) / (filtered.length || 1))}%</span>
            </span>
          </div>
        </main>
      </div>

      <SmartRecommendationsPanel recommendations={recs} brandName={brandName} />
    </div>
  );
}
