import { NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { discoverPartA, discoverPartB } from "@/lib/grok";

export const runtime     = "nodejs";
export const maxDuration = 60;

const SSE_HEADERS = {
  "Content-Type":  "text/event-stream",
  "Cache-Control": "no-cache",
  "Connection":    "keep-alive",
};

function sse(event: object): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export async function POST(req: NextRequest) {
  const { brand_name, domain, country, city } = await req.json();
  const geo = { country: country || "India", city: city || "" };
  if (!brand_name?.trim()) return new Response("Brand name required", { status: 400 });

  const supabase = createServiceClient();

  // ── CACHE CHECK (before stream) ─────────────────────────────────────────────
  // Done outside the ReadableStream so a cache hit returns a plain static
  // Response string — Vercel reliably delivers static bodies, whereas a
  // fast-completing ReadableStream can be swallowed before the client reads it.
  const { data: cachedRows } = await supabase
    .from("brands").select("id, name, industry, domain")
    .ilike("name", brand_name.trim())
    .order("id", { ascending: false })
    .limit(1);
  const candidate = cachedRows?.[0] ?? null;

  if (candidate) {
    const { count } = await supabase
      .from("queries")
      .select("id", { count: "exact", head: true })
      .eq("brand_id", candidate.id);

    if ((count ?? 0) > 0) {
      // Valid cache hit — build the full SSE payload as a plain string and
      // return it immediately. No ReadableStream needed.
      const body = [
        ...["brand","domain","competitors","personas","queries","recs","save"].map(id =>
          sse({ type: "step_update", step_id: id, status: "done",
                detail: id === "brand" ? "Loaded from cache!" : "Cached" })
        ),
        sse({ type: "complete", brand_id: candidate.id, industry: candidate.industry,
              brand_name: candidate.name, brand_domain: candidate.domain }),
      ].join("");
      return new Response(body, { headers: SSE_HEADERS });
    }

    // Stale / incomplete record — delete and fall through to full analysis
    await supabase.from("brands").delete().eq("id", candidate.id);
  }

  // ── FULL ANALYSIS (streaming) ───────────────────────────────────────────────
  const encoder = new TextEncoder();
  const stream  = new ReadableStream({
    async start(controller) {
      const send = (event: object) => {
        try { controller.enqueue(encoder.encode(sse(event))); } catch (_) {}
      };
      const stepUpdate = (step_id: string, status: string, detail?: string) =>
        send({ type: "step_update", step_id, status, detail });

      try {
        stepUpdate("brand",       "running", "AI analysing brand profile...");
        stepUpdate("competitors", "running", "Finding competitors...");
        stepUpdate("recs",        "running", "Building recommendations...");
        stepUpdate("personas",    "running", "Creating buyer personas...");
        stepUpdate("queries",     "running", "Generating target queries...");

        const [partA, partB] = await Promise.all([
          discoverPartA(brand_name, domain, geo).then(result => {
            stepUpdate("brand",       "done", `Industry: ${result.brand.industry}`);
            stepUpdate("domain",      "done", `Domain: ${domain || result.brand.domain}`);
            stepUpdate("competitors", "done", `Found ${result.competitors.length} competitors`);
            stepUpdate("recs",        "done", `${result.recommendations.length} recommendations`);
            send({ type: "data", key: "brand",       payload: result.brand });
            send({ type: "data", key: "competitors", payload: result.competitors });
            send({ type: "data", key: "recs",        payload: result.recommendations });
            return result;
          }),
          discoverPartB(brand_name, domain, geo).then(result => {
            const allQueries = (result.personas || []).flatMap(p => p.queries || []);
            stepUpdate("personas", "done", `Created ${result.personas.length} personas`);
            stepUpdate("queries",  "done", `Generated ${allQueries.length} queries`);
            send({ type: "data", key: "personas", payload: result.personas });
            send({ type: "data", key: "queries",  payload: allQueries });
            return result;
          }),
        ]);

        const brandInfo      = partA.brand;
        const competitorData = partA.competitors     || [];
        const recsData       = partA.recommendations || [];
        const personaData    = partB.personas        || [];
        const finalDomain    = domain || brandInfo.domain;

        stepUpdate("save", "running", "Saving to database...");

        let brand: { id: string; name: string; industry: string; domain: string } | null = null;

        const { data: insertedBrand, error: brandErr } = await supabase
          .from("brands")
          .insert({
            name: brand_name, domain: finalDomain,
            industry: brandInfo.industry, description: brandInfo.description,
          })
          .select().single();

        if (brandErr) {
          const isUniqueViolation =
            brandErr.code === "23505" ||
            (brandErr.message || "").toLowerCase().includes("unique") ||
            (brandErr.message || "").toLowerCase().includes("duplicate");

          if (isUniqueViolation) {
            const { data: existingRows } = await supabase
              .from("brands").select("id, name, industry, domain")
              .ilike("name", brand_name.trim())
              .order("id", { ascending: false })
              .limit(1);
            brand = existingRows?.[0] ?? null;
          }
          if (!brand) throw new Error(`Brand save failed: ${brandErr.message}`);
        } else {
          brand = insertedBrand;
        }

        if (!brand) throw new Error("Brand record unavailable after save");

        if (competitorData.length > 0) {
          await supabase.from("competitors").insert(
            competitorData.map(c => ({
              brand_id: brand!.id, name: c.name, domain: c.domain, type: c.type,
            }))
          );
        }

        for (const persona of personaData) {
          const { data: p } = await supabase.from("personas").insert({
            brand_id: brand.id, name: persona.name, archetype: persona.archetype,
            age_range: persona.age_range, pain_points: persona.pain_points,
            goals: persona.goals, ai_tools_used: persona.ai_tools_used,
            query_style: persona.query_style,
          }).select().single();

          if (p && (persona.queries || []).length > 0) {
            await supabase.from("queries").insert(
              (persona.queries || []).map(q => ({
                brand_id: brand!.id, persona_id: p.id, text: q.text, type: q.type,
                intent: q.intent, revenue_proximity: q.revenue_proximity,
                citations: q.citations || [],
                funnel_stage: q.funnel_stage || "MOFU",
              }))
            );
          }
        }

        if (recsData.length > 0) {
          await supabase.from("recommendations").insert(
            recsData.map(r => ({
              brand_id: brand!.id, title: r.title, description: r.description,
              category: r.category, priority: r.priority,
              projected_lift: r.projected_lift, action_label: r.action_label,
            }))
          );
        }

        stepUpdate("save", "done", "All data saved");
        send({ type: "complete", brand_id: brand.id, industry: brandInfo.industry,
               brand_name: brand.name, brand_domain: brand.domain });

      } catch (err) {
        send({ type: "error", message: err instanceof Error ? err.message : "Unknown error" });
      } finally {
        try { controller.close(); } catch (_) {}
      }
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}
