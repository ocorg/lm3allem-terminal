"use client"

import { Modal }             from "./Modal"
import { Button }            from "./Button"
import { useTranslations }   from "next-intl"

export interface ConfirmOptions {
  title:         string
  message:       string
  confirmLabel?: string
  variant?:      "danger" | "primary"
}

interface ConfirmModalProps extends ConfirmOptions {
  isOpen:    boolean
  onConfirm: () => void
  onCancel:  () => void
}

export function ConfirmModal({
  isOpen,
  title,
  message,
  confirmLabel,
  variant = "danger",
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const tUi = useTranslations("ui")

  return (
    <Modal isOpen={isOpen} onClose={onCancel} title={title} size="sm">
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {message && (
          <p style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6, margin: 0 }}>
            {message}
          </p>
        )}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <Button variant="ghost" onClick={onCancel}>
            {tUi("cancel")}
          </Button>
          <Button variant={variant} onClick={onConfirm}>
            {confirmLabel ?? tUi("confirm")}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
