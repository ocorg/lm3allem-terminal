"use client"

import { useEffect } from "react"
import { AlertTriangle, RefreshCw } from "lucide-react"
import React from "react"

export default function MagazinError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => { console.error("[magazin] page error:", error) }, [error])

  const isDbError =
    error.message?.includes("database") ||
    error.message?.includes("prisma")   ||
    error.message?.includes("connect")  ||
    error.message?.toLowerCase().includes("reach")

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", gap: 16, padding: 24, textAlign: "center" }}>
      <AlertTriangle size={36} style={{ color: "var(--warning)" }} />
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <p style={{ fontSize: 16, fontWeight: 600, color: "var(--text)", margin: 0 }}>
          {isDbError ? "قاعدة البيانات غير متاحة" : "حدث خطأ"}
        </p>
        <p style={{ fontSize: 13, color: "var(--text-muted)", maxWidth: 340, lineHeight: 1.6, margin: 0 }}>
          {isDbError
            ? "فشل الاتصال بقاعدة البيانات. أعد المحاولة بعد لحظات."
            : "حدث خطأ غير متوقع. أعد المحاولة أو تواصل مع الدعم."}
        </p>
      </div>
      <button onClick={reset} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 20px", background: "var(--brand)", color: "var(--on-brand)", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", marginTop: 4 }}>
        <RefreshCw size={13} /> إعادة المحاولة
      </button>
    </div>
  )
}