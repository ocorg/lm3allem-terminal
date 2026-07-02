"use client"

import { useState, useMemo } from "react"
import { SearchBar } from "@/components/ui/SearchBar"
import { formatMAD } from "@/lib/utils/currency"
import type { ProductForPOS } from "@/lib/actions/magazin/pos"
import React from "react"

type LookupItem = { id: string; label_fr: string; label_ar: string }

interface ProductGridProps {
  products:       ProductForPOS[]
  categories:     LookupItem[]
  locale:         string
  onProductClick: (product: ProductForPOS) => void
}

export function ProductGrid({ products, categories, locale, onProductClick }: ProductGridProps) {
  const [search,         setSearch]         = useState("")
  const [activeCategory, setActiveCategory] = useState<string | null>(null)

  const filtered = useMemo(() => products.filter(p => {
    const matchCat    = !activeCategory || p.categoryId === activeCategory
    const matchSearch = !search.trim()
      || p.name_fr.toLowerCase().includes(search.toLowerCase())
      || p.name_ar.includes(search)
    return matchCat && matchSearch
  }), [products, activeCategory, search])

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>

      {/* Search bar */}
      <div style={{ padding: "12px 16px 0" }}>
        <SearchBar value={search} onChange={setSearch} placeholder="Rechercher un produit..." />
      </div>

      {/* Category tabs */}
      <div
        style={{
          display:       "flex",
          gap:           4,
          padding:       "12px 16px",
          overflowX:     "auto",
          flexShrink:    0,
          scrollbarWidth: "none",
        }}
      >
        <CategoryTab label="Tous" active={!activeCategory} onClick={() => setActiveCategory(null)} />
        {categories.map(cat => (
          <CategoryTab
            key={cat.id}
            label={locale === "ar" ? cat.label_ar : cat.label_fr}
            active={activeCategory === cat.id}
            onClick={() => setActiveCategory(cat.id)}
          />
        ))}
      </div>

      {/* Product grid */}
      <div style={{ flex: 1, overflowY: "auto", padding: "0 16px 16px" }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: "center", color: "var(--text-muted)", paddingTop: 64, fontSize: 13 }}>
            Aucun produit
          </div>
        ) : (
          <div
            style={{
              display:             "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
              gap:                 12,
            }}
          >
            {filtered.map(product => {
              const totalStock = product.variants.reduce((s, v) => s + v.stock, 0)
              const isOut      = totalStock === 0
              const name       = locale === "ar" ? product.name_ar : product.name_fr

              return (
                <button
                  key={product.id}
                  onClick={() => !isOut && onProductClick(product)}
                  disabled={isOut}
                  style={{
                    background:  "var(--surface)",
                    border:      "1px solid var(--border)",
                    borderRadius: 10,
                    padding:     0,
                    overflow:    "hidden",
                    cursor:      isOut ? "not-allowed" : "pointer",
                    opacity:     isOut ? 0.5 : 1,
                    textAlign:   "start",
                    transition:  "box-shadow 150ms",
                  }}
                >
                  {/* Image */}
                  <div style={{ width: "100%", aspectRatio: "4/3", background: "var(--surface-2)", overflow: "hidden" }}>
                    {product.images[0] ? (
                      <img src={product.images[0]} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32 }}>
                        🧳
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div style={{ padding: "10px 10px 12px" }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", margin: 0, lineHeight: 1.3, marginBottom: 4 }}>
                      {name}
                    </p>
                    <p style={{ fontSize: 13, fontWeight: 700, color: "var(--primary)", margin: 0 }}>
                      {formatMAD(product.sellingPrice)}
                    </p>
                    <p style={{ fontSize: 11, color: isOut ? "var(--danger)" : "var(--success)", margin: "4px 0 0", fontWeight: 500 }}>
                      {isOut ? "Épuisé" : `${totalStock} en stock`}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function CategoryTab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding:     "6px 14px",
        borderRadius: 999,
        fontSize:    12,
        fontWeight:  600,
        cursor:      "pointer",
        whiteSpace:  "nowrap",
        flexShrink:  0,
        border:      "none",
        background:  active ? "var(--primary)" : "var(--surface-2)",
        color:       active ? "#1a1a1a"        : "var(--text-muted)",
        transition:  "background 150ms",
      }}
    >
      {label}
    </button>
  )
}