"use client"

import { useEffect, useState } from "react"
import { useMotionValue, useSpring, useReducedMotion, motion } from "framer-motion"
import { Skeleton }             from "./Skeleton"
import { formatMAD }            from "@/lib/utils/currency"
import React from "react"

interface StatCardProps {
  label:        string
  value:        string | number
  numericValue?: number        // raw number for animated counter
  icon?:        React.ComponentType<{ size?: number; style?: React.CSSProperties }>
  trend?:       "up" | "down" | "neutral"
  trendValue?:  string
  currency?:    boolean
  loading?:     boolean
  delay?:       number         // stagger delay in ms
  maxValue?:    number         // for bottom progress bar
}

export function StatCard({
  label,
  value,
  numericValue,
  icon: Icon,
  trend,
  trendValue,
  currency  = false,
  loading   = false,
  delay     = 0,
  maxValue,
}: StatCardProps) {
  const shouldReduce = useReducedMotion()
  const mv           = useMotionValue(0)
  const spring       = useSpring(mv, { duration: 800, bounce: 0 })
  const [displayed, setDisplayed] = useState<number>(
    shouldReduce && numericValue !== undefined ? numericValue : 0
  )

  useEffect(() => {
    if (numericValue === undefined || shouldReduce) return
    const timer = setTimeout(() => {
      mv.set(numericValue)
    }, delay)
    const unsub = spring.on("change", (v) => {
      setDisplayed(Math.round(v))
    })
    return () => {
      clearTimeout(timer)
      unsub()
    }
  }, [numericValue, delay, shouldReduce]) // eslint-disable-line react-hooks/exhaustive-deps

  const displayedValue = numericValue !== undefined
    ? (currency ? formatMAD(displayed) : displayed.toLocaleString("fr-MA"))
    : value

  const trendColor =
    trend === "up"      ? "var(--success)"   :
    trend === "down"    ? "var(--danger)"    :
    trend === "neutral" ? "var(--text-muted)" : "var(--text-muted)"

  const barPct = maxValue !== undefined && numericValue !== undefined
    ? Math.min(100, (numericValue / maxValue) * 100)
    : 100

  return (
    <motion.div
      initial={shouldReduce ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: "easeOut", delay: delay / 1000 }}
      style={{
        background:     "var(--surface)",
        border:         "1px solid var(--border)",
        borderInlineStart: "4px solid",
        borderInlineStartColor: `color-mix(in srgb, var(--primary) 40%, transparent)`,
        borderRadius:   12,
        padding:        "18px 20px 16px",
        display:        "flex",
        flexDirection:  "column",
        gap:            10,
        position:       "relative",
        overflow:       "hidden",
        transition:     "border-inline-start-color 150ms ease",
      }}
      onHoverStart={e => {
        const el = (e.target as HTMLElement).closest("[data-statcard]") as HTMLElement | null
        if (el) el.style.borderInlineStartColor = "var(--primary)"
      }}
      onHoverEnd={e => {
        const el = (e.target as HTMLElement).closest("[data-statcard]") as HTMLElement | null
        if (el) el.style.borderInlineStartColor = `color-mix(in srgb, var(--primary) 40%, transparent)`
      }}
      data-statcard="1"
    >
      {/* Label row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{
          fontSize:      10,
          fontWeight:    700,
          fontFamily:    "var(--font-display)",
          color:         "var(--text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.1em",
        }}>
          {label}
        </span>
        {Icon && <Icon size={15} style={{ color: "var(--text-muted)" }} />}
      </div>

      {/* Value */}
      {loading ? (
        <Skeleton variant="text" height={28} />
      ) : (
        <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
          <span
            className="mono"
            style={{
              fontSize:      26,
              fontWeight:    500,
              color:         "var(--text)",
              letterSpacing: "-0.03em",
              lineHeight:    1,
              animation:     !shouldReduce && numericValue !== undefined
                ? `countUp 400ms ease-out ${delay}ms both`
                : undefined,
            }}
          >
            {displayedValue}
          </span>
        </div>
      )}

      {/* Bottom progress bar - replaces trend icon row */}
      {trend && !loading && (
        <div style={{
          height:       3,
          background:   "var(--border)",
          borderRadius: 2,
          overflow:     "hidden",
        }}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${barPct}%` }}
            transition={{ duration: 0.8, ease: "easeOut", delay: (delay + 200) / 1000 }}
            style={{
              height:     "100%",
              background: trendColor,
              borderRadius: 2,
            }}
          />
        </div>
      )}
    </motion.div>
  )
}
