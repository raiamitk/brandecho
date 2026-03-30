import { NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { discoverPartA, discoverPartB } from "@/lib/grok";

// Discover route — runs Part A (brand+competitors+recs) and Part B
// (personas+queries) in PARALLEL. As soon as each finishes it sends a
// "data" SSE event so the processing page can show widgets immediately.

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
      const send = (event: object) => {
        try { controller.enqueue(encoder.encode(sse(event))); } catch (_) {}
      };
      const stepUpdate = (step_id: string, status: string, detail?: string) =>
        send({ type: "step_update", step_id, status, detail });

      try {
        // ── CACHE CHECK ────────────────────────────────────────────────────────
        stepUpdate("brand", "running", "Checking cache...");
        const { data: cachedRows } = await supabase
          .from("brands").select("id, name, industry, domain")
          .ilike("name", brand_name.trim())
          .order("id", { ascending: false })
          .limit(1);
        const candidate = cachedRows?.[0] ?? null;

        // Verify the candidate has associated queries (fully-analysed record)
        let cacheValid = false;
        if (candidate) {
          const { count } = await supabase
            .from("queries")
            .select("id", { count: "exact", head: true })
            .eq("brand_id", candidate.id);
          cacheValid = (count ?? 0) > 0;
          if (!cacheValid) {
            // Stale/incomplete record — delete and re-analyse
            await supabase.from("brands").delete().eq("id", candidate.id);
          }
        }

        if (cacheValid && candidate) {
          // ── CACHE HIT ────────────────────────────────────────────────────────
          ["brand","domain","competitors","personas","queries","recs","save"].forEach(id =>
            stepUpdate(id, "done", id === "brand" ? "Loaded from cache!" : "Cached")
          );
          send({ type: "complete", brand_id: candidate.id, industry: candidate.industry, brand_name: candidate.name, brand_domain: candidate.domain });
          // Yield to the event loop so Vercel/Node flushes the enqueued chunks
          // before the stream closes. Without this, fast cache-hit responses
          // close the stream before the proxy has a chance to forward the data.
          await new Promise(r => setTimeout(r, 50));

        } else {
          // ── FULL ANALYSIS ─────────────────────────────────────────────────────
          stepUpdate("brand",       "running", "AI analysing brand profile...");
          stepUpdate("competitors", "running", "Finding competitors...");
          stepUpdate("recs",        "running", "Building recommendations...");
          stepUpdate("personas",    "running", "Creating buyer personas...");
          stepUpdate("queries",     "running", "Generating target queries...");

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
          const competitorData = partA.competitors     || [];
          const recsData       = partA.recommendations || [];
          const personaData    = partB.personas        || [];
          const finalDomain    = domain || brandInfo.domain;

          stepUpdate("save", "running", "Saving to database...");

          // Try INSERT; handle unique-constraint race (code 23505) gracefully.
          // IMPORTANT: do NOT use .order("created_at") — that column may not
          // exist and causes Supabase to silently return null.
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
              // Brand inserted between cache-check and now — fetch by id DESC (no created_at)
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
              const pQueries = persona.queries || [];
              if (pQueries.length > 0) {
                await supabase.from("queries").insert(
                  pQueries.map(q => ({
                    brand_id:          brand!.id,
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
                brand_id:       brand!.id,
                title:          r.title,
                description:    r.description,
                category:       r.category,
                priority:       r.priority,
                projected_lift: r.projected_lift,
                action_label:   r.action_label,
              }))
            );
          }

          stepUpdate("save", "done", "All data saved");
          send({ type: "complete", brand_id: brand.id, industry: brandInfo.industry, brand_name: brand.name, brand_domain: brand.domain });
        }

      } catch (err) {
        send({ type: "error", message: err instanceof Error ? err.message : "Unknown error" });
      } finally {
        try { controller.close(); } catch (_) {}
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
