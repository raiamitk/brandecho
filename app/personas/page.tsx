"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Users, Target, Zap, ChevronLeft, Bot } from "lucide-react";
import SmartRecommendationsPanel from "@/components/SmartRecommendationsPanel";
import type { Persona, Recommendation } from "@/lib/types";
import { supabase } from "@/lib/supabase";

const A    = "#00FF96";
const BG   = "#ffffff";
const SURF = "#f9fafb";
const BORD = "#e5e7eb";

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
          style={{ background: "rgba(255,255,255,0.92)", borderColor: BORD }}
        >
          <button
            onClick={() => router.push("/dashboard")}
            className="flex items-center gap-1.5 text-sm transition-colors"
            style={{ color: "#888" }}
            onMouseEnter={e => (e.currentTarget.style.color = "#111")}
            onMouseLeave={e => (e.currentTarget.style.color = "#888")}
          >
            <ChevronLeft className="w-4 h-4" /> Dashboard
          </button>
          <div className="h-4 w-px" style={{ background: BORD }} />
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5" style={{ color: A }} />
            <h1 className="font-semibold" style={{ color: "#111827" }} className="">User Personas</h1>
          </div>
          <div className="ml-auto">
            <img src="/logo.svg" alt="BrandEcho" style={{ height: "28px", width: "auto" }} />
          </div>
        </header>

        <main className="px-6 py-8 animate-fade-in">
          {/* Persona selector cards */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            {personas.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelected(p.id)}
                className="text-left rounded-2xl border p-5 transition-all"
                style={{
                  background: selected === p.id ? "rgba(0,255,150,0.08)" : SURF,
                  borderColor: selected === p.id ? A : BORD,
                }}
              >
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-bold mb-3"
                  style={{ background: selected === p.id ? A : "#2a2a2a", color: selected === p.id ? BG : A }}
                >
                  {p.name.charAt(0)}
                </div>
                <h3 className="font-semibold" style={{ color: "#111827" }} className=" text-sm mb-1">{p.name}</h3>
                <p className="text-xs" style={{ color: "#666" }}>{p.age_range} · {p.archetype}</p>
              </button>
            ))}
          </div>

          {active && (
            <div className="grid grid-cols-2 gap-6 animate-fade-in">
              {/* Pain Points */}
              <div className="rounded-2xl border p-6" style={{ background: SURF, borderColor: BORD }}>
                <h3 className="font-semibold" style={{ color: "#111827" }} className=" mb-4 flex items-center gap-2">
                  <Target className="w-4 h-4" style={{ color: "#f87171" }} /> Pain Points
                </h3>
                <ul className="space-y-2">
                  {active.pain_points?.map((pt, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm" style={{ color: "#ccc" }}>
                      <span className="w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0" style={{ background: "#f87171" }} />
                      {pt}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Goals */}
              <div className="rounded-2xl border p-6" style={{ background: SURF, borderColor: BORD }}>
                <h3 className="font-semibold" style={{ color: "#111827" }} className=" mb-4 flex items-center gap-2">
                  <Zap className="w-4 h-4" style={{ color: A }} /> Goals
                </h3>
                <ul className="space-y-2">
                  {active.goals?.map((g, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm" style={{ color: "#ccc" }}>
                      <span className="w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0" style={{ background: A }} />
                      {g}
                    </li>
                  ))}
                </ul>
              </div>

              {/* AI Usage */}
              <div className="rounded-2xl border p-6 col-span-2" style={{ background: SURF, borderColor: BORD }}>
                <h3 className="font-semibold" style={{ color: "#111827" }} className=" mb-4 flex items-center gap-2">
                  <Bot className="w-4 h-4" style={{ color: "#a78bfa" }} /> AI Tool Usage & Query Style
                </h3>
                <div className="flex flex-wrap gap-2 mb-4">
                  {active.ai_tools_used?.map((tool) => (
                    <span
                      key={tool}
                      className="px-3 py-1.5 rounded-full text-sm border"
                      style={{ background: "rgba(167,139,250,0.1)", borderColor: "rgba(167,139,250,0.25)", color: "#a78bfa" }}
                    >
                      {tool}
                    </span>
                  ))}
                </div>
                <p className="text-sm" style={{ color: "#888" }}>
                  <span className="font-medium" style={{ color: "#ccc" }}>Query style: </span>
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
