import { NextRequest, NextResponse } from "next/server";
import { generateContentBriefs } from "@/lib/grok";

export async function POST(req: NextRequest) {
  try {
    const { brand_name, industry, queries } = await req.json();
    if (!brand_name || !queries?.length) return NextResponse.json({ error: "brand_name and queries required" }, { status: 400 });

    // ONE Claude call generates all 5 briefs
    const briefs = await generateContentBriefs(brand_name, industry, queries);

    return NextResponse.json({ briefs, cached: false });
  } catch (e) {
    console.error("Briefs API error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
