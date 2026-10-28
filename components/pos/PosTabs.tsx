"use client"

import React from "react"

interface PosTabsProps {
  active:        "products" | "cart"
  onChange:      (tab: "products" | "cart") => void
  productsLabel: string
  cartLabel:     string
  /** pieces in the cart, shown as a badge so it is visible from the products screen */
  cartCount:     number
}

/** Phone POS: products / cart tabs, with the number of pieces in the cart always visible. */
export function PosTabs({ active, onChange, productsLabel, cartLabel, cartCount }: PosTabsProps) {
  return (
    <div role="tablist" style={{ display: "flex", flexShrink: 0, background: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
      {(["products", "cart"] as const).map((tab) => {
        const on = active === tab
        return (
          <button
            key={tab}
            role="tab"
            aria-selected={on}
            onClick={() => onChange(tab)}
            aria-label={tab === "cart" && cartCount > 0 ? `${cartLabel}: ${cartCount}` : undefined}
            style={{
              flex: 1, padding: "12px 8px", minHeight: 48,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              border: "none",
              borderBottom: `2px solid ${on ? "var(--primary)" : "transparent"}`,
              background: "none", cursor: "pointer",
              fontSize: 14, fontWeight: on ? 700 : 500,
              color: on ? "var(--primary)" : "var(--text-muted)",
              transition: "all 0.15s",
            }}
          >
            {tab === "products" ? productsLabel : cartLabel}
            {tab === "cart" && cartCount > 0 && (
              <span
                aria-hidden
                style={{
                  minWidth: 24, height: 24, paddingInline: 7, borderRadius: 999,
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  background: "var(--brand)", color: "var(--on-brand)", fontSize: 13, fontWeight: 700,
                }}
              >
                {cartCount}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
