"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, XCircle, Zap } from "lucide-react";

interface Step {
  id: string;
  label: string;
  detail: string;
  status: "pending" | "running" | "done" | "error";
}

const INITIAL_STEPS: Step[] = [
  { id: "brand",       label: "Detecting brand & industry",     detail: "Using Grok to identify your brand profile",         status: "pending" },
  { id: "domain",      label: "Discovering official website",   detail: "Finding and verifying your brand's online presence", status: "pending" },
  { id: "competitors", label: "Finding competitors",            detail: "Identifying 6 direct + category competitors",        status: "pending" },
  { id: "personas",    label: "Generating user personas",       detail: "Creating 3 diverse customer archetypes",             status: "pending" },
  { id: "queries",     label: "Generating 75+ queries",         detail: "AEO, GEO, and SEO long-tail query generation",       status: "pending" },
  { id: "recs",        label: "Building recommendations",       detail: "Prioritising top action items for your brand",       status: "pending" },
  { id: "save",        label: "Saving to database",             detail: "Storing all results securely in Supabase",           status: "pending" },
];

export default function ProcessingPage() {
  const router  = useRouter();
  const [steps, setSteps]         = useState<Step[]>(INITIAL_STEPS);
  const [error, setError]         = useState("");
  const [brandName, setBrandName] = useState("");
  const started = useRef(false);

  const updateStep = (id: string, status: Step["status"], detail?: string) => {
    setSteps(prev => prev.map(s => s.id === id ? { ...s, status, ...(detail ? { detail } : {}) } : s));
  };

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
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brand_name: name, domain }),
      });

      if (!res.ok || !res.body) throw new Error("Discovery API failed");

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value);
        const lines = text.split("\n").filter(l => l.startsWith("data: "));

        for (const line of lines) {
          const json = line.replace("data: ", "").trim();
          if (!json || json === "[DONE]") continue;

          const event = JSON.parse(json);

          if (event.type === "step_update") {
            updateStep(event.step_id, event.status, event.detail);
          }

          if (event.type === "complete") {
            // Store brand_id for downstream pages
            sessionStorage.setItem("brand_id", event.brand_id);
            setTimeout(() => router.push("/dashboard"), 800);
          }

          if (event.type === "error") {
            setError(event.message);
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    }
  };

  const completedCount = steps.filter(s => s.status === "done").length;
  const progress = Math.round((completedCount / steps.length) * 100);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex flex-col items-center justify-center px-6 py-12">
      <div className="max-w-lg w-full">

        {/* Header */}
        <div className="text-center mb-10">
          <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-900/50">
            <Zap className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">
            Analysing <span className="text-blue-400">{brandName}</span>
          </h1>
          <p className="text-slate-400 text-sm">Running parallel AI agents — this takes about 30–45 seconds</p>
        </div>

        {/* Progress bar */}
        <div className="mb-8">
          <div className="flex justify-between text-xs text-slate-500 mb-2">
            <span>{completedCount} of {steps.length} complete</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-600 to-cyan-400 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Steps */}
        <div className="space-y-3">
          {steps.map((step) => (
            <div
              key={step.id}
              className={`flex items-start gap-4 p-4 rounded-xl border transition-all duration-300 ${
                step.status === "running" ? "bg-blue-950/60 border-blue-700/60" :
                step.status === "done"    ? "bg-green-950/30 border-green-800/40" :
                step.status === "error"   ? "bg-red-950/30 border-red-800/40"    :
                "bg-white/3 border-white/8"
              }`}
            >
              <div className="mt-0.5 flex-shrink-0">
                {step.status === "done"    && <CheckCircle2 className="w-5 h-5 text-green-400" />}
                {step.status === "running" && <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />}
                {step.status === "error"   && <XCircle className="w-5 h-5 text-red-400" />}
                {step.status === "pending" && <div className="w-5 h-5 rounded-full border-2 border-slate-700" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${
                  step.status === "done"    ? "text-green-300" :
                  step.status === "running" ? "text-blue-300"  :
                  step.status === "error"   ? "text-red-300"   :
                  "text-slate-500"
                }`}>
                  {step.label}
                </p>
                {step.status !== "pending" && (
                  <p className="text-xs text-slate-500 mt-0.5 truncate">{step.detail}</p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Error state */}
        {error && (
          <div className="mt-6 p-4 bg-red-950/50 border border-red-800/50 rounded-xl text-red-300 text-sm">
            <p className="font-medium mb-1">Something went wrong</p>
            <p className="text-red-400/80">{error}</p>
            <button
              onClick={() => router.push("/")}
              className="mt-3 text-sm underline text-red-300 hover:text-red-200"
            >
              Go back and try again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
