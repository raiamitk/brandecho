"use client";

import { useState } from "react";
import { Sparkles, ChevronRight, ChevronLeft, TrendingUp, Zap, FileText, Settings, AlertTriangle } from "lucide-react";
import type { Recommendation } from "@/lib/types";

interface Props { recommendations: Recommendation[]; brandName: string; }

const A    = "#00FF96";
const AT   = "#059669";
const SURF = "#f9fafb";
const BORD = "#e5e7eb";

const CATEGORY_CONFIG = {
  aeo:       { label: "AEO",       icon: Zap,        color: AT },
  seo:       { label: "SEO",       icon: TrendingUp,  color: "#2563eb" },
  content:   { label: "Content",   icon: FileText,    color: "#059669" },
  technical: { label: "Technical", icon: Settings,    color: "#ea580c" },
};

const PRIORITY_COLOR = { high: "#dc2626", medium: "#d97706", low: AT };

export default function SmartRecommendationsPanel({ recommendations, brandName }: Props) {
  const [isOpen,       setIsOpen]  = useState(true);
  const [activeFilter, setFilter]  = useState("all");

  const filtered  = activeFilter === "all" ? recommendations : recommendations.filter(r => r.category === activeFilter);
  const highCount = recommendations.filter(r => r.priority === "high").length;

  return (
    <div className={`fixed right-0 top-0 h-full z-40 flex transition-all duration-300 ${isOpen ? "w-80" : "w-0"}`}>

      {/* Toggle tab */}
      <button onClick={() => setIsOpen(!isOpen)}
        className="absolute -left-10 top-1/2 -translate-y-1/2 w-10 h-20 flex items-center justify-center rounded-l-xl border border-r-0 shadow-sm"
        style={{ background: "#fff", borderColor: BORD }}>
        <div className="flex flex-col items-center gap-1">
          {isOpen ? <ChevronRight className="w-4 h-4" style={{ color: "#9ca3af" }} /> : <ChevronLeft className="w-4 h-4" style={{ color: "#9ca3af" }} />}
          {!isOpen && highCount > 0 && <span className="w-2 h-2 rounded-full animate-pulse bg-red-500" />}
        </div>
      </button>

      {isOpen && (
        <div className="w-80 h-full flex flex-col overflow-hidden border-l shadow-lg" style={{ background: "#fff", borderColor: BORD }}>

          {/* Header */}
          <div className="px-4 py-4 border-b flex-shrink-0" style={{ borderColor: BORD }}>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4" style={{ color: AT }} />
              <span className="text-sm font-bold" style={{ color: "#111827" }}>Smart Recommendations</span>
            </div>
            <p className="text-xs" style={{ color: "#9ca3af" }}>Live insights for <span style={{ color: AT, fontWeight: 600 }}>{brandName}</span></p>
            {highCount > 0 && (
              <div className="mt-2 flex items-center gap-2 px-3 py-1.5 rounded-lg border"
                style={{ background: "#fef2f2", borderColor: "#fecaca" }}>
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 text-red-500" />
                <span className="text-xs text-red-600">{highCount} high-priority action{highCount > 1 ? "s" : ""}</span>
              </div>
            )}
          </div>

          {/* Filters */}
          <div className="px-3 py-2 border-b flex gap-1.5 flex-wrap flex-shrink-0" style={{ borderColor: BORD }}>
            {[{ key: "all", label: "All" }, ...Object.entries(CATEGORY_CONFIG).map(([k, v]) => ({ key: k, label: v.label }))].map(({ key, label }) => (
              <button key={key} onClick={() => setFilter(key)}
                className="px-2.5 py-1 rounded-lg text-xs font-medium transition-colors"
                style={{
                  background: activeFilter === key ? A : SURF,
                  color:      activeFilter === key ? "#111827" : "#6b7280",
                  border:     `1px solid ${activeFilter === key ? A : BORD}`,
                }}>
                {label}
              </button>
            ))}
          </div>

          {/* Recommendations */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
            {filtered.length === 0 ? (
              <div className="text-center py-8 text-sm" style={{ color: "#9ca3af" }}>No recommendations yet</div>
            ) : filtered.map(rec => {
              const cfg  = CATEGORY_CONFIG[rec.category as keyof typeof CATEGORY_CONFIG];
              const Icon = cfg?.icon || Zap;
              return (
                <div key={rec.id} className="rounded-xl border p-3 shadow-sm" style={{ background: SURF, borderColor: BORD }}>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-1.5">
                      <Icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: cfg?.color || AT }} />
                      <span className="text-xs font-medium" style={{ color: cfg?.color || AT }}>{cfg?.label}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: PRIORITY_COLOR[rec.priority as keyof typeof PRIORITY_COLOR] || "#888" }} />
                      <span className="text-xs capitalize" style={{ color: "#9ca3af" }}>{rec.priority}</span>
                    </div>
                  </div>
                  <p className="text-sm font-semibold mb-1 leading-tight" style={{ color: "#111827" }}>{rec.title}</p>
                  <p className="text-xs leading-relaxed mb-2" style={{ color: "#6b7280" }}>{rec.description}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold" style={{ color: AT }}>{rec.projected_lift}</span>
                    <button className="text-xs px-2.5 py-1 rounded-lg font-medium transition-colors"
                      style={{ background: "rgba(0,255,150,0.12)", color: AT }}
                      onMouseEnter={e => (e.currentTarget.style.background = "rgba(0,255,150,0.25)")}
                      onMouseLeave={e => (e.currentTarget.style.background = "rgba(0,255,150,0.12)")}>
                      {rec.action_label}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="px-4 py-3 border-t flex-shrink-0" style={{ borderColor: BORD }}>
            <p className="text-xs text-center" style={{ color: "#d1d5db" }}>BrandEcho · Powered by Claude</p>
          </div>
        </div>
      )}
    </div>
  );
}
