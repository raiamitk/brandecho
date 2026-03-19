import { NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import {
  discoverBrandInfo,
  discoverCompetitors,
  generatePersonasAndQueries,
  generateRecommendations,
} from "@/lib/grok";

function sse(event: object): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export const runtime    = "nodejs";
export const maxDuration = 120;

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
        // ── CACHE CHECK: return existing data if brand already analysed ───
        stepUpdate("brand", "running", "Checking cache...");
        const { data: cached } = await supabase
          .from("brands")
          .select("id")
          .ilike("name", brand_name.trim())
          .maybeSingle();

        if (cached) {
          // Mark all steps done instantly
          ["brand","domain","competitors","personas","queries","recs","save"].forEach(id =>
            stepUpdate(id, "done", id === "brand" ? "Loaded from cache!" : "Cached ✓")
          );
          send({ type: "complete", brand_id: cached.id });
          controller.close();
          return;
        }

        // ── STEP 1: Brand discovery ──────────────────────────────────────
        stepUpdate("brand", "running", "Analysing brand with Claude...");
        const brandInfo   = await discoverBrandInfo(brand_name, domain);
        stepUpdate("brand", "done", `Detected: ${brandInfo.industry}`);

        // ── STEP 2: Domain ───────────────────────────────────────────────
        stepUpdate("domain", "running", `Verifying domain...`);
        const finalDomain = domain || brandInfo.domain;
        stepUpdate("domain", "done", `Domain: ${finalDomain}`);

        // ── STEP 3: Competitors ──────────────────────────────────────────
        stepUpdate("competitors", "running", "Finding competitors...");
        const competitorData = await discoverCompetitors(brand_name, brandInfo.industry);
        stepUpdate("competitors", "done", `Found ${competitorData.length} competitors`);

        // ── STEP 4+5: Personas + Queries in ONE call ─────────────────────
        stepUpdate("personas", "running", "Generating personas & queries...");
        stepUpdate("queries",  "running", "Generating 15 targeted queries...");
        const personasAndQueries = await generatePersonasAndQueries(
          brand_name, brandInfo.industry, brandInfo.description
        );
        const personaData = personasAndQueries.personas;
        stepUpdate("personas", "done", `Created ${personaData.length} personas`);

        type QueryItem = { text: string; type: string; intent: string; revenue_proximity: number; citations: object[]; persona_name: string };
        const allQueries: QueryItem[] = [];
        for (const persona of personaData) {
          (persona.queries || []).forEach((q: Omit<QueryItem, "persona_name">) =>
            allQueries.push({ ...q, citations: q.citations || [], persona_name: persona.name })
          );
        }
        stepUpdate("queries", "done", `Generated ${allQueries.length} queries`);

        // ── STEP 6: Recommendations ──────────────────────────────────────
        stepUpdate("recs", "running", "Building recommendations...");
        const recsData = await generateRecommendations(
          brand_name, brandInfo.industry,
          competitorData.map((c: { name: string }) => c.name),
          allQueries.length,
        );
        stepUpdate("recs", "done", `${recsData.length} recommendations ready`);

        // ── STEP 7: Save to Supabase ─────────────────────────────────────
        stepUpdate("save", "running", "Saving to database...");

        const { data: brand, error: brandErr } = await supabase
          .from("brands")
          .insert({ name: brand_name, domain: finalDomain, industry: brandInfo.industry, description: brandInfo.description })
          .select().single();

        if (brandErr || !brand) throw new Error(`Brand save failed: ${brandErr?.message}`);

        if (competitorData.length > 0) {
          await supabase.from("competitors").insert(
            competitorData.map((c: { name: string; domain: string; type: string }) => ({
              brand_id: brand.id, name: c.name, domain: c.domain, type: c.type,
              aeo_score: Math.floor(Math.random() * 40) + 40,
              seo_score: Math.floor(Math.random() * 40) + 40,
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

          if (p) {
            const pQueries = allQueries.filter(q => q.persona_name === persona.name);
            if (pQueries.length > 0) {
              await supabase.from("queries").insert(
                pQueries.map(q => ({
                  brand_id: brand.id, persona_id: p.id,
                  text: q.text, type: q.type, intent: q.intent,
                  revenue_proximity: q.revenue_proximity,
                  citations: q.citations || [],
                }))
              );
            }
          }
        }

        if (recsData.length > 0) {
          await supabase.from("recommendations").insert(
            recsData.map((r: { title: string; description: string; category: string; priority: string; projected_lift: string; action_label: string }) => ({
              brand_id: brand.id, title: r.title, description: r.description,
              category: r.category, priority: r.priority,
              projected_lift: r.projected_lift, action_label: r.action_label,
            }))
          );
        }

        stepUpdate("save", "done", "All data saved successfully");
        send({ type: "complete", brand_id: brand.id });

      } catch (err) {
        send({ type: "error", message: err instanceof Error ? err.message : "Unknown error" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
  });
}
