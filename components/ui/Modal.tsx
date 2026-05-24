"use client"

import { useEffect, useRef, type ReactNode } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { X } from "lucide-react"

interface ModalProps {
  isOpen:               boolean
  onClose:              () => void
  title?:               string
  children:             ReactNode
  size?:                "sm" | "md" | "lg" | "xl"
  closeOnOverlayClick?: boolean
  hideClose?:           boolean
}

const panelWidths: Record<string, number> = {
  sm: 400, md: 520, lg: 640, xl: 768,
}

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  size                = "md",
  closeOnOverlayClick = true,
  hideClose           = false,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null)

  // Escape key
  useEffect(() => {
    if (!isOpen || hideClose) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [isOpen, hideClose, onClose])

  // Focus trap
  useEffect(() => {
    if (!isOpen || !panelRef.current) return
    const panel = panelRef.current

    const getFocusable = (): HTMLElement[] =>
      Array.from(
        panel.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      )

    const timer = setTimeout(() => getFocusable()[0]?.focus(), 60)

    const trap = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return
      const focusable = getFocusable()
      if (!focusable.length) { e.preventDefault(); return }
      const first = focusable[0]
      const last  = focusable[focusable.length - 1]
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus() }
      } else {
        if (document.activeElement === last)  { e.preventDefault(); first.focus() }
      }
    }

    document.addEventListener("keydown", trap)
    return () => {
      clearTimeout(timer)
      document.removeEventListener("keydown", trap)
    }
  }, [isOpen])

  // Scroll lock
  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : ""
    return () => { document.body.style.overflow = "" }
  }, [isOpen])

  const showHeader = !!(title || !hideClose)

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          style={{
            position:        "fixed",
            inset:           0,
            backgroundColor: "rgba(0,0,0,0.65)",
            display:         "flex",
            alignItems:      "center",
            justifyContent:  "center",
            zIndex:          1000,
            padding:         16,
          }}
          onClick={closeOnOverlayClick && !hideClose ? onClose : undefined}
        >
          <motion.div
            ref={panelRef}
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0,  scale: 1 }}
            exit={{ opacity: 0,    y: 16, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? "modal-title" : undefined}
            style={{
              width:      "100%",
              maxWidth:   panelWidths[size],
              maxHeight:  "90vh",
              display:    "flex",
              flexDirection: "column",
              background: "var(--surface)",
              border:     "1px solid var(--border)",
              borderRadius: 12,
              overflow:   "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {showHeader && (
              <div
                style={{
                  display:        "flex",
                  alignItems:     "center",
                  justifyContent: "space-between",
                  padding:        "16px 20px",
                  borderBottom:   "1px solid var(--border)",
                  flexShrink:     0,
                }}
              >
                {title ? (
                  <span
                    id="modal-title"
                    style={{ fontSize: 15, fontWeight: 600, color: "var(--text)" }}
                  >
                    {title}
                  </span>
                ) : <span />}

                {!hideClose && (
                  <button
                    onClick={onClose}
                    aria-label="Close"
                    style={{
                      background: "none",
                      border:     "none",
                      cursor:     "pointer",
                      color:      "var(--text-muted)",
                      padding:    4,
                      borderRadius: 6,
                      display:    "flex",
                      alignItems: "center",
                      lineHeight: 0,
                    }}
                  >
                    <X size={18} />
                  </button>
                )}
              </div>
            )}

            <div style={{ padding: 20, overflowY: "auto" }}>
              {children}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}