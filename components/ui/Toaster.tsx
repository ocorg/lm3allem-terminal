"use client"

import { AnimatePresence, motion } from "framer-motion"
import { useParams } from "next/navigation"
import { CheckCircle, XCircle, AlertCircle, Info, X } from "lucide-react"
import { useToast, dismiss, type Toast, type ToastVariant } from "@/hooks/useToast"
import React from "react"

const config: Record<ToastVariant, { color: string; Icon: React.ElementType }> = {
  success: { color: "var(--success)", Icon: CheckCircle  },
  error:   { color: "var(--danger)",  Icon: XCircle      },
  warning: { color: "var(--warning)", Icon: AlertCircle  },
  info:    { color: "var(--info)",    Icon: Info         },
}

function ToastItem({ t }: { t: Toast }) {
  const { color, Icon } = config[t.variant]

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -12, scale: 0.96 }}
      animate={{ opacity: 1,  y: 0,  scale: 1 }}
      exit={{    opacity: 0,  y: -8, scale: 0.96 }}
      transition={{ duration: 0.18 }}
      onClick={() => dismiss(t.id)}
      style={{
        display:       "flex",
        alignItems:    "flex-start",
        gap:           10,
        padding:       "12px 14px",
        borderRadius:  10,
        background:    "var(--surface)",
        border:        `1px solid var(--border)`,
        boxShadow:     "0 4px 16px rgba(0,0,0,0.25)",
        cursor:        "pointer",
        maxWidth:      360,
        borderInlineStartWidth: 3,
        borderInlineStartColor: color,
      }}
    >
      <Icon size={16} style={{ color, flexShrink: 0, marginTop: 1 }} />
      <span style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.5, flex: 1 }}>
        {t.message}
      </span>
      <X size={14} style={{ color: "var(--text-muted)", flexShrink: 0, marginTop: 1 }} />
    </motion.div>
  )
}

export function Toaster() {
  const toasts  = useToast()
  const params  = useParams()
  const isRTL   = params?.locale === "ar"

  return (
    <div
      style={{
        position:  "fixed",
        top:       16,
        ...(isRTL ? { left: 16 } : { right: 16 }),
        zIndex:    9999,
        display:   "flex",
        flexDirection: "column",
        gap:       8,
        pointerEvents: "none",
      }}
    >
      <AnimatePresence mode="popLayout">
        {toasts.map((t) => (
          <div key={t.id} style={{ pointerEvents: "auto" }}>
            <ToastItem t={t} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  )
}