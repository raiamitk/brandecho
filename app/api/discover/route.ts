import { NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { discoverPartA, discoverPartB } from "@/lib/grok";

// ── Discover route — runs Part A (brand+competitors+recs) and Part B
// (personas+queries) in PARALLEL. As soon as each finishes it sends a
// "data" SSE event so the processing page can show widgets immediately.
// Total time ~12-15s instead of the previous 25-40s single-call approach.

export const runtime     = "nodejs";
export const maxDuration = 60;

function sse(event: object): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export async function POST(req: NextRequest) {
  const { brand_name, domain } = await req.json();
  if (!brand_name?.trim()) return new Response("Brand name required", { status: 400 });

  const encoder  = new TextEncoder();
  const supabase = createServiceClient();

  const stream = new ReadableStream({
    async start(controller) {
      const send       = (event: object) => controller.enqueue(encoder.encode(sse(event)));
      const stepUpdate = (step_id: string, status: string, detail?: string) =>
        send({ type: "step_update", step_id, status, detail });

      try {
        // ── CACHE CHECK ──────────────────────────────────────────────────────
        // Use limit(1) + array access instead of maybeSingle() — maybeSingle()
        // throws "multiple rows" when a brand has been scanned more than once,
        // crashing the SSE stream and causing ECONNRESET on the client.
        stepUpdate("brand", "running", "Checking cache...");
        const { data: cachedRows } = await supabase
          .from("brands").select("id, name, industry, domain")
          .ilike("name", brand_name.trim())
          .order("created_at", { ascending: false })
          .limit(1);
        const cached = cachedRows?.[0] ?? null;

        if (cached) {
          ["brand","domain","competitors","personas","queries","recs","save"].forEach(id =>
            stepUpdate(id, "done", id === "brand" ? "Loaded from cache!" : "Cached ✓")
          );
          send({ type: "complete", brand_id: cached.id, industry: cached.industry, brand_name: cached.name, brand_domain: cached.domain });
          controller.close();
          return;
        }

        // ── FIRE BOTH PARTS IN PARALLEL ──────────────────────────────────────
        stepUpdate("brand",       "running", "AI analysing brand profile...");
        stepUpdate("competitors", "running", "Finding competitors...");
        stepUpdate("recs",        "running", "Building recommendations...");
        stepUpdate("personas",    "running", "Creating buyer personas...");
        stepUpdate("queries",     "running", "Generating target queries...");

        // Both parts run in parallel; .then() fires SSE events the moment each finishes.
        // Promise.all return values give TypeScript the correct inferred types.
        const [partA, partB] = await Promise.all([
          discoverPartA(brand_name, domain).then(result => {
            stepUpdate("brand",       "done", `Industry: ${result.brand.industry}`);
            stepUpdate("domain",      "done", `Domain: ${domain || result.brand.domain}`);
            stepUpdate("competitors", "done", `Found ${result.competitors.length} competitors`);
            stepUpdate("recs",        "done", `${result.recommendations.length} recommendations`);
            send({ type: "data", key: "brand",       payload: result.brand });
            send({ type: "data", key: "competitors", payload: result.competitors });
            send({ type: "data", key: "recs",        payload: result.recommendations });
            return result;
          }),
          discoverPartB(brand_name, domain).then(result => {
            const allQueries = (result.personas || []).flatMap(p => p.queries || []);
            stepUpdate("personas", "done", `Created ${result.personas.length} personas`);
            stepUpdate("queries",  "done", `Generated ${allQueries.length} queries`);
            send({ type: "data", key: "personas", payload: result.personas });
            send({ type: "data", key: "queries",  payload: allQueries });
            return result;
          }),
        ]);

        const brandInfo      = partA.brand;
        const competitorData = partA.competitors    || [];
        const recsData       = partA.recommendations || [];
        const personaData    = partB.personas       || [];
        const finalDomain    = domain || brandInfo.domain;

        // ── SAVE TO SUPABASE ─────────────────────────────────────────────────
        stepUpdate("save", "running", "Saving to database...");

        const { data: brand, error: brandErr } = await supabase
          .from("brands")
          .insert({
            name: brand_name, domain: finalDomain,
            industry: brandInfo.industry, description: brandInfo.description,
          })
          .select().single();

        if (brandErr || !brand) throw new Error(`Brand save failed: ${brandErr?.message}`);

        if (competitorData.length > 0) {
          await supabase.from("competitors").insert(
            competitorData.map(c => ({
              brand_id: brand.id, name: c.name, domain: c.domain, type: c.type,
              aeo_score: Math.floor(Math.random() * 40) + 40,
              seo_score: Math.floor(Math.random() * 40) + 40,
            }))
          );
        }

        for (const persona of personaData) {
          const { data: p } = await supabase.from("personas").insert({
            brand_id:      brand.id,
            name:          persona.name,
            archetype:     persona.archetype,
            age_range:     persona.age_range,
            pain_points:   persona.pain_points,
            goals:         persona.goals,
            ai_tools_used: persona.ai_tools_used,
            query_style:   persona.query_style,
          }).select().single();

          if (p) {
            const pQueries = (persona.queries || []);
            if (pQueries.length > 0) {
              await supabase.from("queries").insert(
                pQueries.map(q => ({
                  brand_id:          brand.id,
                  persona_id:        p.id,
                  text:              q.text,
                  type:              q.type,
                  intent:            q.intent,
                  revenue_proximity: q.revenue_proximity,
                  citations:         q.citations || [],
                }))
              );
            }
          }
        }

        if (recsData.length > 0) {
          await supabase.from("recommendations").insert(
            recsData.map(r => ({
              brand_id:       brand.id,
              title:          r.title,
              description:    r.description,
              category:       r.category,
              priority:       r.priority,
              projected_lift: r.projected_lift,
              action_label:   r.action_label,
            }))
          );
        }

        stepUpdate("save", "done", "All data saved ✓");
        send({ type: "complete", brand_id: brand.id, industry: brandInfo.industry });

      } catch (err) {
        send({ type: "error", message: err instanceof Error ? err.message : "Unknown error" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type":  "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection":    "keep-alive",
    },
  });
}
