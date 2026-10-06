import { Skeleton } from "./Skeleton"
import React from "react"

/** Instant placeholder shown while a page's data loads: the screen never looks frozen or blank. */
export default function PageSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }} aria-busy="true" aria-live="polite">
      <Skeleton variant="row" width={220} height={28} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12 }}>
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} variant="card" height={84} />)}
      </div>
      <Skeleton variant="row" height={40} />
      {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} variant="row" height={48} />)}
    </div>
  )
}
