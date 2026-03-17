"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Users, Target, Zap, ChevronLeft, Bot } from "lucide-react";
import SmartRecommendationsPanel from "@/components/SmartRecommendationsPanel";
import type { Persona, Recommendation } from "@/lib/types";
import { supabase } from "@/lib/supabase";

export default function PersonasPage() {
  const router = useRouter();
  const [personas,  setPersonas]  = useState<Persona[]>([]);
  const [recs,      setRecs]      = useState<Recommendation[]>([]);
  const [brandName, setBrandName] = useState("");
  const [selected,  setSelected]  = useState<string | null>(null);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    const brandId = sessionStorage.getItem("brand_id");
    const name    = sessionStorage.getItem("brand_name") || "";
    setBrandName(name);
    if (!brandId) { router.push("/"); return; }
    loadData(brandId);
  }, []);

  const loadData = async (brandId: string) => {
    const [pRes, rRes] = await Promise.all([
      supabase.from("personas").select("*").eq("brand_id", brandId),
      supabase.from("recommendations").select("*").eq("brand_id", brandId),
    ]);
    if (pRes.data) { setPersonas(pRes.data); if (pRes.data[0]) setSelected(pRes.data[0].id); }
    if (rRes.data) setRecs(rRes.data);
    setLoading(false);
  };

  const active = personas.find(p => p.id === selected);

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
            <Users className="w-5 h-5 text-blue-400" /> User Personas
          </h1>
        </header>

        <main className="px-6 py-8 animate-fade-in">
          <div className="grid grid-cols-3 gap-4 mb-8">
            {personas.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelected(p.id)}
                className={`text-left rounded-2xl border p-5 transition-all ${
                  selected === p.id
                    ? "bg-blue-950/50 border-blue-600"
                    : "bg-slate-900 border-slate-800 hover:border-slate-700"
                }`}
              >
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-white text-xl font-bold mb-3">
                  {p.name.charAt(0)}
                </div>
                <h3 className="font-semibold text-white text-sm mb-1">{p.name}</h3>
                <p className="text-xs text-slate-500">{p.age_range} · {p.archetype}</p>
              </button>
            ))}
          </div>

          {active && (
            <div className="grid grid-cols-2 gap-6 animate-fade-in">
              {/* Pain points */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                  <Target className="w-4 h-4 text-red-400" /> Pain Points
                </h3>
                <ul className="space-y-2">
                  {active.pain_points?.map((pt, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-400 mt-2 flex-shrink-0" />
                      {pt}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Goals */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-green-400" /> Goals
                </h3>
                <ul className="space-y-2">
                  {active.goals?.map((g, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-400 mt-2 flex-shrink-0" />
                      {g}
                    </li>
                  ))}
                </ul>
              </div>

              {/* AI Usage */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 col-span-2">
                <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                  <Bot className="w-4 h-4 text-purple-400" /> AI Tool Usage & Query Style
                </h3>
                <div className="flex flex-wrap gap-2 mb-4">
                  {active.ai_tools_used?.map((tool) => (
                    <span key={tool} className="px-3 py-1.5 rounded-full bg-purple-950/50 border border-purple-800/40 text-purple-300 text-sm">
                      {tool}
                    </span>
                  ))}
                </div>
                <p className="text-sm text-slate-400">
                  <span className="text-slate-300 font-medium">Query style: </span>
                  {active.query_style}
                </p>
              </div>
            </div>
          )}
        </main>
      </div>

      <SmartRecommendationsPanel recommendations={recs} brandName={brandName} />
    </div>
  );
}
