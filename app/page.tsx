"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Bot, TrendingUp, Globe, ArrowRight, Sparkles } from "lucide-react";

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
    sessionStorage.setItem("brand_name", brandName.trim());
    sessionStorage.setItem("brand_domain", domain.trim());
    router.push("/processing");
  };

  const examples = ["Starbucks India", "Nykaa", "Swiggy", "Zepto", "Nivea"];

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#141414" }}>

      {/* Header */}
      <header className="px-6 py-5 flex items-center justify-between border-b" style={{ borderColor: "#2a2a2a" }}>
        <div className="flex items-center">
          <img src="/logo.svg" alt="BrandEcho" style={{ height: "34px", width: "auto" }} />
        </div>
        <span className="text-xs font-medium px-3 py-1 rounded-full border" style={{ color: "#00FF96", borderColor: "#00FF96", background: "rgba(0,255,150,0.08)" }}>
          Phase 1 MVP
        </span>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div className="max-w-2xl w-full mx-auto text-center">

          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm mb-8 border" style={{ color: "#00FF96", borderColor: "rgba(0,255,150,0.3)", background: "rgba(0,255,150,0.06)" }}>
            <Sparkles className="w-4 h-4" />
            <span>AEO + GEO + SEO — fully automated</span>
          </div>

          <h1 className="text-5xl font-bold text-white mb-4 leading-tight">
            Type your brand name.
            <span className="block gradient-text">Get your full strategy.</span>
          </h1>

          <p className="text-gray-400 text-lg mb-10 max-w-xl mx-auto">
            Auto-discovers competitors, generates AI personas, creates 15 targeted queries,
            and delivers a complete AEO + SEO playbook — in under 45 seconds.
          </p>

          <form onSubmit={handleSubmit} className="w-full max-w-xl mx-auto">
            <div className="rounded-2xl p-6 space-y-4 border" style={{ background: "#1c1c1c", borderColor: "#2a2a2a" }}>

              <div>
                <label className="block text-sm mb-2 text-left text-gray-400">Brand Name *</label>
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input
                    type="text"
                    value={brandName}
                    onChange={(e) => { setBrandName(e.target.value); setError(""); }}
                    placeholder="e.g. Nykaa, Swiggy, your startup name..."
                    className="w-full pl-12 pr-4 py-4 rounded-xl text-white placeholder-gray-600 text-base focus:outline-none transition-all"
                    style={{ background: "#141414", border: "1px solid #2a2a2a" }}
                    onFocus={e => e.target.style.borderColor = "#00FF96"}
                    onBlur={e => e.target.style.borderColor = "#2a2a2a"}
                    autoFocus
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm mb-2 text-left text-gray-400">
                  Website Domain <span className="text-gray-600">(optional)</span>
                </label>
                <div className="relative">
                  <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input
                    type="url"
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    placeholder="https://yourbrand.com"
                    className="w-full pl-12 pr-4 py-4 rounded-xl text-white placeholder-gray-600 text-base focus:outline-none transition-all"
                    style={{ background: "#141414", border: "1px solid #2a2a2a" }}
                    onFocus={e => e.target.style.borderColor = "#00FF96"}
                    onBlur={e => e.target.style.borderColor = "#2a2a2a"}
                  />
                </div>
              </div>

              {error && <p className="text-red-400 text-sm text-left">{error}</p>}

              <button
                type="submit"
                disabled={isLoading || !brandName.trim()}
                className="w-full py-4 px-6 rounded-xl font-bold text-base flex items-center justify-center gap-3 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: "#00FF96", color: "#141414" }}
                onMouseEnter={e => !isLoading && ((e.target as HTMLElement).style.background = "#00cc78")}
                onMouseLeave={e => !isLoading && ((e.target as HTMLElement).style.background = "#00FF96")}
              >
                {isLoading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                    <span>Running analysis...</span>
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

          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <span className="text-gray-600 text-sm">Try:</span>
            {examples.map((ex) => (
              <button key={ex} onClick={() => setBrandName(ex)}
                className="text-sm underline underline-offset-2 transition-colors"
                style={{ color: "#00FF96" }}>
                {ex}
              </button>
            ))}
          </div>
        </div>
      </main>

      <footer className="pb-12 px-6">
        <div className="max-w-2xl mx-auto flex flex-wrap justify-center gap-3">
          {[
            { icon: Bot, label: "8 AI Engines" },
            { icon: TrendingUp, label: "Revenue Scoring" },
            { icon: Globe, label: "AEO + GEO + SEO" },
            { icon: Sparkles, label: "Smart Recommendations" },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-2 px-4 py-2 rounded-full text-sm border text-gray-400"
              style={{ borderColor: "#2a2a2a", background: "#1c1c1c" }}>
              <Icon className="w-4 h-4" style={{ color: "#00FF96" }} />
              {label}
            </div>
          ))}
        </div>
      </footer>
    </div>
  );
}
