import { NextRequest } from "next/server";
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

// Assign temporary IDs to queries so secondary APIs can reference them
function assignQueryIds(personas: Array<{ queries?: object[] }>): string {
  let counter = 0;
  for (const persona of personas) {
    for (const q of (persona.queries || []) as Array<Record<string,unknown>>) {
      q.id = `q_${++counter}_${Date.now()}`;
    }
  }
  return crypto.randomUUID();
}

export async function POST(req: NextRequest) {
  const { brand_name, domain, country, city } = await req.json();
  if (!brand_name?.trim()) return new Response("Brand name required", { status: 400 });

  const geo = { country: country || "India", city: city || "" };
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
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
            // Assign temp IDs before streaming
            const brand_id = assignQueryIds(result.personas);
            const allQueries = (result.personas || []).flatMap(p => p.queries || []);
            stepUpdate("personas", "done", `Created ${result.personas.length} personas`);
            stepUpdate("queries",  "done", `Generated ${allQueries.length} queries`);
            send({ type: "data", key: "personas", payload: result.personas });
            send({ type: "data", key: "queries",  payload: allQueries });
            // Attach generated brand_id to result so we can use it in complete
            (result as Record<string,unknown>)._brand_id = brand_id;
            return result;
          }),
        ]);

        const brandId    = (partB as Record<string,unknown>)._brand_id as string || crypto.randomUUID();
        const finalDomain = domain || partA.brand.domain;

        stepUpdate("save", "done", "Analysis complete");
        send({
          type: "complete",
          brand_id:     brandId,
          industry:     partA.brand.industry,
          brand_name:   brand_name,
          brand_domain: finalDomain,
          // Include full payload so processing page can save to localStorage
          payload: {
            brand:        partA.brand,
            competitors:  partA.competitors  || [],
            recommendations: partA.recommendations || [],
            personas:     partB.personas    || [],
            queries:      (partB.personas || []).flatMap(p => p.queries || []),
            country:      geo.country,
            city:         geo.city,
          },
        });

      } catch (err) {
        send({ type: "error", message: err instanceof Error ? err.message : "Unknown error" });
      } finally {
        try { controller.close(); } catch (_) {}
      }
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}
