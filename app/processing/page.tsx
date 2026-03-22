"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { saveBrand, loadSavedBrands } from "@/app/brands/page";

const A  = "#00FF96";
const AT = "#059669";

interface Step { id: string; label: string; detail: string; status: "pending"|"running"|"done"|"error"; }

const INITIAL_STEPS: Step[] = [
  { id: "brand",       label: "Brand profile",       detail: "Identifying brand & industry",   status: "pending" },
  { id: "domain",      label: "Domain",               detail: "Finding official presence",      status: "pending" },
  { id: "competitors", label: "Competitors",          detail: "6 direct + category rivals",     status: "pending" },
  { id: "personas",    label: "Buyer personas",       detail: "3 customer archetypes",          status: "pending" },
  { id: "queries",     label: "Target queries",       detail: "AEO, GEO & SEO long-tail",       status: "pending" },
  { id: "recs",        label: "Recommendations",      detail: "Prioritised action plan",        status: "pending" },
  { id: "save",        label: "Saving",               detail: "Storing in database",            status: "pending" },
];

// ── Live discovery data types ────────────────────────────────────────────────
interface LiveBrand       { domain: string; industry: string; description: string; }
interface LiveCompetitor  { name: string; domain: string; type: string; }
interface LivePersona     { name: string; archetype: string; age_range: string; income_level: string; pain_points: string[]; }
interface LiveQuery       { text: string; type: string; revenue_proximity: number; }
interface LiveRec         { title: string; priority: string; projected_lift: string; }

const INCOME_COLOR: Record<string, { bg: string; color: string }> = {
  budget:  { bg: "#fef9c3", color: "#a16207" },
  mid:     { bg: "#e0f2fe", color: "#0369a1" },
  premium: { bg: "#f3e8ff", color: "#7e22ce" },
};
const TYPE_COLOR: Record<string, { bg: string; color: string }> = {
  aeo:          { bg: "#f0fdf4", color: "#15803d" },
  geo:          { bg: "#ecfdf5", color: "#059669" },
  seo:          { bg: "#eff6ff", color: "#1d4ed8" },
  seo_longtail: { bg: "#eff6ff", color: "#1d4ed8" },
};
const PRIORITY_COLOR: Record<string, string> = { high: "#ef4444", medium: "#f97316", low: "#22c55e" };

// ── Pulse skeleton ───────────────────────────────────────────────────────────
const Skeleton = ({ w = "100%", h = 16, r = 6 }: { w?: string | number; h?: number; r?: number }) => (
  <div style={{ width: w, height: h, borderRadius: r, background: "#f3f4f6", animation: "pulse 1.5s ease-in-out infinite" }} />
);

export default function ProcessingPage() {
  const router = useRouter();

  const [steps,       setSteps]       = useState<Step[]>(INITIAL_STEPS);
  const [error,       setError]       = useState("");
  const [brandName,   setBrandName]   = useState("");
  const [brandDomain, setBrandDomain] = useState("");

  // Live widgets state
  const [liveBrand,       setLiveBrand]       = useState<LiveBrand | null>(null);
  const [liveCompetitors, setLiveCompetitors] = useState<LiveCompetitor[]>([]);
  const [livePersonas,    setLivePersonas]    = useState<LivePersona[]>([]);
  const [liveQueries,     setLiveQueries]     = useState<LiveQuery[]>([]);
  const [liveRecs,        setLiveRecs]        = useState<LiveRec[]>([]);

  const started = useRef(false);

  const updateStep = (id: string, status: Step["status"], detail?: string) =>
    setSteps(prev => prev.map(s => s.id === id ? { ...s, status, ...(detail ? { detail } : {}) } : s));

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const domain = sessionStorage.getItem("brand_domain") || "";
    const name   = sessionStorage.getItem("brand_name")   || "";
    if (!domain && !name) { router.push("/"); return; }
    const displayName = name || domain.replace(/https?:\/\/(www\.)?/, "").split(".")[0];
    setBrandName(displayName);
    setBrandDomain(domain);

    // No client-side fast-path — the server-side Supabase cache in /api/discover
    // handles previously-scanned brands instantly (< 1s). Skipping the client
    // cache avoids stale localStorage IDs pointing to deleted Supabase records.
    runDiscovery(displayName, domain);
  }, []);

  const runDiscovery = async (name: string, domain: string) => {
    try {
      const res = await fetch("/api/discover", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brand_name: name, domain }),
      });
      if (!res.ok || !res.body) throw new Error("Discovery API failed");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        const lines = decoder.decode(value).split("\n").filter(l => l.startsWith("data: "));
        for (const line of lines) {
          const json = line.replace("data: ", "").trim();
          if (!json || json === "[DONE]") continue;
          const event = JSON.parse(json);

          if (event.type === "step_update") {
            updateStep(event.step_id, event.status, event.detail);
          }

          // Live data events — populate widgets instantly
          if (event.type === "data") {
            if (event.key === "brand")       setLiveBrand(event.payload);
            if (event.key === "competitors") setLiveCompetitors(event.payload);
            if (event.key === "personas")    setLivePersonas(event.payload);
            if (event.key === "queries")     setLiveQueries(event.payload);
            if (event.key === "recs")        setLiveRecs(event.payload);
          }

          if (event.type === "complete") {
            const finalName   = event.brand_name   || sessionStorage.getItem("brand_name")   || name;
            const finalDomain = event.brand_domain || sessionStorage.getItem("brand_domain") || domain;
            sessionStorage.setItem("brand_id",   event.brand_id);
            sessionStorage.setItem("brand_name", finalName);
            saveBrand({
              id:         event.brand_id,
              name:       finalName,
              industry:   event.industry || liveBrand?.industry || "",
              domain:     finalDomain,
              scanned_at: new Date().toISOString(),
            });
            setTimeout(() => router.push("/dashboard"), 800);
          }
          if (event.type === "error") setError(event.message);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  };

  const done     = steps.filter(s => s.status === "done").length;
  const progress = Math.round((done / steps.length) * 100);
  const scanning = !error && done < steps.length;

  return (
    <div style={{ minHeight: "100vh", background: "#fafafa", display: "flex", flexDirection: "column" }}>
      <style>{`
        @keyframes spin  { to { transform: rotate(360deg) } }
        @keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:0.4 } }
        @keyframes fadein { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:translateY(0) } }
        .widget { animation: fadein 0.4s ease forwards; }
      `}</style>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header style={{ padding: "14px 28px", borderBottom: "1px solid #e5e7eb",
        background: "#fff", display: "flex", alignItems: "center", gap: 12 }}>
        <img src="/logo.svg" alt="BrandEcho" style={{ height: 26 }} />
        <span style={{ color: "#d1d5db" }}>|</span>
        <span style={{ fontSize: 13, color: "#6b7280" }}>
          Analysing <strong style={{ color: "#111827" }}>{brandName}</strong>
          {brandDomain && <span style={{ color: "#9ca3af" }}> · {brandDomain}</span>}
        </span>
      </header>

      {/* ── Body ───────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "340px 1fr",
        maxWidth: 1200, margin: "0 auto", width: "100%", padding: "28px 24px", gap: 28 }}>

        {/* ══ LEFT — Progress steps ════════════════════════════════════════ */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Progress bar */}
          <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: "18px 20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>
                {scanning ? "Scanning…" : done === steps.length ? "Complete!" : "Error"}
              </span>
              <span style={{ fontSize: 13, fontWeight: 700, color: AT }}>{progress}%</span>
            </div>
            <div style={{ height: 8, borderRadius: 99, background: "#e5e7eb", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${progress}%`, background: A,
                borderRadius: 99, transition: "width 0.5s ease" }} />
            </div>
            <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 8 }}>
              {done} of {steps.length} steps complete
            </div>
          </div>

          {/* Steps list */}
          <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16,
            overflow: "hidden", display: "flex", flexDirection: "column" }}>
            {steps.map((step, i) => (
              <div key={step.id} style={{
                display: "flex", alignItems: "flex-start", gap: 12,
                padding: "12px 16px",
                borderTop: i > 0 ? "1px solid #f3f4f6" : "none",
                background: step.status === "running" ? "rgba(0,255,150,0.05)" : "#fff",
              }}>
                <div style={{ marginTop: 1, flexShrink: 0 }}>
                  {step.status === "done"    && <CheckCircle2 style={{ width: 18, height: 18, color: AT }} />}
                  {step.status === "running" && <Loader2 style={{ width: 18, height: 18, color: AT, animation: "spin 0.8s linear infinite" }} />}
                  {step.status === "error"   && <XCircle style={{ width: 18, height: 18, color: "#ef4444" }} />}
                  {step.status === "pending" && <div style={{ width: 18, height: 18, borderRadius: "50%", border: "2px solid #d1d5db" }} />}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600,
                    color: step.status === "pending" ? "#9ca3af" : "#111827" }}>
                    {step.label}
                  </div>
                  {step.status !== "pending" && (
                    <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 1 }}>{step.detail}</div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Error */}
          {error && (
            <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 16,
              padding: "16px 18px", fontSize: 13, color: "#dc2626" }}>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>Something went wrong</div>
              <div style={{ opacity: 0.8, marginBottom: 10 }}>{error}</div>
              <button onClick={() => router.push("/")}
                style={{ fontSize: 12, fontWeight: 700, color: "#dc2626",
                  textDecoration: "underline", background: "none", border: "none", cursor: "pointer" }}>
                ← Go back and try again
              </button>
            </div>
          )}
        </div>

        {/* ══ RIGHT — Live discovery widgets ═══════════════════════════════ */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* ── Brand card ───────────────────────────────────── mint green */}
          <div className={liveBrand ? "widget" : ""}
            style={{ background: liveBrand ? "#f0fdf4" : "#fff",
              border: `1px solid ${liveBrand ? "#86efac" : "#e5e7eb"}`,
              borderRadius: 16, padding: "18px 20px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#15803d",
              textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 10 }}>
              🏢 Brand Profile
            </div>
            {liveBrand ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 16, fontWeight: 800, color: "#111827" }}>{brandName}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 10px",
                    borderRadius: 99, background: "#dcfce7", color: "#15803d" }}>
                    {liveBrand.industry}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: "#374151", lineHeight: 1.55 }}>{liveBrand.description}</div>
                <div style={{ fontSize: 11, color: "#6b7280" }}>🌐 {liveBrand.domain}</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <Skeleton w="60%" h={20} />
                <Skeleton w="100%" h={14} />
                <Skeleton w="80%" h={14} />
              </div>
            )}
          </div>

          {/* ── Competitors ────────────────────────────────── warm orange */}
          <div className={liveCompetitors.length ? "widget" : ""}
            style={{ background: liveCompetitors.length ? "#fff7ed" : "#fff",
              border: `1px solid ${liveCompetitors.length ? "#fdba74" : "#e5e7eb"}`,
              borderRadius: 16, padding: "18px 20px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#ea580c",
              textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 10 }}>
              ⚔️ Competitors Identified
            </div>
            {liveCompetitors.length ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {liveCompetitors.map((c, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 6,
                    background: "#fff", border: "1px solid #fed7aa", borderRadius: 10,
                    padding: "6px 12px" }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{c.name}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 99,
                      background: c.type === "direct" ? "#fef2f2" : "#f5f3ff",
                      color:      c.type === "direct" ? "#dc2626"  : "#7c3aed" }}>
                      {c.type === "direct" ? "Direct" : "Alt"}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {[80, 110, 90, 120, 95, 105].map((w, i) => <Skeleton key={i} w={w} h={32} r={10} />)}
              </div>
            )}
          </div>

          {/* ── Personas ───────────────────────────────────── soft lavender */}
          <div className={livePersonas.length ? "widget" : ""}
            style={{ background: livePersonas.length ? "#faf5ff" : "#fff",
              border: `1px solid ${livePersonas.length ? "#c4b5fd" : "#e5e7eb"}`,
              borderRadius: 16, padding: "18px 20px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#7c3aed",
              textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 10 }}>
              👤 Buyer Personas
            </div>
            {livePersonas.length ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
                {livePersonas.map((p, i) => {
                  const ic = INCOME_COLOR[p.income_level] || INCOME_COLOR.mid;
                  return (
                    <div key={i} style={{ background: "#fff", border: "1px solid #e9d5ff",
                      borderRadius: 12, padding: "12px 14px" }}>
                      <div style={{ width: 32, height: 32, borderRadius: "50%",
                        background: "#7c3aed", color: "#fff", fontWeight: 800, fontSize: 14,
                        display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 8 }}>
                        {p.name.charAt(4).toUpperCase()}
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#111827", marginBottom: 2 }}>{p.name}</div>
                      <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 6 }}>{p.age_range} · {p.archetype}</div>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px",
                        borderRadius: 99, background: ic.bg, color: ic.color }}>
                        {p.income_level}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
                {[1,2,3].map(i => (
                  <div key={i} style={{ background: "#fafafa", border: "1px solid #f3f4f6", borderRadius: 12, padding: "12px 14px" }}>
                    <Skeleton w={32} h={32} r={99} /><div style={{height:6}}/><Skeleton w="70%" h={14} /><div style={{height:4}}/><Skeleton w="50%" h={11} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Queries ────────────────────────────────────── sky blue */}
          <div className={liveQueries.length ? "widget" : ""}
            style={{ background: liveQueries.length ? "#eff6ff" : "#fff",
              border: `1px solid ${liveQueries.length ? "#93c5fd" : "#e5e7eb"}`,
              borderRadius: 16, padding: "18px 20px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#2563eb",
              textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 10 }}>
              🔍 Target Queries ({liveQueries.length || "—"})
            </div>
            {liveQueries.length ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {liveQueries.slice(0, 6).map((q, i) => {
                  const tc = TYPE_COLOR[q.type] || TYPE_COLOR.seo;
                  return (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 8,
                      background: "#fff", border: "1px solid #bfdbfe", borderRadius: 10,
                      padding: "8px 12px" }}>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 7px",
                        borderRadius: 99, background: tc.bg, color: tc.color, flexShrink: 0, whiteSpace: "nowrap" }}>
                        {q.type === "seo_longtail" ? "SEO" : q.type.toUpperCase()}
                      </span>
                      <span style={{ fontSize: 12, color: "#374151", flex: 1, minWidth: 0,
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {q.text}
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#2563eb",
                        background: "#dbeafe", padding: "1px 7px", borderRadius: 99, flexShrink: 0 }}>
                        {q.revenue_proximity}%
                      </span>
                    </div>
                  );
                })}
                {liveQueries.length > 6 && (
                  <div style={{ fontSize: 12, color: "#9ca3af", textAlign: "center", marginTop: 2 }}>
                    +{liveQueries.length - 6} more in dashboard
                  </div>
                )}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {[1,2,3,4].map(i => <Skeleton key={i} h={34} r={10} />)}
              </div>
            )}
          </div>

          {/* ── Recommendations ─────────────────────────────── amber */}
          {liveRecs.length > 0 && (
            <div className="widget"
              style={{ background: "#fefce8", border: "1px solid #fde68a", borderRadius: 16, padding: "18px 20px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#ca8a04",
                textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 10 }}>
                💡 Quick Wins
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {liveRecs.map((r, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10,
                    background: "#fff", border: "1px solid #fde68a", borderRadius: 10,
                    padding: "10px 14px" }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", flexShrink: 0,
                      background: PRIORITY_COLOR[r.priority] || "#9ca3af" }} />
                    <span style={{ fontSize: 13, color: "#111827", flex: 1 }}>{r.title}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#ca8a04",
                      background: "#fef9c3", padding: "1px 8px", borderRadius: 99, flexShrink: 0 }}>
                      {r.projected_lift}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Redirecting notice */}
          {done === steps.length && !error && (
            <div className="widget" style={{ background: "#f0fdf4", border: "1px solid #86efac",
              borderRadius: 16, padding: "16px 20px", display: "flex", alignItems: "center", gap: 12 }}>
              <Loader2 style={{ width: 18, height: 18, color: AT, animation: "spin 0.8s linear infinite", flexShrink: 0 }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: AT }}>Opening your dashboard…</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
