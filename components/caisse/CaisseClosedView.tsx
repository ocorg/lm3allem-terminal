"use client"

import { useState } from "react"
import { Lock } from "lucide-react"
import { useTranslations } from "next-intl"
import { OpenCaisseModal } from "./OpenCaisseModal"
import { Button } from "@/components/ui/Button"
import type { Portal } from "@prisma/client"
import React from "react"

interface CaisseClosedViewProps {
  portal: Portal
  locale: string
  role:   string
}

export function CaisseClosedView({ portal, locale, role }: CaisseClosedViewProps) {
  const t       = useTranslations("caisse")
  const canOpen = role === "admin" || role === "superadmin"
  const [open, setOpen] = useState(false)

  return (
    <>
      <div
        style={{
          display:        "flex",
          alignItems:     "center",
          justifyContent: "center",
          minHeight:      "60vh",
          padding:        24,
        }}
      >
        <div
          style={{
            background:     "var(--surface)",
            border:         "1px solid var(--border)",
            borderRadius:   16,
            padding:        "40px 48px",
            display:        "flex",
            flexDirection:  "column",
            alignItems:     "center",
            gap:            16,
            maxWidth:       380,
            width:          "100%",
            textAlign:      "center",
          }}
        >
          {/* Icon */}
          <div
            style={{
              width:        56,
              height:       56,
              borderRadius: "50%",
              background:   "var(--surface-2)",
              border:       "1px solid var(--border)",
              display:      "flex",
              alignItems:   "center",
              justifyContent: "center",
            }}
          >
            <Lock size={22} style={{ color: "var(--text-muted)" }} />
          </div>

          {/* Text */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <p style={{ fontSize: 16, fontWeight: 600, color: "var(--text)", margin: 0 }}>
              {t("closed")}
            </p>
            <p style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6, margin: 0 }}>
              {canOpen ? t("openSession") + " ?" : t("closedStaff")}
            </p>
          </div>

          {/* CTA - admin only */}
          {canOpen && (
            <Button
              size="lg"
              style={{ marginTop: 4 }}
              onClick={() => setOpen(true)}
            >
              {t("openSession")}
            </Button>
          )}
        </div>
      </div>

      {canOpen && (
        <OpenCaisseModal
          portal={portal}
          isOpen={open}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}