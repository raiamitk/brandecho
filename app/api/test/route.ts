import { NextResponse } from "next/server";

// ── Quick diagnostic — visit /api/test in browser to see what's failing ───────
export const runtime = "nodejs";

export async function GET() {
  const checks: Record<string, string> = {};

  // 1. Env var presence
  checks["ANTHROPIC_API_KEY"]        = process.env.ANTHROPIC_API_KEY       ? "✅ set" : "❌ MISSING";
  checks["NEXT_PUBLIC_SUPABASE_URL"] = process.env.NEXT_PUBLIC_SUPABASE_URL ? "✅ set" : "❌ MISSING";
  checks["SUPABASE_SERVICE_ROLE_KEY"]= process.env.SUPABASE_SERVICE_ROLE_KEY? "✅ set" : "❌ MISSING";
  checks["GEMINI_API_KEY"]           = process.env.GEMINI_API_KEY           ? "✅ set" : "⚠️  not set (optional)";

  // 2. Try a real Claude ping (tiny prompt, 10 tokens)
  let claudeStatus = "";
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type":      "application/json",
        "x-api-key":         process.env.ANTHROPIC_API_KEY || "",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model:      "claude-haiku-4-5-20251001",   // cheapest/fastest for ping
        max_tokens: 10,
        messages:   [{ role: "user", content: "Say OK" }],
      }),
    });
    const data = await res.json();
    if (res.ok) {
      claudeStatus = `✅ Claude reachable — response: ${JSON.stringify(data.content?.[0]?.text)}`;
    } else {
      claudeStatus = `❌ Claude error ${res.status}: ${JSON.stringify(data)}`;
    }
  } catch (e) {
    claudeStatus = `❌ Network error reaching Claude: ${String(e)}`;
  }

  // 3. Try Supabase ping
  let supabaseStatus = "";
  try {
    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/brands?select=id&limit=1`;
    const res = await fetch(url, {
      headers: {
        "apikey":        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
        "Authorization": `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""}`,
      },
    });
    supabaseStatus = res.ok
      ? `✅ Supabase reachable (status ${res.status})`
      : `❌ Supabase error ${res.status}: ${await res.text()}`;
  } catch (e) {
    supabaseStatus = `❌ Network error reaching Supabase: ${String(e)}`;
  }

  return NextResponse.json({
    env_vars:        checks,
    claude_ping:     claudeStatus,
    supabase_ping:   supabaseStatus,
    node_version:    process.version,
    timestamp:       new Date().toISOString(),
  }, { status: 200 });
}
