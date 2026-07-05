"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { Minus, Plus, Trash2 } from "lucide-react"
import { formatMAD } from "@/lib/utils/currency"
import type { CartItem } from "./POSClient"
import React from "react"

interface CartItemProps {
  item:          CartItem
  onUpdateQty:   (qty: number) => void
  onUpdatePrice: (price: number) => void
  onRemove:      () => void
}

export function CartItem({ item, onUpdateQty, onUpdatePrice, onRemove }: CartItemProps) {
  const t = useTranslations("magazin.pos")
  const [priceStr, setPriceStr] = useState(item.unitPrice.toFixed(2))
  const [prevUnitPrice, setPrevUnitPrice] = useState(item.unitPrice)
  const isBelowMin = item.unitPrice < item.minSellingPrice
  const lineTotal  = item.unitPrice * item.quantity

  // Sync if parent resets price (compared during render, not in an effect)
  if (item.unitPrice !== prevUnitPrice) {
    setPrevUnitPrice(item.unitPrice)
    setPriceStr(item.unitPrice.toFixed(2))
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
          <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "1px 0 0" }}>
            {item.variantLabel}
          </p>
          {isBelowMin && (
            <p style={{ fontSize: 10, color: "var(--danger)", margin: "2px 0 0", fontWeight: 600 }}>
              ▼ {t("belowMin", { price: formatMAD(item.minSellingPrice) })}
            </p>
          )}
        </div>
        <button
          onClick={onRemove}
          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 2, flexShrink: 0 }}
        >
          <Trash2 size={13} />
        </button>
      </div>

      {/* Controls row */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>

        {/* Qty */}
        <div style={{ display: "flex", alignItems: "center", border: "1px solid var(--border)", borderRadius: 6, overflow: "hidden", flexShrink: 0 }}>
          <button
            onClick={() => onUpdateQty(item.quantity - 1)}
            style={{ background: "var(--surface-2)", border: "none", cursor: "pointer", width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <Minus size={11} style={{ color: "var(--text-muted)" }} />
          </button>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", minWidth: 24, textAlign: "center" }}>
            {item.quantity}
          </span>
          <button
            onClick={() => item.quantity < item.stock && onUpdateQty(item.quantity + 1)}
            disabled={item.quantity >= item.stock}
            style={{ background: "var(--surface-2)", border: "none", cursor: item.quantity >= item.stock ? "not-allowed" : "pointer", width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", opacity: item.quantity >= item.stock ? 0.4 : 1 }}
          >
            <Plus size={11} style={{ color: "var(--text-muted)" }} />
          </button>
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
          <span style={{ fontSize: 10, color: "var(--text-muted)", flexShrink: 0 }}>MAD</span>
        </div>

        {/* Line total */}
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", flexShrink: 0, minWidth: 72, textAlign: "end" }}>
          {formatMAD(lineTotal)}
        </span>
      </div>
    </div>
  )
}