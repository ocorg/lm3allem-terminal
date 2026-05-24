interface SpinnerProps {
  size?: "sm" | "md" | "lg"
  color?: "primary" | "white" | "muted"
}

const sizes: Record<string, number> = { sm: 16, md: 24, lg: 32 }

const colorVars: Record<string, string> = {
  primary: "var(--primary)",
  white:   "#ffffff",
  muted:   "var(--text-muted)",
}

export function Spinner({ size = "md", color = "primary" }: SpinnerProps) {
  return (
    <div
      className="animate-spin"
      aria-label="loading"
      style={{
        width:           sizes[size],
        height:          sizes[size],
        borderRadius:    "50%",
        border:          "2px solid transparent",
        borderTopColor:  colorVars[color],
        flexShrink:      0,
      }}
    />
  )
}