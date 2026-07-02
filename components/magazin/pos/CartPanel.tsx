"use client"

import { useMemo } from "react"
import { ShoppingCart } from "lucide-react"
import { Button }    from "@/components/ui/Button"
import { formatMAD } from "@/lib/utils/currency"
import { CartItem as CartItemRow } from "./CartItem"
import type { CartItem } from "./POSClient"
import React from "react"

interface CartPanelProps {
  items:        CartItem[]
  locale:       string
  loading:      boolean
  onUpdateItem: (variantId: string, updates: Partial<CartItem>) => void
  onRemoveItem: (variantId: string) => void
  onCheckout:   () => void
}

export function CartPanel({ items, loading, onUpdateItem, onRemoveItem, onCheckout }: CartPanelProps) {
  const subtotal    = useMemo(() => items.reduce((s, i) => s + i.unitPrice * i.quantity, 0), [items])
  const hasBelowMin = items.some(i => i.unitPrice < i.minSellingPrice)
  const totalQty    = items.reduce((s, i) => s + i.quantity, 0)

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>

      {/* Header */}
      <div style={{ padding: "16px 16px 12px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <ShoppingCart size={16} style={{ color: "var(--text-muted)" }} />
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>Panier</span>
          {totalQty > 0 && (
            <span style={{
              background: "var(--primary)", color: "#1a1a1a",
              borderRadius: 999, fontSize: 10, fontWeight: 700,
              padding: "1px 7px", marginInlineStart: "auto",
            }}>
              {totalQty}
            </span>
          )}
        </div>
      </div>

      {/* Items */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {items.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 56, gap: 8 }}>
            <ShoppingCart size={36} style={{ color: "var(--border)" }} />
            <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>Panier vide</p>
          </div>
        ) : (
          items.map(item => (
            <CartItemRow
              key={item.variantId}
              item={item}
              onUpdateQty={(qty) => {
                if (qty <= 0) onRemoveItem(item.variantId)
                else onUpdateItem(item.variantId, { quantity: qty })
              }}
              onUpdatePrice={(price) => onUpdateItem(item.variantId, { unitPrice: price })}
              onRemove={() => onRemoveItem(item.variantId)}
            />
          ))
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: 16, borderTop: "1px solid var(--border)", flexShrink: 0 }}>
        {hasBelowMin && (
          <div style={{
            background:   "color-mix(in srgb, var(--warning) 10%, transparent)",
            border:       "1px solid color-mix(in srgb, var(--warning) 30%, transparent)",
            borderRadius: 8,
            padding:      "8px 12px",
            marginBottom: 12,
          }}>
            <p style={{ fontSize: 11, color: "var(--warning)", margin: 0, fontWeight: 500 }}>
              ⚠ Certains articles sont en dessous du prix minimum. Une autorisation sera requise.
            </p>
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
          <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Sous-total</span>
          <span style={{ fontSize: 16, fontWeight: 700, color: "var(--text)" }}>{formatMAD(subtotal)}</span>
        </div>

        <Button fullWidth onClick={onCheckout} disabled={items.length === 0} loading={loading}>
          Encaisser
        </Button>
      </div>
    </div>
  )
}