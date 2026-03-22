"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, ArrowRight, Trash2, Globe, Building2, Clock } from "lucide-react";

const A  = "#00FF96";
const AT = "#059669";

export interface SavedBrand {
  id:         string;
  name:       string;
  industry:   string;
  domain:     string;
  scanned_at: string;
}

const STORAGE_KEY = "brandecho_brands";

export function loadSavedBrands(): SavedBrand[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch { return []; }
}

export function saveBrand(brand: SavedBrand) {
  const existing = loadSavedBrands().filter(b => b.id !== brand.id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify([brand, ...existing].slice(0, 20)));
}

export function deleteBrand(id: string) {
  const updated = loadSavedBrands().filter(b => b.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
}

export default function BrandsPage() {
  const router = useRouter();
  const [brands, setBrands] = useState<SavedBrand[]>([]);

  useEffect(() => { setBrands(loadSavedBrands()); }, []);

  const openBrand = (b: SavedBrand) => {
    sessionStorage.setItem("brand_id", b.id);
    router.push("/dashboard");
  };

  const removeBrand = (id: string) => {
    deleteBrand(id);
    setBrands(prev => prev.filter(b => b.id !== id));
  };

  return (
    <div style={{ minHeight: "100vh", background: "#fff" }}>

      {/* Header */}
      <header style={{ borderBottom: "1px solid #e5e7eb", padding: "16px 28px",
        display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <img src="/logo.svg" alt="BrandEcho" style={{ height: 32 }} />
        <button onClick={() => router.push("/")}
          style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 20px",
            background: A, color: "#111", fontWeight: 700, borderRadius: 10,
            border: "none", cursor: "pointer", fontSize: 13 }}>
          <Plus style={{ width: 15, height: 15 }} /> Scan New Brand
        </button>
      </header>

      <main style={{ maxWidth: 900, margin: "0 auto", padding: "48px 28px" }}>

        <div style={{ marginBottom: 36 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: "#111827", marginBottom: 8 }}>
            My Brands
          </h1>
          <p style={{ fontSize: 14, color: "#6b7280" }}>
            {brands.length > 0
              ? `${brands.length} brand${brands.length > 1 ? "s" : ""} saved locally — click any to open its dashboard`
              : "No brands saved yet — scan your first brand to get started"}
          </p>
        </div>

        {brands.length === 0 ? (
          // Empty state
          <div style={{ textAlign: "center", padding: "72px 0" }}>
            <div style={{ width: 72, height: 72, borderRadius: 20, background: "rgba(0,255,150,0.1)",
              display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
              <Building2 style={{ width: 32, height: 32, color: A }} />
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "#111827", marginBottom: 10 }}>
              No brands yet
            </h2>
            <p style={{ color: "#6b7280", marginBottom: 28 }}>
              Scan your first brand to see it appear here
            </p>
            <button onClick={() => router.push("/")}
              style={{ background: A, color: "#111", fontWeight: 700, padding: "12px 32px",
                borderRadius: 12, border: "none", cursor: "pointer", fontSize: 14,
                display: "inline-flex", alignItems: "center", gap: 8 }}>
              <Plus style={{ width: 16, height: 16 }} /> Scan a Brand
            </button>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
            {brands.map(b => (
              <div key={b.id} style={{ background: "#f9fafb", border: "1px solid #e5e7eb",
                borderRadius: 16, padding: 20, display: "flex", flexDirection: "column", gap: 14,
                transition: "box-shadow 0.15s" }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 16px rgba(0,0,0,0.08)"}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.boxShadow = "none"}>

                {/* Brand avatar + name */}
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 44, height: 44, borderRadius: "50%", background: A,
                    color: "#111", fontWeight: 800, fontSize: 18, flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {b.name.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#111827",
                      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {b.name}
                    </div>
                    <div style={{ fontSize: 12, color: "#6b7280" }}>{b.industry}</div>
                  </div>
                </div>

                {/* Domain + date */}
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {b.domain && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#6b7280" }}>
                      <Globe style={{ width: 13, height: 13, flexShrink: 0 }} />
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {b.domain}
                      </span>
                    </div>
                  )}
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#9ca3af" }}>
                    <Clock style={{ width: 13, height: 13, flexShrink: 0 }} />
                    Scanned {new Date(b.scanned_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: "flex", gap: 8, marginTop: "auto" }}>
                  <button onClick={() => openBrand(b)}
                    style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
                      gap: 6, padding: "9px 0", background: A, color: "#111", fontWeight: 700,
                      borderRadius: 10, border: "none", cursor: "pointer", fontSize: 13 }}>
                    Open Dashboard <ArrowRight style={{ width: 14, height: 14 }} />
                  </button>
                  <button onClick={() => removeBrand(b.id)}
                    title="Remove from saved"
                    style={{ width: 38, height: 38, display: "flex", alignItems: "center",
                      justifyContent: "center", borderRadius: 10, border: "1px solid #e5e7eb",
                      background: "#fff", cursor: "pointer", color: "#dc2626", flexShrink: 0 }}>
                    <Trash2 style={{ width: 15, height: 15 }} />
                  </button>
                </div>
              </div>
            ))}

            {/* Add new card */}
            <button onClick={() => router.push("/")}
              style={{ background: "none", border: "2px dashed #d1d5db", borderRadius: 16,
                padding: 20, cursor: "pointer", display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center", gap: 10, minHeight: 160,
                transition: "border-color 0.15s" }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = A}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = "#d1d5db"}>
              <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#f3f4f6",
                display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Plus style={{ width: 22, height: 22, color: AT }} />
              </div>
              <span style={{ fontSize: 13, fontWeight: 600, color: AT }}>Scan New Brand</span>
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
