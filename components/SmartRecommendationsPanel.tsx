"use client";

import { useState } from "react";
import { Sparkles, ChevronRight, ChevronLeft, TrendingUp, Zap, FileText, Settings, AlertTriangle } from "lucide-react";
import type { Recommendation } from "@/lib/types";

interface Props {
  recommendations: Recommendation[];
  brandName: string;
}

const CATEGORY_CONFIG = {
  aeo:       { label: "AEO",       icon: Zap,        color: "text-purple-400",  bg: "bg-purple-950/50 border-purple-800/40" },
  seo:       { label: "SEO",       icon: TrendingUp,  color: "text-blue-400",    bg: "bg-blue-950/50 border-blue-800/40" },
  content:   { label: "Content",   icon: FileText,    color: "text-green-400",   bg: "bg-green-950/50 border-green-800/40" },
  technical: { label: "Technical", icon: Settings,    color: "text-orange-400",  bg: "bg-orange-950/50 border-orange-800/40" },
};

const PRIORITY_DOT = { high: "bg-red-400", medium: "bg-yellow-400", low: "bg-green-400" };

export default function SmartRecommendationsPanel({ recommendations, brandName }: Props) {
  const [isOpen, setIsOpen]       = useState(true);
  const [activeFilter, setFilter] = useState<string>("all");

  const filtered = activeFilter === "all"
    ? recommendations
    : recommendations.filter(r => r.category === activeFilter);

  const highCount = recommendations.filter(r => r.priority === "high").length;

  return (
    <div className={`fixed right-0 top-0 h-full z-40 flex transition-all duration-300 ${isOpen ? "w-80" : "w-0"}`}>

      {/* Toggle Tab */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="absolute -left-10 top-1/2 -translate-y-1/2 w-10 h-20 bg-slate-800 border border-slate-700 border-r-0 rounded-l-xl flex items-center justify-center hover:bg-slate-700 transition-colors group"
        title={isOpen ? "Hide recommendations" : "Show recommendations"}
      >
        <div className="flex flex-col items-center gap-1">
          {isOpen ? <ChevronRight className="w-4 h-4 text-slate-400" /> : <ChevronLeft className="w-4 h-4 text-slate-400" />}
          {!isOpen && highCount > 0 && (
            <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
          )}
        </div>
      </button>

      {/* Panel */}
      {isOpen && (
        <div className="w-80 h-full bg-slate-900 border-l border-slate-800 flex flex-col overflow-hidden">

          {/* Header */}
          <div className="px-4 py-4 border-b border-slate-800 bg-slate-900/80 backdrop-blur-sm flex-shrink-0">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4 text-blue-400" />
              <span className="text-sm font-semibold text-white">Smart Recommendations</span>
            </div>
            <p className="text-xs text-slate-500">Live insights for <span className="text-blue-400">{brandName}</span></p>

            {highCount > 0 && (
              <div className="mt-2 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-950/50 border border-red-800/40">
                <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                <span className="text-xs text-red-300">{highCount} high-priority action{highCount > 1 ? "s" : ""} need attention</span>
              </div>
            )}
          </div>

          {/* Filters */}
          <div className="px-3 py-2 border-b border-slate-800 flex gap-1.5 flex-wrap flex-shrink-0">
            {[
              { key: "all", label: "All" },
              ...Object.entries(CATEGORY_CONFIG).map(([k, v]) => ({ key: k, label: v.label })),
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                  activeFilter === key
                    ? "bg-blue-600 text-white"
                    : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Recommendations list */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
            {filtered.length === 0 ? (
              <div className="text-center py-8 text-slate-600 text-sm">No recommendations yet</div>
            ) : (
              filtered.map((rec) => {
                const cfg = CATEGORY_CONFIG[rec.category];
                const Icon = cfg.icon;
                return (
                  <div key={rec.id} className={`rounded-xl border p-3 ${cfg.bg}`}>
                    {/* Top row */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-1.5">
                        <Icon className={`w-3.5 h-3.5 ${cfg.color} flex-shrink-0`} />
                        <span className={`text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className={`w-1.5 h-1.5 rounded-full ${PRIORITY_DOT[rec.priority]}`} />
                        <span className="text-xs text-slate-500 capitalize">{rec.priority}</span>
                      </div>
                    </div>

                    {/* Title */}
                    <p className="text-sm font-medium text-white mb-1 leading-tight">{rec.title}</p>
                    <p className="text-xs text-slate-400 leading-relaxed mb-2">{rec.description}</p>

                    {/* Lift badge + CTA */}
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-green-400 font-medium">{rec.projected_lift}</span>
                      <button className="text-xs px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors">
                        {rec.action_label}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-3 border-t border-slate-800 flex-shrink-0">
            <p className="text-xs text-slate-600 text-center">BrandEcho · Powered by Claude · Refreshes on new data</p>
          </div>
        </div>
      )}
    </div>
  );
}
