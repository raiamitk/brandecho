import { NextRequest, NextResponse } from "next/server";
import { generateMoreQueries } from "@/lib/grok";

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const { brand_name, industry, existing_texts, funnel_filter, country, city } = await req.json();
    if (!brand_name || !industry) return NextResponse.json({ error: "brand_name and industry required" }, { status: 400 });

    const queries = await generateMoreQueries(
      brand_name, industry,
      existing_texts || [],
      funnel_filter || "ALL",
      country ? { country, city: city || "" } : undefined
    );
    return NextResponse.json({ queries });
  } catch (e) {
    console.error("More queries error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
