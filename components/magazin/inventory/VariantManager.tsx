"use client"

import { useTranslations, useLocale } from "next-intl"
import { Plus, Trash2 }    from "lucide-react"
import { Select }          from "@/components/ui/Select"
import type { VariantInput } from "@/lib/actions/magazin/inventory"
import React from "react"

type LookupItem = { id: string; label_fr: string; label_ar: string }

interface VariantManagerProps {
  variants: VariantInput[]
  onChange: (variants: VariantInput[]) => void
  sizes:    LookupItem[]
  colors:   LookupItem[]
}

export function VariantManager({ variants, onChange, sizes, colors }: VariantManagerProps) {
  const tInv = useTranslations("magazin.inventory")
  const tCom = useTranslations("common")
  const locale = useLocale()

  const addRow = () =>
    onChange([...variants, { sizeId: null, colorId: null, stock: 1 }])

  const updateRow = (i: number, updates: Partial<VariantInput>) =>
    onChange(variants.map((v, idx) => idx === i ? { ...v, ...updates } : v))

  const removeRow = (i: number) => {
    if (variants[i].id) {
      onChange(variants.map((v, idx) => idx === i ? { ...v, stock: 0 } : v))
    } else {
      onChange(variants.filter((_, idx) => idx !== i))
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {variants.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 80px 36px", gap: 8 }}>
          {[tInv("size"), tInv("color"), tInv("stock"), ""].map(h => (
            <span key={h} style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {h}
            </span>
          ))}
        </div>
      )}

      {variants.map((v, i) => (
        <div
          key={i}
          style={{
            display:             "grid",
            gridTemplateColumns: "1fr 1fr 80px 36px",
            gap:                 8,
            alignItems:          "center",
            opacity:             v.id && v.stock === 0 ? 0.5 : 1,
          }}
        >
          <Select
            value={v.sizeId ?? ""}
            onChange={e => updateRow(i, { sizeId: e.target.value || null })}
            placeholder="-"
            options={sizes.map(s => ({ value: s.id, label: locale === "ar" ? s.label_ar : s.label_fr }))}
          />
          <Select
            value={v.colorId ?? ""}
            onChange={e => updateRow(i, { colorId: e.target.value || null })}
            placeholder="-"
            options={colors.map(c => ({ value: c.id, label: locale === "ar" ? c.label_ar : c.label_fr }))}
          />
          <input
            type="number"
            min="0"
            value={v.stock}
            onChange={e => updateRow(i, { stock: Math.max(0, parseInt(e.target.value) || 0) })}
            style={{
              height:        42,
              background:    "var(--surface-2)",
              border:        "1px solid var(--border)",
              borderRadius:  8,
              paddingInline: 10,
              fontSize:      13,
              color:         "var(--text)",
              outline:       "none",
              width:         "100%",
            }}
          />
          <button
            onClick={() => removeRow(i)}
            title={v.id ? tInv("zeroStock") : tCom("delete")}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "flex", alignItems: "center", justifyContent: "center", height: 42 }}
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}

      <button
        onClick={addRow}
        style={{
          display:      "flex",
          alignItems:   "center",
          gap:          6,
          padding:      "8px 12px",
          background:   "var(--surface-2)",
          border:       "1px dashed var(--border)",
          borderRadius: 8,
          cursor:       "pointer",
          color:        "var(--text-muted)",
          fontSize:     12,
          fontWeight:   500,
        }}
      >
        <Plus size={13} />
        {tInv("addVariantRow")}
      </button>
    </div>
  )
}
