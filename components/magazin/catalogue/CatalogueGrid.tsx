"use client"

import { useState, useMemo } from "react"
import Image         from "next/image"
import { Select }    from "@/components/ui/Select"
import { formatMAD } from "@/lib/utils/currency"
import { useTranslations } from "next-intl"
import type { ProductForPOS as ProductForCatalogue } from "@/lib/actions/magazin/pos"
import React from "react"

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

export function CatalogueGrid({ products, categories, sizes, colors, lookupById }: CatalogueGridProps) {
  const t = useTranslations("magazin.catalogue")
  const [catFilter,      setCatFilter]      = useState("")
  const [sizeFilter,     setSizeFilter]     = useState("")
  const [colorFilter,    setColorFilter]    = useState("")
  const [selectedProduct, setSelectedProduct] = useState<ProductForCatalogue | null>(null)
  const [selectedImgIdx,  setSelectedImgIdx]  = useState(0)

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

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(175px, 1fr))", gap: 12, alignItems: "end" }}>
        <Select value={catFilter}   onChange={e => setCatFilter(e.target.value)}   placeholder={t("allCategories")} options={categories.map(c => ({ value: c.id, label: c.label_ar }))} />
        <Select value={sizeFilter}  onChange={e => setSizeFilter(e.target.value)}  placeholder={t("allSizes")}   options={sizes.map(s => ({ value: s.id, label: s.label_ar }))} />
        <Select value={colorFilter} onChange={e => setColorFilter(e.target.value)} placeholder={t("allColors")}  options={colors.map(c => ({ value: c.id, label: c.label_ar }))} />
        {anyFilter && (
          <button
            onClick={() => { setCatFilter(""); setSizeFilter(""); setColorFilter("") }}
            style={{ height: 42, borderRadius: 8, border: "1px solid var(--border)", background: "none", cursor: "pointer", fontSize: 12, color: "var(--text-muted)" }}
          >
            {t("clearFilters")}
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: "center", color: "var(--text-muted)", paddingTop: 64, fontSize: 13 }}>
          {t("noProducts")}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 16 }}>
          {filtered.map(p => {
            const totalStock = p.variants.reduce((s, v) => s + v.stock, 0)
            const isOut      = totalStock === 0
            const name       = p.name_ar
            const availSizes = [...new Set(
              p.variants
                .filter((v): v is typeof v & { sizeId: string } => v.stock > 0 && v.sizeId !== null)
                .map(v => lookupMap[v.sizeId]?.label_ar)
                .filter((s): s is string => typeof s === "string")
            )]

            return (
              <div
                key={p.id}
                onClick={() => { setSelectedProduct(p); setSelectedImgIdx(0) }}
                style={{
                  background:        "var(--surface)",
                  border:            "1px solid var(--border)",
                  borderInlineStart: `3px solid ${isOut ? "var(--danger)" : "var(--success)"}`,
                  borderRadius:      10,
                  overflow:          "hidden",
                  cursor:            "pointer",
                  transition:        "box-shadow 0.15s, transform 0.15s",
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = "0 4px 20px rgba(0,0,0,0.12)"; (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)" }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = "none"; (e.currentTarget as HTMLDivElement).style.transform = "none" }}
              >
                <div style={{ aspectRatio: "4/3", background: "var(--surface-2)", overflow: "hidden", position: "relative" }}>
                  {p.images[0]
                    ? <Image src={p.images[0]} alt={name} fill style={{ objectFit: "cover" }} />
                    : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36 }}>🧳</div>
                  }
                </div>

                <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 6 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", margin: 0, lineHeight: 1.3 }}>{name}</p>
                  <p style={{ fontSize: 14, fontWeight: 700, color: "var(--primary)", margin: 0 }}>{formatMAD(p.sellingPrice)}</p>
                  <p style={{ fontSize: 11, color: isOut ? "var(--danger)" : "var(--success)", fontWeight: 500, margin: 0 }}>
                    {isOut ? t("outOfStock") : `${totalStock} ${t("inStock")}`}
                  </p>

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

      {selectedProduct && (() => {
        const sp         = selectedProduct
        const spStock    = sp.variants.reduce((s, v) => s + v.stock, 0)
        const spIsOut    = spStock === 0
        const spName     = sp.name_ar
        const spSizes    = [...new Set(
          sp.variants
            .filter((v): v is typeof v & { sizeId: string } => v.stock > 0 && v.sizeId !== null)
            .map(v => lookupMap[v.sizeId]?.label_ar)
            .filter((s): s is string => typeof s === "string")
        )]
        const spColors   = [...new Set(
          sp.variants
            .filter((v): v is typeof v & { colorId: string } => v.stock > 0 && v.colorId !== null)
            .map(v => lookupMap[v.colorId]?.label_ar)
            .filter((s): s is string => typeof s === "string")
        )]
        const imgs       = sp.images.length > 0 ? sp.images : []
        const imgIdx     = Math.min(selectedImgIdx, Math.max(0, imgs.length - 1))

        return (
          <div
            onClick={() => setSelectedProduct(null)}
            style={{
              position: "fixed", inset: 0,
              background: "rgba(0,0,0,0.78)",
              backdropFilter: "blur(5px)",
              display: "flex", alignItems: "center", justifyContent: "center",
              zIndex: 1000, padding: 16,
            }}
          >
            <div
              onClick={e => e.stopPropagation()}
              style={{
                background: "var(--surface)", borderRadius: 18,
                overflow: "hidden", width: "100%", maxWidth: 460,
                maxHeight: "92vh", display: "flex", flexDirection: "column",
                position: "relative",
                boxShadow: "0 24px 64px rgba(0,0,0,0.4)",
              }}
            >
              <button
                onClick={() => setSelectedProduct(null)}
                style={{
                  position: "absolute", top: 12, insetInlineEnd: 12,
                  width: 34, height: 34,
                  background: "rgba(0,0,0,0.55)", border: "none",
                  borderRadius: "50%", cursor: "pointer", color: "#fff",
                  fontSize: 16, display: "flex", alignItems: "center",
                  justifyContent: "center", zIndex: 2,
                }}
              >
                ✕
              </button>

              <div style={{ width: "100%", aspectRatio: "4/3", background: "var(--surface-2)", overflow: "hidden", flexShrink: 0, position: "relative" }}>
                {imgs.length > 0 ? (
                  <>
                    <Image src={imgs[imgIdx]} alt={spName} fill style={{ objectFit: "cover" }} />
                    {imgs.length > 1 && (
                      <>
                        <button
                          onClick={e => { e.stopPropagation(); setSelectedImgIdx(i => Math.max(0, i - 1)) }}
                          style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", width: 32, height: 32, background: "rgba(0,0,0,0.45)", border: "none", borderRadius: "50%", color: "#fff", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", opacity: imgIdx === 0 ? 0.3 : 1 }}
                        >‹</button>
                        <button
                          onClick={e => { e.stopPropagation(); setSelectedImgIdx(i => Math.min(imgs.length - 1, i + 1)) }}
                          style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", width: 32, height: 32, background: "rgba(0,0,0,0.45)", border: "none", borderRadius: "50%", color: "#fff", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", opacity: imgIdx === imgs.length - 1 ? 0.3 : 1 }}
                        >›</button>
                        <div style={{ position: "absolute", bottom: 10, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 5 }}>
                          {imgs.map((_, i) => (
                            <div key={i} onClick={e => { e.stopPropagation(); setSelectedImgIdx(i) }} style={{ width: 7, height: 7, borderRadius: "50%", background: i === imgIdx ? "#fff" : "rgba(255,255,255,0.4)", cursor: "pointer", transition: "background 0.15s" }} />
                          ))}
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 56 }}>🧳</div>
                )}
              </div>

              <div style={{ padding: "18px 22px 24px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                  <h2 style={{ fontSize: 19, fontWeight: 700, color: "var(--text)", margin: 0, lineHeight: 1.3, flex: 1 }}>{spName}</h2>
                  <span style={{
                    flexShrink: 0, fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 999,
                    color:      spIsOut ? "var(--danger)" : "var(--success)",
                    background: spIsOut ? "color-mix(in srgb,var(--danger) 12%,transparent)" : "color-mix(in srgb,var(--success) 12%,transparent)",
                  }}>
                    {spIsOut ? t("outOfStock") : `${spStock} ${t("inStock")}`}
                  </span>
                </div>

                <p style={{ fontSize: 26, fontWeight: 700, color: "var(--primary)", margin: 0, letterSpacing: "-0.02em" }}>
                  {formatMAD(sp.sellingPrice)}
                </p>

                {spSizes.length > 0 && (
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 8px" }}>{t("availableSizes")}</p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {spSizes.map(s => (
                        <span key={s} style={{ fontSize: 12, padding: "5px 13px", borderRadius: 6, background: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border)", fontWeight: 500 }}>{s}</span>
                      ))}
                    </div>
                  </div>
                )}

                {spColors.length > 0 && (
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 8px" }}>{t("availableColors")}</p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {spColors.map(c => (
                        <span key={c} style={{ fontSize: 12, padding: "5px 13px", borderRadius: 6, background: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border)", fontWeight: 500 }}>{c}</span>
                      ))}
                    </div>
                  </div>
                )}

                {sp.variants.length > 0 && (
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 8px" }}>
                      {t("stockByVariant")}
                    </p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                      {sp.variants.map((v, i) => {
                        const sizeLabel  = v.sizeId  ? (lookupMap[v.sizeId]?.label_ar  ?? "?") : null
                        const colorLabel = v.colorId ? (lookupMap[v.colorId]?.label_ar ?? "?") : null
                        const label      = [sizeLabel, colorLabel].filter(Boolean).join(" / ") || "-"
                        const isOut      = v.stock === 0
                        const isLow      = v.stock > 0 && v.stock <= 2
                        return (
                          <div
                            key={i}
                            style={{
                              display:        "flex",
                              alignItems:     "center",
                              justifyContent: "space-between",
                              padding:        "7px 12px",
                              borderRadius:   8,
                              background:     "var(--surface-2)",
                              border:         "1px solid var(--border)",
                              opacity:        isOut ? 0.55 : 1,
                            }}
                          >
                            <span style={{ fontSize: 12, color: "var(--text)", fontWeight: 500 }}>{label}</span>
                            <span style={{
                              fontSize:   12,
                              fontWeight: 700,
                              padding:    "2px 10px",
                              borderRadius: 999,
                              color:      isOut ? "var(--danger)" : isLow ? "var(--warning)" : "var(--success)",
                              background: isOut ? "color-mix(in srgb,var(--danger)  12%,transparent)"
                                        : isLow ? "color-mix(in srgb,var(--warning) 12%,transparent)"
                                        :         "color-mix(in srgb,var(--success) 12%,transparent)",
                            }}>
                              {isOut ? t("outOfStock") : `${v.stock} ${t("units")}`}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}