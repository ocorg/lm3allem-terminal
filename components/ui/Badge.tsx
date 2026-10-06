import type { ReactNode } from "react"

type BadgeVariant = "default" | "primary" | "success" | "danger" | "warning" | "info"

interface BadgeProps {
  variant?:  BadgeVariant
  children:  ReactNode
  dot?:      boolean
}

const variantTokens: Record<BadgeVariant, { color: string; bg: string }> = {
  default: { color: "var(--text-muted)", bg: "color-mix(in srgb, var(--text-muted) 10%, var(--surface))" },
  primary: { color: "var(--primary)",    bg: "color-mix(in srgb, var(--primary)    10%, var(--surface))" },
  success: { color: "var(--success)",    bg: "color-mix(in srgb, var(--success)    10%, var(--surface))" },
  danger:  { color: "var(--danger)",     bg: "color-mix(in srgb, var(--danger)     10%, var(--surface))" },
  warning: { color: "var(--warning)",    bg: "color-mix(in srgb, var(--warning)    10%, var(--surface))" },
  info:    { color: "var(--info)",       bg: "color-mix(in srgb, var(--info)       10%, var(--surface))" },
}

export function Badge({ variant = "default", children, dot = false }: BadgeProps) {
  const { color, bg } = variantTokens[variant]

  return (
    <span
      style={{
        display:        "inline-flex",
        alignItems:     "center",
        gap:            dot ? 5 : 0,
        paddingBlock:   3,
        paddingInline:  8,
        borderRadius:   999,
        fontSize:       12,
        fontWeight:     600,
        background:     bg,
        color,
        whiteSpace:     "nowrap",
      }}
    >
      {dot && (
        <span
          style={{
            width:        6,
            height:       6,
            borderRadius: "50%",
            background:   color,
            flexShrink:   0,
          }}
        />
      )}
      {children}
    </span>
  )
}