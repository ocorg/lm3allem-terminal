import React from "react"

export default function Loading() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)", color: "var(--text-muted)", fontSize: 14 }}>
      جارٍ التحميل...
    </div>
  )
}
