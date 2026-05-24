"use client"

import { useEffect, useState } from "react"

export type ToastVariant = "success" | "error" | "warning" | "info"

export interface Toast {
  id:        string
  message:   string
  variant:   ToastVariant
  duration?: number
}

// ── Module-level store ─────────────────────────────
let _toasts: Toast[] = []
const _listeners = new Set<(t: Toast[]) => void>()

function _emit() {
  _listeners.forEach((fn) => fn([..._toasts]))
}

export function toast(
  message:  string,
  variant:  ToastVariant = "info",
  duration: number       = 4000
): string {
  const id = Math.random().toString(36).slice(2, 9)
  _toasts = [..._toasts, { id, message, variant, duration }]
  _emit()
  setTimeout(() => dismiss(id), duration)
  return id
}

export function dismiss(id: string) {
  _toasts = _toasts.filter((t) => t.id !== id)
  _emit()
}

// ── React hook ─────────────────────────────────────
export function useToast(): Toast[] {
  const [list, setList] = useState<Toast[]>([..._toasts])

  useEffect(() => {
    _listeners.add(setList)
    return () => { _listeners.delete(setList) }
  }, [])

  return list
}