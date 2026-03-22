"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { saveBrand } from "@/app/brands/page";

const A  = "#00FF96";
const AT = "#059669";

interface Step { id: string; label: string; detail: string; status: "pending"|"running"|"done"|"error"; }

const INITIAL_STEPS: Step[] = [
  { id: "brand",       label: "Detecting brand & industry",   detail: "Using Claude to identify your brand profile",  status: "pending" },
  { id: "domain",      label: "Discovering official website", detail: "Finding your brand online presence",           status: "pending" },
  { id: "competitors", label: "Finding competitors",          detail: "6 direct + category competitors",              status: "pending" },
  { id: "personas",    label: "Generating user personas",     detail: "3 diverse customer archetypes",                status: "pending" },
  { id: "queries",     label: "Generating 15 queries",        detail: "AEO, GEO, and SEO long-tail",                  status: "pending" },
  { id: "recs",        label: "Building recommendations",     detail: "Prioritised action items",                     status: "pending" },
  { id: "save",        label: "Saving to database",           detail: "Storing results in Supabase",                  status: "pending" },
];

export default function ProcessingPage() {
  const router = useRouter();
  const [steps, setSteps]         = useState<Step[]>(INITIAL_STEPS);
  const [error, setError]         = useState("");
  const [brandName, setBrandName] = useState("");
  const [brandDomain, setBrandDomain] = useState("");
  const started = useRef(false);

  const updateStep = (id: string, status: Step["status"], detail?: string) =>
    setSteps(prev => prev.map(s => s.id === id ? { ...s, status, ...(detail ? { detail } : {}) } : s));

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const domain = sessionStorage.getItem("brand_domain") || "";
    const name   = sessionStorage.getItem("brand_name")   || "";
    // If nothing set (direct nav), redirect back
    if (!domain && !name) { router.push("/"); return; }
    // Prefer brand name derived from URL; fall back to raw name
    const displayName = name || domain.replace(/https?:\/\/(www\.)?/, "").split(".")[0];
    setBrandName(displayName);
    setBrandDomain(domain);
    runDiscovery(displayName, domain);
  }, []);

  const runDiscovery = async (name: string, domain: string) => {
    try {
      const res = await fetch("/api/discover", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brand_name: name, domain }),
      });
      if (!res.ok || !res.body) throw new Error("Discovery API failed");
      const reader = res.body.getReader(); const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        const lines = decoder.decode(value).split("\n").filter(l => l.startsWith("data: "));
        for (const line of lines) {
          const json = line.replace("data: ", "").trim();
          if (!json || json === "[DONE]") continue;
          const event = JSON.parse(json);
          if (event.type === "step_update") updateStep(event.step_id, event.status, event.detail);
          if (event.type === "complete") {
            sessionStorage.setItem("brand_id", event.brand_id);
            // Save to localStorage for multi-brand switcher
            saveBrand({
              id:         event.brand_id,
              name:       sessionStorage.getItem("brand_name") || "",
              industry:   event.industry || "",
              domain:     sessionStorage.getItem("brand_domain") || "",
              scanned_at: new Date().toISOString(),
            });
            setTimeout(() => router.push("/dashboard"), 600);
          }
          if (event.type === "error") setError(event.message);
        }
      }
    } catch (err) { setError(err instanceof Error ? err.message : "Something went wrong."); }
  };

  const done     = steps.filter(s => s.status === "done").length;
  const progress = Math.round((done / steps.length) * 100);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12" style={{ background: "#fff" }}>
      <div className="max-w-lg w-full">
        <div className="text-center mb-10">
          <div className="flex justify-center mb-5">
            <img src="/logo.svg" alt="BrandEcho" style={{ height: "44px", width: "auto" }} />
          </div>
          <h1 className="text-2xl font-bold mb-2" style={{ color: "#111827" }}>
            Analysing <span style={{ color: AT }}>{brandName}</span>
          </h1>
          <p className="text-sm" style={{ color: "#9ca3af" }}>
            {brandDomain && <span style={{ color: "#6b7280" }}>{brandDomain} &nbsp;·&nbsp; </span>}
            Running AI agents — about 30–45 seconds
          </p>
        </div>

        <div className="mb-8">
          <div className="flex justify-between text-xs mb-2" style={{ color: "#9ca3af" }}>
            <span>{done} of {steps.length} complete</span>
            <span style={{ color: AT, fontWeight: 600 }}>{progress}%</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: "#e5e7eb" }}>
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progress}%`, background: A }} />
          </div>
        </div>

        <div className="space-y-2">
          {steps.map(step => (
            <div key={step.id} className="flex items-start gap-4 p-4 rounded-xl border transition-all duration-300" style={{
              background: step.status === "running" ? "rgba(0,255,150,0.06)" : "#f9fafb",
              borderColor: step.status === "running" ? A : step.status === "done" ? "#d1fae5" : "#e5e7eb",
            }}>
              <div className="mt-0.5 flex-shrink-0">
                {step.status === "done"    && <CheckCircle2 className="w-5 h-5" style={{ color: AT }} />}
                {step.status === "running" && <Loader2 className="w-5 h-5 animate-spin" style={{ color: AT }} />}
                {step.status === "error"   && <XCircle className="w-5 h-5 text-red-500" />}
                {step.status === "pending" && <div className="w-5 h-5 rounded-full border-2" style={{ borderColor: "#d1d5db" }} />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium" style={{ color: ["done","running"].includes(step.status) ? "#111827" : "#9ca3af" }}>{step.label}</p>
                {step.status !== "pending" && <p className="text-xs mt-0.5 truncate" style={{ color: "#6b7280" }}>{step.detail}</p>}
              </div>
            </div>
          ))}
        </div>

        {error && (
          <div className="mt-6 p-4 rounded-xl border text-sm" style={{ background: "#fef2f2", borderColor: "#fecaca", color: "#dc2626" }}>
            <p className="font-medium mb-1">Something went wrong</p>
            <p className="mb-2 opacity-80">{error}</p>
            <button onClick={() => router.push("/")} className="underline text-sm">Go back and try again</button>
          </div>
        )}
      </div>
    </div>
  );
}
