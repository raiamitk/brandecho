"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";

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
  const started = useRef(false);

  const updateStep = (id: string, status: Step["status"], detail?: string) =>
    setSteps(prev => prev.map(s => s.id === id ? { ...s, status, ...(detail ? { detail } : {}) } : s));

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const name   = sessionStorage.getItem("brand_name")   || "";
    const domain = sessionStorage.getItem("brand_domain") || "";
    setBrandName(name);
    if (!name) { router.push("/"); return; }
    runDiscovery(name, domain);
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
          if (event.type === "complete") { sessionStorage.setItem("brand_id", event.brand_id); setTimeout(() => router.push("/dashboard"), 600); }
          if (event.type === "error") setError(event.message);
        }
      }
    } catch (err) { setError(err instanceof Error ? err.message : "Something went wrong."); }
  };

  const done     = steps.filter(s => s.status === "done").length;
  const progress = Math.round((done / steps.length) * 100);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12" style={{ background: "#141414" }}>
      <div className="max-w-lg w-full">
        <div className="text-center mb-10">
          <div className="flex justify-center mb-4">
            <img src="/logo.svg" alt="BrandEcho" style={{ height: "44px", width: "auto" }} />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Analysing <span style={{ color: "#00FF96" }}>{brandName}</span></h1>
          <p className="text-gray-500 text-sm">Running AI agents — about 30–45 seconds</p>
        </div>

        <div className="mb-8">
          <div className="flex justify-between text-xs text-gray-600 mb-2"><span>{done} of {steps.length} complete</span><span>{progress}%</span></div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "#2a2a2a" }}>
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progress}%`, background: "#00FF96" }} />
          </div>
        </div>

        <div className="space-y-2">
          {steps.map(step => (
            <div key={step.id} className="flex items-start gap-4 p-4 rounded-xl border transition-all duration-300" style={{
              background: step.status === "running" ? "rgba(0,255,150,0.05)" : "#1c1c1c",
              borderColor: step.status === "running" ? "rgba(0,255,150,0.4)" : step.status === "done" ? "rgba(0,255,150,0.15)" : "#2a2a2a",
            }}>
              <div className="mt-0.5 flex-shrink-0">
                {step.status === "done"    && <CheckCircle2 className="w-5 h-5" style={{ color: "#00FF96" }} />}
                {step.status === "running" && <Loader2 className="w-5 h-5 animate-spin" style={{ color: "#00FF96" }} />}
                {step.status === "error"   && <XCircle className="w-5 h-5 text-red-400" />}
                {step.status === "pending" && <div className="w-5 h-5 rounded-full border-2" style={{ borderColor: "#2a2a2a" }} />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium" style={{ color: ["done","running"].includes(step.status) ? "#00FF96" : "#555" }}>{step.label}</p>
                {step.status !== "pending" && <p className="text-xs text-gray-600 mt-0.5 truncate">{step.detail}</p>}
              </div>
            </div>
          ))}
        </div>

        {error && (
          <div className="mt-6 p-4 rounded-xl border border-red-900/50 bg-red-950/30 text-red-300 text-sm">
            <p className="font-medium mb-1">Something went wrong</p>
            <p className="text-red-400/80 mb-2">{error}</p>
            <button onClick={() => router.push("/")} className="text-sm underline">Go back and try again</button>
          </div>
        )}
      </div>
    </div>
  );
}
