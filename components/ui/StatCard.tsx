import type { LucideIcon } from "lucide-react"
import { TrendingUp, TrendingDown, Minus } from "lucide-react"
import { Skeleton } from "./Skeleton"

interface StatCardProps {
  label:       string
  value:       string | number
  icon?:       LucideIcon
  trend?:      "up" | "down" | "neutral"
  trendValue?: string
  currency?:   boolean
  loading?:    boolean
}

const trendConfig = {
  up:      { Icon: TrendingUp,   color: "var(--success)" },
  down:    { Icon: TrendingDown, color: "var(--danger)"  },
  neutral: { Icon: Minus,        color: "var(--text-muted)" },
}

export function StatCard({
  label,
  value,
  icon: Icon,
  trend,
  trendValue,
  currency = false,
  loading  = false,
}: StatCardProps) {
  return (
    <div
      style={{
        background:     "var(--surface)",
        border:         "1px solid var(--border)",
        borderRadius:   12,
        padding:        20,
        display:        "flex",
        flexDirection:  "column",
        gap:            12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          {label}
        </span>
        {Icon && <Icon size={16} style={{ color: "var(--text-muted)" }} />}
      </div>

      {loading ? (
        <Skeleton variant="text" height={28} />
      ) : (
        <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
          <span style={{ fontSize: 26, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.03em", lineHeight: 1 }}>
            {value}
          </span>
          {currency && (
            <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 500 }}>MAD</span>
          )}
        </div>
      )}

      {trend && trendValue && !loading && (() => {
        const { Icon: TrendIcon, color } = trendConfig[trend]
        return (
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <TrendIcon size={13} style={{ color }} />
            <span style={{ fontSize: 12, color, fontWeight: 500 }}>{trendValue}</span>
          </div>
        )
      })()}
    </div>
  )
}