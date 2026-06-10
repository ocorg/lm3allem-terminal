"use client"

import { useState, useMemo } from "react"
import { Package }           from "lucide-react"
import { SearchBar }         from "@/components/ui/SearchBar"
import { Select }            from "@/components/ui/Select"
import { Badge }             from "@/components/ui/Badge"
import { Button }            from "@/components/ui/Button"
import { formatMAD }         from "@/lib/utils/currency"
import type { CostumeItemForCatalogue } from "@/lib/actions/costumes/catalogue"
import type { LookupItem, LookupById }  from "@/lib/actions/costumes/pos"
import { useTranslations } from "next-intl"
interface Props {
  items:        CostumeItemForCatalogue[]
  sizes:        LookupItem[]
  colors:       LookupItem[]
  costumeTypes: LookupItem[]
  lookupById:   LookupById
  locale:       string
}

export function CostumesCatalogueGrid({ items, sizes, colors, costumeTypes, lookupById, locale }: Props) {
  const t = useTranslations("costumes")
  const TYPE_OPTIONS = costumeTypes.map(t => ({ value: t.id, label: t.label_fr }))
  const [search,       setSearch]       = useState("")
  const [selectedItem, setSelectedItem] = useState<CostumeItemForCatalogue | null>(null)
  const [selectedImgIdx, setSelectedImgIdx] = useState(0)
  const [typeFilter, setTypeFilter] = useState("")
  const [sizeFilter, setSizeFilter] = useState("")
  const [colorFilter, setColorFilter] = useState("")

  const filtered = useMemo(() => items.filter(i => {
    const q = search.trim().toLowerCase()
    return (!typeFilter  || i.typeId  === typeFilter)
      &&   (!sizeFilter  || i.sizeId  === sizeFilter)
      &&   (!colorFilter || i.colorId === colorFilter)
      &&   (!q || i.name_fr.toLowerCase().includes(q) || i.name_ar.includes(q))
  }), [items, search, typeFilter, sizeFilter, colorFilter])

  const hasFilters = typeFilter || sizeFilter || colorFilter || search

  return (
    <div style={{ padding: 8 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.02em", margin: 0 }}>{t("catalogue.title")}</h1>
        <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{filtered.length} article(s)</span>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, alignItems: "flex-end", marginBottom: 20, flexWrap: "wrap" }}>
        <div style={{ flex: "2 1 200px" }}>
          <SearchBar value={search} onChange={setSearch} placeholder="Rechercher un article..." />
        </div>
        <div style={{ flex: "1 1 140px" }}>
          <Select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
            placeholder={t("catalogue.allTypes")}
            options={TYPE_OPTIONS} />
        </div>
        <div style={{ flex: "1 1 140px" }}>
          <Select value={sizeFilter} onChange={e => setSizeFilter(e.target.value)}
            placeholder={t("catalogue.allSizes")}
            options={sizes.map(s => ({ value: s.id, label: s.label_fr }))} />
        </div>
        <div style={{ flex: "1 1 140px" }}>
          <Select value={colorFilter} onChange={e => setColorFilter(e.target.value)}
            placeholder={t("catalogue.allColors")}
            options={colors.map(c => ({ value: c.id, label: c.label_fr }))} />
        </div>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setTypeFilter(""); setSizeFilter(""); setColorFilter("") }}>
            Effacer
          </Button>
        )}
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: "center", color: "var(--text-muted)", paddingTop: 80, fontSize: 14 }}>
          {t("catalogue.noItems")}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 16 }}>
          {filtered.map(item => {
            const isOut = item.stock === 0
            const name  = locale === "ar" ? item.name_ar : item.name_fr
            const lbl   = [
              item.sizeId  && lookupById[item.sizeId]  ? lookupById[item.sizeId].label_fr  : null,
              item.colorId && lookupById[item.colorId] ? lookupById[item.colorId].label_fr : null,
            ].filter(Boolean).join(" · ")
            return (
              <div
                key={item.id}
                onClick={() => { setSelectedItem(item); setSelectedImgIdx(0) }}
                style={{
                  background: "var(--surface)", border: "1px solid var(--border)",
                  borderRadius: 12, overflow: "hidden",
                  opacity: isOut ? 0.6 : 1,
                  cursor: "pointer",
                  transition: "box-shadow 0.15s, transform 0.15s",
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = "0 4px 20px rgba(0,0,0,0.12)"; (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)" }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = "none"; (e.currentTarget as HTMLDivElement).style.transform = "none" }}
              >
                <div style={{ width: "100%", aspectRatio: "4/5", overflow: "hidden", background: "var(--surface-2)", position: "relative" }}>
                  {item.images[0]
                    ? <img src={item.images[0]} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}><Package size={32} style={{ color: "var(--border)" }} /></div>
                  }
                  <div style={{ position: "absolute", top: 8, insetInlineEnd: 8 }}>
                    <Badge variant={isOut ? "danger" : item.stock <= 2 ? "warning" : "success"}>
                      {isOut ? t("catalogue.outOfStock") : `×${item.stock}`}
                    </Badge>
                  </div>
                </div>
                <div style={{ padding: "10px 12px 12px" }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", margin: "0 0 2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</p>
                  {lbl && <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "0 0 8px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{lbl}</p>}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>{formatMAD(item.sellingPrice)}</span>
                    <Badge variant="default">{item.typeLabelFr}</Badge>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Expanded item overlay ── */}
      {selectedItem && (() => {
        const si     = selectedItem
        const siName = locale === "ar" ? si.name_ar : si.name_fr
        const siLbl  = [
          si.sizeId  && lookupById[si.sizeId]  ? lookupById[si.sizeId].label_fr  : null,
          si.colorId && lookupById[si.colorId] ? lookupById[si.colorId].label_fr : null,
        ].filter(Boolean).join(" · ")
        const siType = si.typeLabelFr
        const isOut  = si.stock === 0
        const imgs   = si.images.length > 0 ? si.images : []
        const imgIdx = Math.min(selectedImgIdx, Math.max(0, imgs.length - 1))

        return (
          <div
            onClick={() => setSelectedItem(null)}
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
                overflow: "hidden", width: "100%", maxWidth: 440,
                maxHeight: "92vh", display: "flex", flexDirection: "column",
                position: "relative",
                boxShadow: "0 24px 64px rgba(0,0,0,0.4)",
              }}
            >
              {/* Close button */}
              <button
                onClick={() => setSelectedItem(null)}
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

              {/* Image */}
              <div style={{ width: "100%", aspectRatio: "4/5", background: "var(--surface-2)", overflow: "hidden", flexShrink: 0, position: "relative" }}>
                {imgs.length > 0 ? (
                  <>
                    <img src={imgs[imgIdx]} alt={siName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
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
                    {/* Stock badge over image */}
                    <div style={{ position: "absolute", top: 12, insetInlineStart: 12 }}>
                      <Badge variant={isOut ? "danger" : si.stock <= 2 ? "warning" : "success"}>
                        {isOut ? t("catalogue.outOfStock") : `×${si.stock}`}
                      </Badge>
                    </div>
                  </>
                ) : (
                  <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Package size={64} style={{ color: "var(--border)" }} />
                  </div>
                )}
              </div>

              {/* Details */}
              <div style={{ padding: "18px 22px 24px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                  <h2 style={{ fontSize: 19, fontWeight: 700, color: "var(--text)", margin: 0, lineHeight: 1.3, flex: 1 }}>{siName}</h2>
                  <Badge variant="default">{siType}</Badge>
                </div>

                {siLbl && (
                  <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>{siLbl}</p>
                )}

                <p style={{ fontSize: 26, fontWeight: 700, color: "var(--text)", margin: 0, letterSpacing: "-0.02em" }}>
                  {formatMAD(si.sellingPrice)}
                </p>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}