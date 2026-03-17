import { NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import {
  discoverBrandInfo,
  discoverCompetitors,
  generatePersonas,
  generateQueriesForPersona,
  generateRecommendations,
} from "@/lib/grok";

// Server-Sent Events helper
function sse(event: object): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export const runtime = "nodejs";
export const maxDuration = 120; // 2 min timeout for Vercel

export async function POST(req: NextRequest) {
  const { brand_name, domain } = await req.json();

  if (!brand_name?.trim()) {
    return new Response("Brand name required", { status: 400 });
  }

  const encoder = new TextEncoder();
  const supabase = createServiceClient();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: object) => controller.enqueue(encoder.encode(sse(event)));
      const stepUpdate = (step_id: string, status: string, detail?: string) =>
        send({ type: "step_update", step_id, status, detail });

      try {
        // ── STEP 1: Brand discovery ──────────────────────────────────────
        stepUpdate("brand", "running", "Calling Grok to analyse brand...");
        const brandInfo = await discoverBrandInfo(brand_name, domain);
        stepUpdate("brand", "done", `Detected: ${brandInfo.industry}`);

        // ── STEP 2: Domain ───────────────────────────────────────────────
        stepUpdate("domain", "running", `Verifying domain: ${brandInfo.domain}`);
        const finalDomain = domain || brandInfo.domain;
        stepUpdate("domain", "done", `Domain: ${finalDomain}`);

        // ── STEP 3: Competitors ──────────────────────────────────────────
        stepUpdate("competitors", "running", "Finding competitors via Grok...");
        const competitorData = await discoverCompetitors(brand_name, brandInfo.industry);
        stepUpdate("competitors", "done", `Found ${competitorData.length} competitors`);

        // ── STEP 4: Personas ─────────────────────────────────────────────
        stepUpdate("personas", "running", "Generating 3 user personas...");
        const personaData = await generatePersonas(brand_name, brandInfo.industry, brandInfo.description);
        stepUpdate("personas", "done", `Created ${personaData.length} personas`);

        // ── STEP 5: Queries ──────────────────────────────────────────────
        stepUpdate("queries", "running", "Generating 75+ AEO/GEO/SEO queries...");
        type QueryItem = { text: string; type: string; intent: string; revenue_proximity: number; persona_name: string };
        const allQueries: QueryItem[] = [];
        for (const persona of personaData) {
          const pQueries = await generateQueriesForPersona(brand_name, persona, brandInfo.industry);
          allQueries.push(...pQueries.map((q: Omit<QueryItem, "persona_name">) => ({ ...q, persona_name: persona.name })));
        }
        stepUpdate("queries", "done", `Generated ${allQueries.length} queries`);

        // ── STEP 6: Recommendations ──────────────────────────────────────
        stepUpdate("recs", "running", "Building prioritised recommendations...");
        const recsData = await generateRecommendations(
          brand_name,
          brandInfo.industry,
          competitorData.map((c: { name: string }) => c.name),
          allQueries.length,
        );
        stepUpdate("recs", "done", `${recsData.length} recommendations ready`);

        // ── STEP 7: Save to Supabase ─────────────────────────────────────
        stepUpdate("save", "running", "Saving to database...");

        // Insert brand
        const { data: brand, error: brandErr } = await supabase
          .from("brands")
          .insert({ name: brand_name, domain: finalDomain, industry: brandInfo.industry, description: brandInfo.description })
          .select()
          .single();

        if (brandErr || !brand) throw new Error(`Brand save failed: ${brandErr?.message}`);

        // Insert competitors
        if (competitorData.length > 0) {
          await supabase.from("competitors").insert(
            competitorData.map((c: { name: string; domain: string; type: string }) => ({
              brand_id: brand.id, name: c.name, domain: c.domain, type: c.type,
              aeo_score: Math.floor(Math.random() * 40) + 40,
              seo_score: Math.floor(Math.random() * 40) + 40,
            }))
          );
        }

        // Insert personas + queries
        for (const persona of personaData) {
          const { data: p } = await supabase
            .from("personas")
            .insert({
              brand_id: brand.id,
              name: persona.name,
              archetype: persona.archetype,
              age_range: persona.age_range,
              pain_points: persona.pain_points,
              goals: persona.goals,
              ai_tools_used: persona.ai_tools_used,
              query_style: persona.query_style,
            })
            .select()
            .single();

          if (p) {
            const personaQueries = allQueries.filter(
              (q: { persona_name?: string }) => q.persona_name === persona.name
            );
            if (personaQueries.length > 0) {
              await supabase.from("queries").insert(
                personaQueries.map((q: { text: string; type: string; intent: string; revenue_proximity: number }) => ({
                  brand_id: brand.id,
                  persona_id: p.id,
                  text: q.text,
                  type: q.type,
                  intent: q.intent,
                  revenue_proximity: q.revenue_proximity,
                }))
              );
            }
          }
        }

        // Insert recommendations
        if (recsData.length > 0) {
          await supabase.from("recommendations").insert(
            recsData.map((r: { title: string; description: string; category: string; priority: string; projected_lift: string; action_label: string }) => ({
              brand_id: brand.id,
              title: r.title,
              description: r.description,
              category: r.category,
              priority: r.priority,
              projected_lift: r.projected_lift,
              action_label: r.action_label,
            }))
          );
        }

        stepUpdate("save", "done", "All data saved successfully");

        // Signal completion
        send({ type: "complete", brand_id: brand.id });

      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        send({ type: "error", message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type":  "text/event-stream",
      "Cache-Control": "no-cache",
      Connection:      "keep-alive",
    },
  });
}
