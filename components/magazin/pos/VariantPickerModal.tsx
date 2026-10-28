"use client"

import { Modal }     from "@/components/ui/Modal"
import { formatMAD } from "@/lib/utils/currency"
import type { ProductForPOS } from "@/lib/actions/magazin/pos"
import React from "react"

type LookupMapItem = { label_fr: string; label_ar: string }

interface VariantPickerModalProps {
  isOpen:    boolean
  product:   ProductForPOS
  lookupById: Record<string, LookupMapItem>
  locale:    string
  onClose:   () => void
  onSelect:  (variantId: string) => void
  /** pieces of each size already in the cart */
  inCart?:   Record<string, number>
}

export function VariantPickerModal({
  isOpen,
  product,
  lookupById,
  locale,
  onClose,
  onSelect,
  inCart = {},
}: VariantPickerModalProps) {
  const name = locale === "ar" ? product.name_ar : product.name_fr

  const getLabel = (v: { sizeId: string | null; colorId: string | null }) => {
    const parts: string[] = []
    if (v.sizeId  && lookupById[v.sizeId])  parts.push(locale === "ar" ? lookupById[v.sizeId].label_ar  : lookupById[v.sizeId].label_fr)
    if (v.colorId && lookupById[v.colorId]) parts.push(locale === "ar" ? lookupById[v.colorId].label_ar : lookupById[v.colorId].label_fr)
    return parts.join(" - ") || "مقاس موحد"
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={name} size="sm">
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>
          اختر المقاس واللون:
        </p>

        {product.variants.map(v => {
          const isOut   = v.stock === 0
          const taken   = inCart[v.id] ?? 0
          const allIn   = !isOut && taken >= v.stock
          const blocked = isOut || allIn
          return (
            <button
              key={v.id}
              disabled={blocked}
              onClick={() => { onSelect(v.id); onClose() }}
              style={{
                display:        "flex",
                alignItems:     "center",
                justifyContent: "space-between",
                padding:        "12px 14px",
                borderRadius:   8,
                background:     "var(--surface)",
                border:         "1px solid var(--border)",
                cursor:         blocked ? "not-allowed" : "pointer",
                opacity:        blocked ? 0.55 : 1,
                minHeight:      56,
                textAlign:      "start",
                transition:     "border-color 150ms",
              }}
            >
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", margin: 0 }}>
                  {getLabel(v)}
                </p>
                <p style={{ fontSize: 12, color: isOut ? "var(--danger)" : v.stock === 1 ? "var(--warning)" : "var(--success)", margin: "2px 0 0", fontWeight: 500 }}>
                  {isOut ? "نفد المخزون" : v.stock === 1 ? "آخر قطعة" : `${v.stock} في المخزون`}
                  {taken > 0 && <span style={{ color: "var(--text-muted)" }}>{` | في السلة: ${taken}`}{allIn ? " (كل المتوفر)" : ""}</span>}
                </p>
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--primary)" }}>
                {formatMAD(product.sellingPrice)}
              </span>
            </button>
          )
        })}
      </div>
    </Modal>
  )
}