"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TrendingUp, Users, MessageSquare, Building2, ArrowRight, Zap, Globe, Bot } from "lucide-react";
import SmartRecommendationsPanel from "@/components/SmartRecommendationsPanel";
import type { Brand, Persona, Query, Competitor, Recommendation } from "@/lib/types";
import { supabase } from "@/lib/supabase";

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
    const [brandRes, personasRes, queriesRes, competitorsRes, recsRes] = await Promise.all([
      supabase.from("brands").select("*").eq("id", brandId).single(),
      supabase.from("personas").select("*").eq("brand_id", brandId),
      supabase.from("queries").select("*").eq("brand_id", brandId),
      supabase.from("competitors").select("*").eq("brand_id", brandId),
      supabase.from("recommendations").select("*").eq("brand_id", brandId).order("priority"),
    ]);

    if (brandRes.data)       setBrand(brandRes.data);
    if (personasRes.data)    setPersonas(personasRes.data);
    if (queriesRes.data)     setQueries(queriesRes.data);
    if (competitorsRes.data) setCompetitors(competitorsRes.data);
    if (recsRes.data)        setRecs(recsRes.data);
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const aeoQueries = queries.filter(q => q.type === "aeo");
  const seoQueries = queries.filter(q => q.type === "seo_longtail");
  const highRevQueries = queries.filter(q => q.revenue_proximity >= 70);

  return (
    <div className="min-h-screen bg-slate-950 flex">

      {/* Main content (leaves space for right panel) */}
      <div className="flex-1 pr-80">

        {/* Top nav */}
        <header className="sticky top-0 z-30 bg-slate-950/80 backdrop-blur-sm border-b border-slate-800 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="text-white font-semibold">{brand?.name || "Dashboard"}</span>
              <span className="text-slate-500 text-sm ml-2">{brand?.industry}</span>
            </div>
          </div>
          <nav className="flex items-center gap-1">
            {[
              { label: "Overview",    href: "/dashboard" },
              { label: "Personas",    href: "/personas" },
              { label: "Queries",     href: "/queries" },
            ].map(({ label, href }) => (
              <button
                key={href}
                onClick={() => router.push(href)}
                className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                  href === "/dashboard"
                    ? "bg-blue-600 text-white"
                    : "text-slate-400 hover:text-white hover:bg-slate-800"
                }`}
              >
                {label}
              </button>
            ))}
          </nav>
        </header>

        {/* Page body */}
        <main className="px-6 py-8 space-y-8 animate-fade-in">

          {/* KPI cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Total Queries",        value: queries.length,      icon: MessageSquare, color: "text-blue-400",   change: "+75 generated" },
              { label: "AI Engine Coverage",   value: "8",                 icon: Bot,           color: "text-purple-400", change: "Grok, GPT, Claude..." },
              { label: "Competitors Found",    value: competitors.length,  icon: Building2,     color: "text-orange-400", change: "Direct + substitutes" },
              { label: "High-Revenue Queries", value: highRevQueries.length, icon: TrendingUp, color: "text-green-400",  change: "Proximity ≥70%" },
            ].map(({ label, value, icon: Icon, color, change }) => (
              <div key={label} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 card-lift">
                <div className={`w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center mb-3 ${color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="text-3xl font-bold text-white mb-1">{value}</div>
                <div className="text-sm text-slate-400 mb-0.5">{label}</div>
                <div className="text-xs text-slate-600">{change}</div>
              </div>
            ))}
          </div>

          {/* Personas strip */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-400" />
                Auto-Generated Personas
              </h2>
              <button onClick={() => router.push("/personas")} className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1">
                View all <ArrowRight className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {personas.slice(0, 3).map((p, i) => (
                <div key={p.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 card-lift">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-white font-bold text-lg mb-3">
                    {p.name.charAt(0)}
                  </div>
                  <h3 className="font-semibold text-white text-sm mb-1">{p.name}</h3>
                  <p className="text-xs text-slate-500 mb-3">{p.age_range} · {p.archetype}</p>
                  <div className="space-y-1">
                    {p.pain_points?.slice(0, 2).map((pt, j) => (
                      <p key={j} className="text-xs text-slate-400">• {pt}</p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Competitors */}
          <section>
            <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
              <Building2 className="w-5 h-5 text-orange-400" />
              Competitors Discovered
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {competitors.map((c) => (
                <div key={c.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4 card-lift flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center flex-shrink-0">
                    <Globe className="w-4 h-4 text-slate-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white truncate">{c.name}</p>
                    <p className="text-xs text-slate-500 truncate">{c.domain}</p>
                    <span className={`text-xs ${c.type === "direct" ? "text-orange-400" : "text-purple-400"}`}>
                      {c.type === "direct" ? "Direct" : "Category sub"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Query preview */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-purple-400" />
                Query Preview
              </h2>
              <button onClick={() => router.push("/queries")} className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1">
                View all {queries.length} <ArrowRight className="w-4 h-4" />
              </button>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
              <div className="divide-y divide-slate-800">
                {queries.slice(0, 5).map((q) => (
                  <div key={q.id} className="px-5 py-3 flex items-center gap-4 hover:bg-slate-800/50 transition-colors">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${
                      q.type === "aeo"         ? "bg-purple-950/60 text-purple-400 border border-purple-800/40" :
                      q.type === "geo"         ? "bg-green-950/60  text-green-400  border border-green-800/40"  :
                      "bg-blue-950/60 text-blue-400 border border-blue-800/40"
                    }`}>
                      {q.type.toUpperCase()}
                    </span>
                    <p className="text-sm text-slate-300 flex-1 truncate">{q.text}</p>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <div className="h-1.5 w-16 bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-green-500 rounded-full" style={{ width: `${q.revenue_proximity}%` }} />
                      </div>
                      <span className="text-xs text-slate-500">{q.revenue_proximity}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </main>
      </div>

      {/* Smart Recommendations Panel */}
      <SmartRecommendationsPanel recommendations={recs} brandName={brand?.name || ""} />
    </div>
  );
}
