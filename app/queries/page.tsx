"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MessageSquare, ChevronLeft, Search, TrendingUp } from "lucide-react";
import SmartRecommendationsPanel from "@/components/SmartRecommendationsPanel";
import type { Query, Recommendation } from "@/lib/types";
import { supabase } from "@/lib/supabase";

const TYPE_CONFIG = {
  aeo:         { label: "AEO",      color: "bg-purple-950/60 text-purple-400 border-purple-800/40" },
  geo:         { label: "GEO",      color: "bg-green-950/60  text-green-400  border-green-800/40" },
  seo_longtail:{ label: "SEO",      color: "bg-blue-950/60   text-blue-400   border-blue-800/40" },
};

const INTENT_COLOR: Record<string, string> = {
  awareness:     "text-slate-400",
  consideration: "text-yellow-400",
  purchase:      "text-green-400",
  comparison:    "text-orange-400",
};

export default function QueriesPage() {
  const router = useRouter();
  const [queries,   setQueries]   = useState<Query[]>([]);
  const [recs,      setRecs]      = useState<Recommendation[]>([]);
  const [brandName, setBrandName] = useState("");
  const [search,    setSearch]    = useState("");
  const [typeFilter,setTypeFilter]= useState("all");
  const [loading,   setLoading]   = useState(true);

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
    return <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>;
  }

  return (
    <div className="min-h-screen bg-slate-950 flex">
      <div className="flex-1 pr-80">
        {/* Nav */}
        <header className="sticky top-0 z-30 bg-slate-950/80 backdrop-blur-sm border-b border-slate-800 px-6 py-4 flex items-center gap-4">
          <button onClick={() => router.push("/dashboard")} className="text-slate-400 hover:text-white flex items-center gap-1.5 text-sm">
            <ChevronLeft className="w-4 h-4" /> Dashboard
          </button>
          <div className="h-4 w-px bg-slate-800" />
          <h1 className="text-white font-semibold flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-purple-400" />
            Query Explorer · {queries.length} queries
          </h1>
        </header>

        <main className="px-6 py-6 animate-fade-in">

          {/* Controls */}
          <div className="flex items-center gap-3 mb-6">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search queries..."
                className="w-full pl-9 pr-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>
            {["all", "aeo", "geo", "seo_longtail"].map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                  typeFilter === t ? "bg-blue-600 text-white" : "bg-slate-900 border border-slate-700 text-slate-400 hover:text-white"
                }`}
              >
                {t === "all" ? "All" : t === "seo_longtail" ? "SEO" : t.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="grid grid-cols-[80px_1fr_100px_80px_100px] gap-0 px-5 py-3 border-b border-slate-800 text-xs text-slate-500 font-medium uppercase tracking-wider">
              <span>Type</span>
              <span>Query</span>
              <span>Intent</span>
              <span>Rev %</span>
              <span>Persona</span>
            </div>
            <div className="divide-y divide-slate-800/50 max-h-[600px] overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="px-5 py-12 text-center text-slate-600">No queries match your filters</div>
              ) : (
                filtered.map((q) => (
                  <div key={q.id} className="grid grid-cols-[80px_1fr_100px_80px_100px] gap-0 px-5 py-3.5 hover:bg-slate-800/40 transition-colors items-center">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border inline-flex w-fit ${TYPE_CONFIG[q.type]?.color || ""}`}>
                      {TYPE_CONFIG[q.type]?.label || q.type}
                    </span>
                    <p className="text-sm text-slate-300 pr-4">{q.text}</p>
                    <span className={`text-xs capitalize ${INTENT_COLOR[q.intent] || "text-slate-400"}`}>{q.intent}</span>
                    <div className="flex items-center gap-1.5">
                      <div className="h-1.5 w-10 bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-green-500 rounded-full" style={{ width: `${q.revenue_proximity}%` }} />
                      </div>
                      <span className="text-xs text-slate-500">{q.revenue_proximity}</span>
                    </div>
                    <span className="text-xs text-slate-500 truncate">{/* persona name would go here */}—</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Stats row */}
          <div className="mt-4 flex items-center gap-6 text-sm text-slate-500">
            <span>Showing {filtered.length} of {queries.length}</span>
            <span className="flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5 text-green-400" />
              Avg revenue proximity: {Math.round(filtered.reduce((a, q) => a + q.revenue_proximity, 0) / (filtered.length || 1))}%
            </span>
          </div>
        </main>
      </div>

      <SmartRecommendationsPanel recommendations={recs} brandName={brandName} />
    </div>
  );
}
