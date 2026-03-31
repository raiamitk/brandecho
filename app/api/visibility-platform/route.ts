import { NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { scorePlatformVisibility } from "@/lib/grok";

export const runtime     = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { brand_id } = await req.json();
    if (!brand_id) return Response.json({ error: "brand_id required" }, { status: 400 });

    const supabase = createServiceClient();
    const { data: brand } = await supabase
      .from("brands").select("name, industry, description, country, city")
      .eq("id", brand_id).single();
    if (!brand) return Response.json({ error: "Brand not found" }, { status: 404 });

    const scores = await scorePlatformVisibility(
      brand.name, brand.industry, brand.description,
      brand.country ? { country: brand.country, city: brand.city || "" } : undefined
    );
    return Response.json({ scores });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
