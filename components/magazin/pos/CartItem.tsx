"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { Minus, Plus, Trash2 } from "lucide-react"
import { formatMAD } from "@/lib/utils/currency"
import type { CartItem } from "./POSClient"
import React from "react"
import { IconButton } from "@/components/ui/IconButton"

interface CartItemProps {
  item:          CartItem
  onUpdateQty:   (qty: number) => void
  onUpdatePrice: (price: number) => void
  onRemove:      () => void
}

export function CartItem({ item, onUpdateQty, onUpdatePrice, onRemove }: CartItemProps) {
  const t = useTranslations("magazin.pos")
  const [priceStr, setPriceStr] = useState(String(item.unitPrice === 0 ? "" : item.unitPrice))
  const [prevUnitPrice, setPrevUnitPrice] = useState(item.unitPrice)
  const isBelowMin = item.unitPrice < item.minSellingPrice
  const lineTotal  = item.unitPrice * item.quantity

  // Sync if parent resets price (compared during render, not in an effect)
  if (item.unitPrice !== prevUnitPrice) {
    setPrevUnitPrice(item.unitPrice)
    setPriceStr(String(item.unitPrice === 0 ? "" : item.unitPrice))
  }

  const commitPrice = (raw: string) => {
    const parsed = parseFloat(raw)
    if (!isNaN(parsed) && parsed >= 0) {
      onUpdatePrice(parsed)
      setPriceStr(parsed.toFixed(2))
    } else {
      setPriceStr(item.unitPrice.toFixed(2))
    }
  }

  return (
    <div
      style={{
        padding:     "10px 16px",
        borderBottom: "1px solid var(--border)",
        background:  isBelowMin ? "color-mix(in srgb, var(--danger) 4%, transparent)" : undefined,
      }}
    >
      {/* Name row */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {item.name_ar}
          </p>
          <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "1px 0 0" }}>
            {item.variantLabel}
          </p>
          {isBelowMin && (
            <p style={{ fontSize: 12, color: "var(--danger)", margin: "2px 0 0", fontWeight: 600 }}>
              ▼ {t("belowMin", { price: formatMAD(item.minSellingPrice) })}
            </p>
          )}
        </div>
        <IconButton label="حذف من السلة" tone="danger" size="sm" onClick={onRemove}>
          <Trash2 size={16} />
        </IconButton>
      </div>

      {/* Controls row */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>

        {/* Qty */}
        <div style={{ display: "flex", alignItems: "center", border: "1px solid var(--border)", borderRadius: 6, overflow: "hidden", flexShrink: 0 }}>
          <IconButton label="إنقاص الكمية" size="sm" onClick={() => onUpdateQty(item.quantity - 1)} style={{ border: "none", borderRadius: 0, background: "var(--surface-2)" }}>
            <Minus size={16} />
          </IconButton>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", minWidth: 32, textAlign: "center" }}>
            {item.quantity}
          </span>
          <IconButton label="زيادة الكمية" size="sm" disabled={item.quantity >= item.stock} onClick={() => onUpdateQty(item.quantity + 1)} style={{ border: "none", borderRadius: 0, background: "var(--surface-2)" }}>
            <Plus size={16} />
          </IconButton>
        </div>

        {/* Unit price (editable) */}
        <div style={{ display: "flex", alignItems: "center", gap: 4, flex: 1, minWidth: 0 }}>
          <input
            type="number"
            value={priceStr}
            min="0"
            step="0.01"
            onChange={e => { setPriceStr(e.target.value); onUpdatePrice(parseFloat(e.target.value) || 0) }}
            onBlur={e => commitPrice(e.target.value)}
            style={{
              width:       "100%",
              height:      30,
              background:  "var(--surface-2)",
              border:      `1px solid ${isBelowMin ? "var(--danger)" : "var(--border)"}`,
              borderRadius: 6,
              paddingInline: 8,
              fontSize:    12,
              color:       "var(--text)",
              outline:     "none",
            }}
          />
          <span style={{ fontSize: 12, color: "var(--text-muted)", flexShrink: 0 }}>درهم</span>
        </div>

        {/* Line total */}
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", flexShrink: 0, minWidth: 72, textAlign: "end" }}>
          {formatMAD(lineTotal)}
        </span>
      </div>
    </div>
  )
}