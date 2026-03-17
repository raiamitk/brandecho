// ─────────────────────────────────────────────────────────────────────────────
//  Core Types for AEO + SEO Intelligence Tool
// ─────────────────────────────────────────────────────────────────────────────

export interface Brand {
  id: string;
  name: string;
  domain: string;
  industry: string;
  description: string;
  created_at: string;
}

export interface Persona {
  id: string;
  brand_id: string;
  name: string;
  archetype: string;   // e.g. "Busy Professional", "Budget Student"
  age_range: string;
  pain_points: string[];
  goals: string[];
  ai_tools_used: string[];
  query_style: string; // how they phrase questions to AI
  created_at: string;
}

export interface Query {
  id: string;
  brand_id: string;
  persona_id: string;
  text: string;
  type: "aeo" | "geo" | "seo_longtail";
  intent: "awareness" | "consideration" | "purchase" | "comparison";
  revenue_proximity: number; // 0-100
  created_at: string;
}

export interface Competitor {
  id: string;
  brand_id: string;
  name: string;
  domain: string;
  type: "direct" | "category_substitute";
  aeo_score: number;  // estimated AI visibility
  seo_score: number;  // estimated SEO strength
  created_at: string;
}

export interface Recommendation {
  id: string;
  brand_id: string;
  title: string;
  description: string;
  category: "aeo" | "seo" | "content" | "technical";
  priority: "high" | "medium" | "low";
  projected_lift: string;  // e.g. "+15% AI visibility"
  action_label: string;
  created_at: string;
}

export interface DiscoveryState {
  status: "idle" | "discovering" | "analyzing" | "complete" | "error";
  brand_name: string;
  domain?: string;
  steps: DiscoveryStep[];
  brand?: Brand;
  personas?: Persona[];
  queries?: Query[];
  competitors?: Competitor[];
  recommendations?: Recommendation[];
  error?: string;
}

export interface DiscoveryStep {
  id: string;
  label: string;
  status: "pending" | "running" | "done" | "error";
  detail?: string;
}
