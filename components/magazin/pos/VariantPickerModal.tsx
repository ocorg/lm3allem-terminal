"use client"

import { Modal }     from "@/components/ui/Modal"
import { formatMAD } from "@/lib/utils/currency"
import type { ProductForPOS } from "@/lib/actions/magazin/pos"

type LookupItem = { id: string; label_fr: string; label_ar: string }

interface VariantPickerModalProps {
  isOpen:    boolean
  product:   ProductForPOS
  lookupById: Record<string, LookupItem>
  locale:    string
  onClose:   () => void
  onSelect:  (variantId: string) => void
}

export function VariantPickerModal({
  isOpen,
  product,
  lookupById,
  locale,
  onClose,
  onSelect,
}: VariantPickerModalProps) {
  const name = locale === "ar" ? product.name_ar : product.name_fr

  const getLabel = (v: { sizeId: string | null; colorId: string | null }) => {
    const parts: string[] = []
    if (v.sizeId  && lookupById[v.sizeId])  parts.push(locale === "ar" ? lookupById[v.sizeId].label_ar  : lookupById[v.sizeId].label_fr)
    if (v.colorId && lookupById[v.colorId]) parts.push(locale === "ar" ? lookupById[v.colorId].label_ar : lookupById[v.colorId].label_fr)
    return parts.join(" — ") || "Standard"
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={name} size="sm">
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>
          Choisissez une variante :
        </p>

        {product.variants.map(v => {
          const isOut = v.stock === 0
          return (
            <button
              key={v.id}
              disabled={isOut}
              onClick={() => { onSelect(v.id); onClose() }}
              style={{
                display:        "flex",
                alignItems:     "center",
                justifyContent: "space-between",
                padding:        "12px 14px",
                borderRadius:   8,
                background:     "var(--surface)",
                border:         "1px solid var(--border)",
                cursor:         isOut ? "not-allowed" : "pointer",
                opacity:        isOut ? 0.45 : 1,
                textAlign:      "start",
                transition:     "border-color 150ms",
              }}
            >
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", margin: 0 }}>
                  {getLabel(v)}
                </p>
                <p style={{ fontSize: 11, color: isOut ? "var(--danger)" : "var(--success)", margin: "2px 0 0", fontWeight: 500 }}>
                  {isOut ? "Épuisé" : `${v.stock} en stock`}
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