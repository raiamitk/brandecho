"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Zap, Bot, TrendingUp, Globe, ArrowRight, Sparkles } from "lucide-react";

export default function OnboardingPage() {
  const router = useRouter();
  const [brandName, setBrandName] = useState("");
  const [domain, setDomain]       = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError]         = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!brandName.trim()) { setError("Please enter a brand name"); return; }

    setIsLoading(true);
    setError("");

    // Store in sessionStorage and navigate to processing
    sessionStorage.setItem("brand_name", brandName.trim());
    sessionStorage.setItem("brand_domain", domain.trim());
    router.push("/processing");
  };

  const examples = ["Starbucks India", "Your Bengaluru Coffee Chain", "Nykaa", "Swiggy", "Zepto"];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex flex-col">

      {/* Header */}
      <header className="px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <span className="text-white font-semibold text-lg tracking-tight">BrandEcho</span>
        </div>
        <span className="text-blue-400 text-sm font-medium px-3 py-1 rounded-full border border-blue-800 bg-blue-950/50">
          Phase 1 MVP
        </span>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div className="max-w-2xl w-full mx-auto text-center">

          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-950/60 border border-blue-700/50 text-blue-300 text-sm mb-8">
            <Sparkles className="w-4 h-4" />
            <span>AEO + GEO + SEO — all in one, fully automated</span>
          </div>

          {/* Headline */}
          <h1 className="text-5xl font-bold text-white mb-4 leading-tight">
            Type your brand name.
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">
              Get your full strategy.
            </span>
          </h1>

          <p className="text-slate-400 text-lg mb-10 max-w-xl mx-auto">
            Auto-discovers competitors, generates AI personas, creates 75+ targeted queries,
            and delivers a complete AEO + SEO playbook — in under 45 seconds.
          </p>

          {/* Form */}
          <form onSubmit={handleSubmit} className="w-full max-w-xl mx-auto">
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 space-y-4">

              {/* Brand Name Input */}
              <div>
                <label className="block text-sm text-slate-400 mb-2 text-left">Brand Name *</label>
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                  <input
                    type="text"
                    value={brandName}
                    onChange={(e) => { setBrandName(e.target.value); setError(""); }}
                    placeholder="e.g. Starbucks India, Nykaa, your startup name..."
                    className="w-full pl-12 pr-4 py-4 bg-white/10 border border-white/20 rounded-xl text-white placeholder-slate-500 text-base focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                    autoFocus
                  />
                </div>
              </div>

              {/* Domain Input (optional) */}
              <div>
                <label className="block text-sm text-slate-400 mb-2 text-left">
                  Website Domain <span className="text-slate-600">(optional — speeds up analysis)</span>
                </label>
                <div className="relative">
                  <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                  <input
                    type="url"
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    placeholder="https://yourbrand.com"
                    className="w-full pl-12 pr-4 py-4 bg-white/10 border border-white/20 rounded-xl text-white placeholder-slate-500 text-base focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                  />
                </div>
              </div>

              {/* Error */}
              {error && (
                <p className="text-red-400 text-sm text-left">{error}</p>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={isLoading || !brandName.trim()}
                className="w-full py-4 px-6 rounded-xl font-semibold text-base flex items-center justify-center gap-3 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white shadow-lg shadow-blue-900/30"
              >
                {isLoading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Starting analysis...</span>
                  </>
                ) : (
                  <>
                    <Bot className="w-5 h-5" />
                    <span>Run Full AEO + SEO Analysis</span>
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Quick examples */}
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <span className="text-slate-500 text-sm">Try:</span>
            {examples.map((ex) => (
              <button
                key={ex}
                onClick={() => setBrandName(ex)}
                className="text-sm text-blue-400 hover:text-blue-300 underline underline-offset-2 transition-colors"
              >
                {ex}
              </button>
            ))}
          </div>
        </div>
      </main>

      {/* Feature pills */}
      <footer className="pb-12 px-6">
        <div className="max-w-2xl mx-auto flex flex-wrap justify-center gap-3">
          {[
            { icon: Bot, label: "8 AI Engines" },
            { icon: TrendingUp, label: "Revenue Scoring" },
            { icon: Globe, label: "AEO + GEO + SEO" },
            { icon: Sparkles, label: "Smart Recommendations" },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-slate-400 text-sm">
              <Icon className="w-4 h-4 text-blue-400" />
              {label}
            </div>
          ))}
        </div>
      </footer>
    </div>
  );
}
