import type { ButtonHTMLAttributes, ReactNode } from "react"
import { Spinner } from "./Spinner"

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:  "primary" | "secondary" | "ghost" | "danger"
  size?:     "sm" | "md" | "lg"
  loading?:  boolean
  fullWidth?: boolean
  icon?:     ReactNode
  children:  ReactNode
}

const variantStyles: Record<string, React.CSSProperties> = {
  primary:   { background: "var(--primary)",   color: "#1a1a1a", border: "none" },
  secondary: { background: "var(--surface-2)", color: "var(--text)",       border: "1px solid var(--border)" },
  ghost:     { background: "transparent",      color: "var(--text-muted)", border: "none" },
  danger:    { background: "var(--danger)",    color: "#ffffff",            border: "none" },
}

const sizeStyles: Record<string, React.CSSProperties> = {
  sm: { height: 32, fontSize: 12, paddingInline: 12, gap: 6 },
  md: { height: 40, fontSize: 13, paddingInline: 16, gap: 8 },
  lg: { height: 44, fontSize: 14, paddingInline: 20, gap: 8 },
}

export function Button({
  variant  = "primary",
  size     = "md",
  loading  = false,
  fullWidth = false,
  icon,
  children,
  disabled,
  style,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading

  const spinnerColor =
    variant === "danger"    ? "white"   :
    variant === "primary"   ? "muted"   : "muted"

  return (
    <button
      disabled={isDisabled}
      style={{
        display:        "inline-flex",
        alignItems:     "center",
        justifyContent: "center",
        borderRadius:   8,
        fontWeight:     500,
        cursor:         isDisabled ? "not-allowed" : "pointer",
        opacity:        isDisabled ? 0.5 : 1,
        transition:     "opacity 150ms, box-shadow 150ms",
        width:          fullWidth ? "100%" : undefined,
        flexShrink:     0,
        ...variantStyles[variant],
        ...sizeStyles[size],
        ...style,
      }}
      {...props}
    >
      {loading
        ? <Spinner size="sm" color={spinnerColor} />
        : icon ?? null}
      {children}
    </button>
  )
}