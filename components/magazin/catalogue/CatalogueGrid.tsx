"use client"

import { useState, useMemo } from "react"
import { Select }    from "@/components/ui/Select"
import { formatMAD } from "@/lib/utils/currency"
import { useTranslations } from "next-intl"
import type { ProductForPOS as ProductForCatalogue } from "@/lib/actions/magazin/pos"

type LookupItem    = { id: string; label_fr: string; label_ar: string }
type LookupMapItem = { label_fr: string; label_ar: string }

interface CatalogueGridProps {
  products:   ProductForCatalogue[]
  categories: LookupItem[]
  sizes:      LookupItem[]
  colors:     LookupItem[]
  lookupById: Record<string, LookupMapItem>
  locale:     string
}

export function CatalogueGrid({ products, categories, sizes, colors, lookupById, locale }: CatalogueGridProps) {
  const t = useTranslations("magazin.catalogue")
  const [catFilter,   setCatFilter]   = useState("")
  const [sizeFilter,  setSizeFilter]  = useState("")
  const [colorFilter, setColorFilter] = useState("")

  const lookupMap = lookupById

  const anyFilter = catFilter || sizeFilter || colorFilter

  const filtered = useMemo(() => products.filter(p => {
    if (catFilter   && p.categoryId !== catFilter)                                    return false
    if (sizeFilter  && !p.variants.some(v => v.sizeId === sizeFilter))                return false
    if (colorFilter && !p.variants.some(v => v.colorId === colorFilter))              return false
    return true
  }), [products, catFilter, sizeFilter, colorFilter])

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.02em", margin: 0 }}>
        {t("title")}
      </h1>

      {/* Filters */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(175px, 1fr))", gap: 12, alignItems: "end" }}>
        <Select value={catFilter}   onChange={e => setCatFilter(e.target.value)}   placeholder={t("allCategories")} options={categories.map(c => ({ value: c.id, label: c.label_fr }))} />
        <Select value={sizeFilter}  onChange={e => setSizeFilter(e.target.value)}  placeholder={t("allSizes")}   options={sizes.map(s => ({ value: s.id, label: s.label_fr }))} />
        <Select value={colorFilter} onChange={e => setColorFilter(e.target.value)} placeholder={t("allColors")}  options={colors.map(c => ({ value: c.id, label: c.label_fr }))} />
        {anyFilter && (
          <button
            onClick={() => { setCatFilter(""); setSizeFilter(""); setColorFilter("") }}
            style={{ height: 42, borderRadius: 8, border: "1px solid var(--border)", background: "none", cursor: "pointer", fontSize: 12, color: "var(--text-muted)" }}
          >
            {t("clearFilters")}
          </button>
        )}
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: "center", color: "var(--text-muted)", paddingTop: 64, fontSize: 13 }}>
          {t("noProducts")}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 16 }}>
          {filtered.map(p => {
            const totalStock = p.variants.reduce((s, v) => s + v.stock, 0)
            const isOut      = totalStock === 0
            const name   = locale === "ar" ? p.name_ar : p.name_fr
            const availSizes = [...new Set(
              p.variants
                .filter((v): v is typeof v & { sizeId: string } => v.stock > 0 && v.sizeId !== null)
                .map(v => lookupMap[v.sizeId]?.label_fr)
                .filter((s): s is string => typeof s === "string")
            )]

            return (
              <div
                key={p.id}
                style={{
                  background:       "var(--surface)",
                  border:           "1px solid var(--border)",
                  borderInlineStart: `3px solid ${isOut ? "var(--danger)" : "var(--success)"}`,
                  borderRadius:     10,
                  overflow:         "hidden",
                }}
              >
                {/* Image */}
                <div style={{ aspectRatio: "4/3", background: "var(--surface-2)", overflow: "hidden" }}>
                  {p.images[0]
                    ? <img src={p.images[0]} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36 }}>🧳</div>
                  }
                </div>

                {/* Info */}
                <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 6 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", margin: 0, lineHeight: 1.3 }}>{name}</p>
                  <p style={{ fontSize: 14, fontWeight: 700, color: "var(--primary)", margin: 0 }}>{formatMAD(p.sellingPrice)}</p>
                  <p style={{ fontSize: 11, color: isOut ? "var(--danger)" : "var(--success)", fontWeight: 500, margin: 0 }}>
                    {isOut ? t("outOfStock") : `${totalStock} ${t("inStock")}`}
                  </p>

                  {/* Size chips */}
                  {availSizes.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {availSizes.slice(0, 5).map(s => (
                        <span key={s} style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: "var(--surface-2)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
                          {s}
                        </span>
                      ))}
                      {availSizes.length > 5 && (
                        <span style={{ fontSize: 10, color: "var(--text-muted)" }}>+{availSizes.length - 5}</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}