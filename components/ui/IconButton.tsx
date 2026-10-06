"use client"

import type { ButtonHTMLAttributes, ReactNode } from "react"

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label" | "title"> {
  /** what the button does: read by screen readers and shown as a tooltip */
  label:    string
  children: ReactNode
  tone?:    "neutral" | "danger" | "success"
  size?:    "md" | "sm"
}

const TONE: Record<string, string> = {
  neutral: "var(--text)",
  danger:  "var(--danger)",
  success: "var(--success)",
}

/**
 * A button that is only an icon (edit, delete, switch on/off, + / -).
 * Always a full-size target with a visible outline, so two neighbours cannot be hit by mistake:
 * 38px (md) in tables and lists, 32px (sm) inside compact rows such as the cart.
 */
export function IconButton({ label, children, tone = "neutral", size = "md", style, disabled, onClick, ...props }: IconButtonProps) {
  const side = size === "md" ? 38 : 32
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={(e) => { e.stopPropagation(); onClick?.(e) }}
      style={{
        width:          side,
        height:         side,
        flexShrink:     0,
        display:        "inline-flex",
        alignItems:     "center",
        justifyContent: "center",
        background:     "var(--surface)",
        border:         "1px solid var(--border)",
        borderRadius:   8,
        color:          TONE[tone],
        cursor:         disabled ? "not-allowed" : "pointer",
        opacity:        disabled ? 0.4 : 1,
        ...style,
      }}
      {...props}
    >
      {children}
    </button>
  )
}

/** Row of icon buttons with enough air between them. */
export function IconButtonGroup({ children }: { children: ReactNode }) {
  return <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "nowrap" }}>{children}</div>
}
