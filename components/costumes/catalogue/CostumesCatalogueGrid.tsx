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
import type { CostumeItemType }         from "@prisma/client"

const TYPE_OPTIONS = [
  { value: "suit",      label: "Costume"    },
  { value: "vest",      label: "Gilet"      },
  { value: "shoes",     label: "Chaussures" },
  { value: "accessory", label: "Accessoire" },
]

interface Props {
  items:     CostumeItemForCatalogue[]
  sizes:     LookupItem[]
  colors:    LookupItem[]
  lookupById: LookupById
  locale:    string
}

export function CostumesCatalogueGrid({ items, sizes, colors, lookupById, locale }: Props) {
  const [search,     setSearch]     = useState("")
  const [typeFilter, setTypeFilter] = useState("")
  const [sizeFilter, setSizeFilter] = useState("")
  const [colorFilter, setColorFilter] = useState("")

  const filtered = useMemo(() => items.filter(i => {
    const q = search.trim().toLowerCase()
    return (!typeFilter  || i.type    === typeFilter)
      &&   (!sizeFilter  || i.sizeId  === sizeFilter)
      &&   (!colorFilter || i.colorId === colorFilter)
      &&   (!q || i.name_fr.toLowerCase().includes(q) || i.name_ar.includes(q))
  }), [items, search, typeFilter, sizeFilter, colorFilter])

  const hasFilters = typeFilter || sizeFilter || colorFilter || search

  return (
    <div style={{ padding: 8 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.02em", margin: 0 }}>Catalogue</h1>
        <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{filtered.length} article(s)</span>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, alignItems: "flex-end", marginBottom: 20, flexWrap: "wrap" }}>
        <div style={{ flex: "2 1 200px" }}>
          <SearchBar value={search} onChange={setSearch} placeholder="Rechercher un article..." />
        </div>
        <div style={{ flex: "1 1 140px" }}>
          <Select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
            placeholder="Tous les types"
            options={TYPE_OPTIONS} />
        </div>
        <div style={{ flex: "1 1 140px" }}>
          <Select value={sizeFilter} onChange={e => setSizeFilter(e.target.value)}
            placeholder="Toutes les tailles"
            options={sizes.map(s => ({ value: s.id, label: s.label_fr }))} />
        </div>
        <div style={{ flex: "1 1 140px" }}>
          <Select value={colorFilter} onChange={e => setColorFilter(e.target.value)}
            placeholder="Toutes les couleurs"
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
          Aucun article dans le catalogue.
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
              <div key={item.id} style={{
                background: "var(--surface)", border: "1px solid var(--border)",
                borderRadius: 12, overflow: "hidden",
                opacity: isOut ? 0.6 : 1,
              }}>
                <div style={{ width: "100%", aspectRatio: "4/5", overflow: "hidden", background: "var(--surface-2)", position: "relative" }}>
                  {item.images[0]
                    ? <img src={item.images[0]} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}><Package size={32} style={{ color: "var(--border)" }} /></div>
                  }
                  <div style={{ position: "absolute", top: 8, insetInlineEnd: 8 }}>
                    <Badge variant={isOut ? "danger" : item.stock <= 2 ? "warning" : "success"}>
                      {isOut ? "Épuisé" : `×${item.stock}`}
                    </Badge>
                  </div>
                </div>
                <div style={{ padding: "10px 12px 12px" }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", margin: "0 0 2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</p>
                  {lbl && <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "0 0 8px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{lbl}</p>}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>{formatMAD(item.sellingPrice)}</span>
                    <Badge variant="default">{TYPE_OPTIONS.find(t => t.value === item.type)?.label ?? item.type}</Badge>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}