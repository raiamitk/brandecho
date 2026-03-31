import { NextRequest } from "next/server";
import { scorePlatformVisibility } from "@/lib/grok";

export const runtime     = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { brand_name, industry, description, country, city } = await req.json();
    if (!brand_name) return Response.json({ error: "brand_name required" }, { status: 400 });

    const scores = await scorePlatformVisibility(
      brand_name, industry, description,
      country ? { country, city: city || "" } : undefined
    );
    return Response.json({ scores });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
