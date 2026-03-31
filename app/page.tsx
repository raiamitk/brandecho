"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight, Bot, Eye, Sparkles, BarChart2, Gauge, Globe,
  Building2, TrendingUp, Zap,
} from "lucide-react";
import { loadSavedBrands, type SavedBrand } from "@/app/brands/page";

const A  = "#00FF96";
const AT = "#059669";

// ── Derive brand name from a URL ─────────────────────────────────────────────
// Handles product URLs like /collections/surf, /brands/dove, /products/omo
const PATH_PREFIXES = ["collections","brands","products","product","brand","shop","range","line","series"];

function deriveBrandName(url: string): string {
  try {
    const raw      = url.startsWith("http") ? url : `https://${url}`;
    const parsed   = new URL(raw);
    const hostname = parsed.hostname.replace(/^www\./, "");
    const segments = parsed.pathname.split("/").filter(Boolean);

    // If path has a known category prefix followed by a name, use that name
    for (let i = 0; i < segments.length - 1; i++) {
      if (PATH_PREFIXES.includes(segments[i].toLowerCase())) {
        const name = segments[i + 1];
        return name.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
      }
    }

    // Fall back to first meaningful hostname segment
    const part = hostname.split(".")[0].replace(/-/g, " ");
    return part.replace(/\b\w/g, c => c.toUpperCase());
  } catch {
    return url.replace(/https?:\/\/(www\.)?/, "").split(".")[0] || url;
  }
}

// ── Feature card data ─────────────────────────────────────────────────────────
const FEATURES = [
  {
    Icon: Zap,
    color: A,
    title: "Brand Intelligence",
    tag: "Core — always included",
    desc: "Auto-discovers your industry, 6 competitors, 3 buyer personas, and 15 targeted queries (TOFU/MOFU/BOFU) ranked by purchase intent.",
  },
  {
    Icon: Bot,
    color: "#06b6d4",
    title: "AI Answer Preview",
    tag: "Live Gemini check",
    desc: "Fetches real Gemini answers for each query. Highlights where your brand is mentioned — and where competitors steal the slot.",
  },
  {
    Icon: Eye,
    color: "#00FF96",
    title: "AI Visibility Score",
    tag: "0–100 per query",
    desc: "Scores every query for how likely ChatGPT, Perplexity, and Gemini are to cite your brand — using Claude + web authority signals.",
  },
  {
    Icon: Sparkles,
    color: "#fbbf24",
    title: "Content Briefs",
    tag: "Ready-to-publish",
    desc: "AI-optimised content briefs for your top 5 revenue queries — titles, H2s, key points, citation hooks, and schema markup.",
  },
  {
    Icon: BarChart2,
    color: "#f87171",
    title: "Competitor Gap",
    tag: "AI citation gaps",
    desc: "Pinpoints every query where competitors appear in AI answers but your brand doesn't — with a specific action to close each gap.",
  },
  {
    Icon: Gauge,
    color: "#818cf8",
    title: "Technical Audit",
    tag: "PageSpeed + Schema",
    desc: "Mobile & desktop Core Web Vitals, schema markup gaps, and domain authority vs competitors — all with AEO impact scores.",
  },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [url,          setUrl]          = useState("");
  const [brandOverride,setBrandOverride]= useState("");   // user-editable brand name
  const [isLoading,    setIsLoading]    = useState(false);
  const [error,        setError]        = useState("");
  const [savedBrands,  setSavedBrands]  = useState<SavedBrand[]>([]);
  const [country,      setCountry]      = useState("India");
  const [city,         setCity]         = useState("");

  useEffect(() => { setSavedBrands(loadSavedBrands().slice(0, 4)); }, []);

  // Auto-populate brand name when URL changes
  const handleUrlChange = (val: string) => {
    setUrl(val);
    setError("");
    if (val.trim()) {
      const derived = deriveBrandName(val.trim());
      setBrandOverride(derived);
    } else {
      setBrandOverride("");
    }
  };

  // Core submit logic — separated so pills can call it directly
  const submitUrl = (rawUrl: string, rawBrand?: string) => {
    const trimmed = rawUrl.trim();
    if (!trimmed) { setError("Please enter your website URL"); return; }
    const normalised = trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
    let hostname = "";
    try { hostname = new URL(normalised).hostname; }
    catch { setError("Invalid URL — try https://yourbrand.com"); return; }
    const brandName = (rawBrand || brandOverride || deriveBrandName(normalised)).trim();
    setIsLoading(true);
    setError("");
    sessionStorage.setItem("brand_name",     brandName);
    sessionStorage.setItem("brand_domain",   normalised);
    sessionStorage.setItem("brand_hostname", hostname);
    sessionStorage.setItem("brand_country", country);
    sessionStorage.setItem("brand_city",    city);
    router.push("/processing");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitUrl(url);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#fff", display: "flex", flexDirection: "column" }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header style={{ padding: "18px 32px", display: "flex", alignItems: "center",
        justifyContent: "space-between", borderBottom: "1px solid #e5e7eb" }}>
        <img src="/logo.svg" alt="BrandEcho" style={{ height: 30 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {savedBrands.length > 0 && (
            <button onClick={() => router.push("/brands")}
              style={{ fontSize: 13, fontWeight: 600, color: AT, background: "none",
                border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
              <Building2 style={{ width: 14, height: 14 }} /> My Brands
            </button>
          )}
          <span style={{ fontSize: 12, fontWeight: 600, padding: "4px 12px",
            borderRadius: 99, border: `1px solid ${A}`, color: AT,
            background: "rgba(0,255,150,0.08)" }}>
            Free · No signup
          </span>
        </div>
      </header>

      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <main style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
        padding: "60px 24px 40px", maxWidth: 1100, margin: "0 auto", width: "100%" }}>

        {/* Badge */}
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 16px",
          borderRadius: 99, border: "1px solid rgba(0,255,150,0.4)",
          background: "rgba(0,255,150,0.07)", color: AT, fontSize: 13, fontWeight: 600, marginBottom: 28 }}>
          <Bot style={{ width: 14, height: 14 }} />
          AEO + GEO + SEO — automated in one click
        </div>

        {/* Headline */}
        <h1 style={{ fontSize: 48, fontWeight: 800, color: "#111827", textAlign: "center",
          lineHeight: 1.15, marginBottom: 16, maxWidth: 680 }}>
          Paste your URL.
          <span style={{ display: "block",
            background: "linear-gradient(135deg,#00FF96,#00b36b)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Get your AI visibility playbook.
          </span>
        </h1>

        <p style={{ fontSize: 18, color: "#6b7280", textAlign: "center",
          maxWidth: 560, lineHeight: 1.6, marginBottom: 40 }}>
          Enter your website and BrandEcho auto-discovers your brand, competitors
          &amp; personas — then tells you exactly where you appear in AI answers.
        </p>

        {/* ── URL Form ─────────────────────────────────────────────────────── */}
        <form onSubmit={handleSubmit} style={{ width: "100%", maxWidth: 580, marginBottom: 12 }}>
          <div style={{ display: "flex", gap: 0, background: "#fff",
            border: "2px solid #e5e7eb", borderRadius: 16, overflow: "hidden",
            boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
            transition: "border-color 0.2s" }}
            onFocusCapture={e => (e.currentTarget as HTMLElement).style.borderColor = A}
            onBlurCapture={e  => (e.currentTarget as HTMLElement).style.borderColor = "#e5e7eb"}>
            <div style={{ display: "flex", alignItems: "center", paddingLeft: 16, flexShrink: 0 }}>
              <Globe style={{ width: 20, height: 20, color: "#9ca3af" }} />
            </div>
            <input
              type="text"
              value={url}
              onChange={e => handleUrlChange(e.target.value)}
              placeholder="yourbrand.com  or  paste any product URL"
              autoFocus
              style={{ flex: 1, padding: "18px 16px", fontSize: 16, border: "none",
                outline: "none", color: "#111827", background: "transparent" }}
            />
            <button type="submit" disabled={isLoading || !url.trim()}
              style={{ padding: "14px 28px", background: A, color: "#111", fontWeight: 700,
                fontSize: 15, border: "none", cursor: isLoading || !url.trim() ? "default" : "pointer",
                display: "flex", alignItems: "center", gap: 8,
                opacity: isLoading || !url.trim() ? 0.6 : 1,
                transition: "opacity 0.15s" }}>
              {isLoading ? (
                <>
                  <div style={{ width: 18, height: 18, border: "2px solid #111",
                    borderTopColor: "transparent", borderRadius: "50%",
                    animation: "spin 0.8s linear infinite" }} />
                  Analysing…
                </>
              ) : (
                <>Analyse <ArrowRight style={{ width: 18, height: 18 }} /></>
              )}
            </button>
          </div>
          {/* Brand name override — auto-filled but always editable */}
          {brandOverride && (
            <div style={{ display: "flex", alignItems: "center", gap: 8,
              marginTop: 10, padding: "8px 14px",
              background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 10 }}>
              <span style={{ fontSize: 12, color: AT, fontWeight: 600, whiteSpace: "nowrap" }}>
                Brand name:
              </span>
              <input
                type="text"
                value={brandOverride}
                onChange={e => setBrandOverride(e.target.value)}
                style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "#111827",
                  background: "transparent", border: "none", outline: "none" }}
              />
              <span style={{ fontSize: 11, color: "#6b7280", whiteSpace: "nowrap" }}>
                ✏️ edit if wrong
              </span>
            </div>
          )}

          {/* Geo selector */}
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <select
              value={country}
              onChange={e => setCountry(e.target.value)}
              style={{ flex: 1, padding: "8px 12px", fontSize: 13, border: "1px solid #e5e7eb",
                borderRadius: 10, background: "#fff", color: "#374151", cursor: "pointer" }}>
              {["India","United States","United Kingdom","Australia","Canada","Singapore","UAE","Germany","France","Japan","Brazil","South Africa"].map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <input
              type="text"
              value={city}
              onChange={e => setCity(e.target.value)}
              placeholder="City (optional)"
              style={{ flex: 1, padding: "8px 12px", fontSize: 13, border: "1px solid #e5e7eb",
                borderRadius: 10, outline: "none", color: "#374151" }}
            />
          </div>

          {error && (
            <p style={{ color: "#dc2626", fontSize: 13, marginTop: 8, paddingLeft: 4 }}>{error}</p>
          )}
        </form>

        {/* Quick examples — clicking auto-submits */}
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center",
          gap: 8, marginBottom: 64 }}>
          <span style={{ fontSize: 13, color: "#9ca3af", marginRight: 4, lineHeight: "30px" }}>Try:</span>
          {[
            { url: "nykaa.com",      brand: "Nykaa"    },
            { url: "swiggy.com",     brand: "Swiggy"   },
            { url: "zepto.com",      brand: "Zepto"    },
            { url: "zerodha.com",    brand: "Zerodha"  },
            { url: "myntra.com",     brand: "Myntra"   },
          ].map(ex => (
            <button key={ex.url} onClick={() => { setUrl(ex.url); setBrandOverride(ex.brand); submitUrl(ex.url, ex.brand); }}
              style={{ fontSize: 13, fontWeight: 600, color: AT, background: "none",
                border: "1px solid rgba(0,200,120,0.3)", borderRadius: 99, padding: "4px 12px",
                cursor: "pointer", transition: "border-color 0.15s, background 0.15s" }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.background = "rgba(0,255,150,0.07)";
                (e.currentTarget as HTMLElement).style.borderColor = A;
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.background = "none";
                (e.currentTarget as HTMLElement).style.borderColor = "rgba(0,200,120,0.3)";
              }}>
              {ex.brand}
            </button>
          ))}
        </div>

        {/* ── What's included ──────────────────────────────────────────────── */}
        <div style={{ width: "100%", textAlign: "center", marginBottom: 28 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 12,
            fontSize: 12, fontWeight: 700, color: "#9ca3af",
            textTransform: "uppercase", letterSpacing: "1px" }}>
            <div style={{ flex: 1, height: 1, width: 60, background: "#e5e7eb" }} />
            Everything included in one scan
            <div style={{ flex: 1, height: 1, width: 60, background: "#e5e7eb" }} />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16,
          width: "100%", marginBottom: 56 }}>
          {FEATURES.map(({ Icon, color, title, tag, desc }) => (
            <div key={title} style={{ background: "#f9fafb", border: "1px solid #e5e7eb",
              borderRadius: 18, padding: "22px 24px",
              transition: "border-color 0.2s, box-shadow 0.2s", cursor: "default" }}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLElement;
                el.style.borderColor = color;
                el.style.boxShadow = `0 4px 20px ${color}25`;
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLElement;
                el.style.borderColor = "#e5e7eb";
                el.style.boxShadow = "none";
              }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                <div style={{ width: 44, height: 44, borderRadius: 14,
                  background: `${color}18`, display: "flex", alignItems: "center",
                  justifyContent: "center", flexShrink: 0 }}>
                  <Icon style={{ width: 22, height: 22, color }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#111827", marginBottom: 3 }}>
                    {title}
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 700, color, textTransform: "uppercase",
                    letterSpacing: "0.4px", marginBottom: 8 }}>
                    {tag}
                  </div>
                  <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.55 }}>
                    {desc}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Recent Brands strip ──────────────────────────────────────────── */}
        {savedBrands.length > 0 && (
          <div style={{ width: "100%", maxWidth: 680, background: "#f9fafb",
            border: "1px solid #e5e7eb", borderRadius: 16, padding: "16px 20px" }}>
            <div style={{ display: "flex", alignItems: "center",
              justifyContent: "space-between", marginBottom: 12 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#9ca3af",
                textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Recent Brands
              </span>
              <button onClick={() => router.push("/brands")}
                style={{ fontSize: 12, color: AT, fontWeight: 600,
                  background: "none", border: "none", cursor: "pointer" }}>
                View all →
              </button>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {savedBrands.map(b => (
                <button key={b.id} onClick={() => {
                  sessionStorage.setItem("brand_id", b.id);
                  router.push("/dashboard");
                }} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 14px",
                  background: "#fff", border: "1px solid #e5e7eb", borderRadius: 99,
                  cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#111827",
                  transition: "border-color 0.15s" }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = A}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = "#e5e7eb"}>
                  <div style={{ width: 20, height: 20, borderRadius: "50%", background: A,
                    color: "#111", fontWeight: 800, fontSize: 10,
                    display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {b.name.charAt(0).toUpperCase()}
                  </div>
                  {b.name}
                  <TrendingUp style={{ width: 12, height: 12, color: "#9ca3af" }} />
                </button>
              ))}
            </div>
          </div>
        )}
      </main>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer style={{ padding: "20px 32px", textAlign: "center",
        borderTop: "1px solid #e5e7eb", fontSize: 12, color: "#9ca3af" }}>
        Powered by Claude AI · Gemini · Google PageSpeed &nbsp;·&nbsp; No account required
      </footer>
    </div>
  );
}
