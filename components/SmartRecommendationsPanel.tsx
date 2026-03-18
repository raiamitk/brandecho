"use client";

import { useState } from "react";
import { Sparkles, ChevronRight, ChevronLeft, TrendingUp, Zap, FileText, Settings, AlertTriangle } from "lucide-react";
import type { Recommendation } from "@/lib/types";

interface Props { recommendations: Recommendation[]; brandName: string; }

const A    = "#00FF96";
const BG   = "#141414";
const SURF = "#1c1c1c";
const BORD = "#2a2a2a";

const CATEGORY_CONFIG = {
  aeo:       { label: "AEO",       icon: Zap,       color: A },
  seo:       { label: "SEO",       icon: TrendingUp, color: "#60a5fa" },
  content:   { label: "Content",   icon: FileText,   color: "#34d399" },
  technical: { label: "Technical", icon: Settings,   color: "#fb923c" },
};

const PRIORITY_COLOR = { high: "#f87171", medium: "#fbbf24", low: A };

export default function SmartRecommendationsPanel({ recommendations, brandName }: Props) {
  const [isOpen, setIsOpen]       = useState(true);
  const [activeFilter, setFilter] = useState("all");

  const filtered = activeFilter === "all" ? recommendations : recommendations.filter(r => r.category === activeFilter);
  const highCount = recommendations.filter(r => r.priority === "high").length;

  return (
    <div className={`fixed right-0 top-0 h-full z-40 flex transition-all duration-300 ${isOpen ? "w-80" : "w-0"}`}>

      {/* Toggle tab */}
      <button onClick={() => setIsOpen(!isOpen)}
        className="absolute -left-10 top-1/2 -translate-y-1/2 w-10 h-20 flex items-center justify-center rounded-l-xl border border-r-0"
        style={{ background: SURF, borderColor: BORD }}>
        <div className="flex flex-col items-center gap-1">
          {isOpen ? <ChevronRight className="w-4 h-4 text-gray-500" /> : <ChevronLeft className="w-4 h-4 text-gray-500" />}
          {!isOpen && highCount > 0 && <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: "#f87171" }} />}
        </div>
      </button>

      {isOpen && (
        <div className="w-80 h-full flex flex-col overflow-hidden border-l" style={{ background: BG, borderColor: BORD }}>

          {/* Header */}
          <div className="px-4 py-4 border-b flex-shrink-0" style={{ borderColor: BORD }}>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4" style={{ color: A }} />
              <span className="text-sm font-bold text-white">Smart Recommendations</span>
            </div>
            <p className="text-xs text-gray-600">Live insights for <span style={{ color: A }}>{brandName}</span></p>
            {highCount > 0 && (
              <div className="mt-2 flex items-center gap-2 px-3 py-1.5 rounded-lg border" style={{ background: "rgba(248,113,113,0.08)", borderColor: "rgba(248,113,113,0.2)" }}>
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#f87171" }} />
                <span className="text-xs" style={{ color: "#f87171" }}>{highCount} high-priority action{highCount > 1 ? "s" : ""}</span>
              </div>
            )}
          </div>

          {/* Filters */}
          <div className="px-3 py-2 border-b flex gap-1.5 flex-wrap flex-shrink-0" style={{ borderColor: BORD }}>
            {[{ key: "all", label: "All" }, ...Object.entries(CATEGORY_CONFIG).map(([k, v]) => ({ key: k, label: v.label }))].map(({ key, label }) => (
              <button key={key} onClick={() => setFilter(key)}
                className="px-2.5 py-1 rounded-lg text-xs font-medium transition-colors"
                style={{ background: activeFilter === key ? A : SURF, color: activeFilter === key ? BG : "#888" }}>
                {label}
              </button>
            ))}
          </div>

          {/* Recommendations */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
            {filtered.length === 0 ? (
              <div className="text-center py-8 text-gray-700 text-sm">No recommendations yet</div>
            ) : filtered.map(rec => {
              const cfg  = CATEGORY_CONFIG[rec.category as keyof typeof CATEGORY_CONFIG];
              const Icon = cfg?.icon || Zap;
              return (
                <div key={rec.id} className="rounded-xl border p-3" style={{ background: SURF, borderColor: BORD }}>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-1.5">
                      <Icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: cfg?.color || A }} />
                      <span className="text-xs font-medium" style={{ color: cfg?.color || A }}>{cfg?.label}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: PRIORITY_COLOR[rec.priority as keyof typeof PRIORITY_COLOR] || "#888" }} />
                      <span className="text-xs text-gray-600 capitalize">{rec.priority}</span>
                    </div>
                  </div>
                  <p className="text-sm font-medium text-white mb-1 leading-tight">{rec.title}</p>
                  <p className="text-xs text-gray-500 leading-relaxed mb-2">{rec.description}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium" style={{ color: A }}>{rec.projected_lift}</span>
                    <button className="text-xs px-2.5 py-1 rounded-lg transition-colors text-white"
                      style={{ background: "rgba(0,255,150,0.12)" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "rgba(0,255,150,0.22)")}
                      onMouseLeave={e => (e.currentTarget.style.background = "rgba(0,255,150,0.12)")}>
                      {rec.action_label}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="px-4 py-3 border-t flex-shrink-0" style={{ borderColor: BORD }}>
            <p className="text-xs text-gray-700 text-center">BrandEcho · Powered by Claude</p>
          </div>
        </div>
      )}
    </div>
  );
}
