"use client"

import { useState, useCallback, useRef } from "react"
import { ConfirmModal, type ConfirmOptions } from "@/components/ui/ConfirmModal"

export function useConfirm() {
  const [state, setState] = useState<(ConfirmOptions & { isOpen: boolean }) | null>(null)
  const resolveRef        = useRef<((val: boolean) => void) | null>(null)

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    setState({ ...options, isOpen: true })
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve
    })
  }, [])

  const settle = useCallback((result: boolean) => {
    const resolve = resolveRef.current
    resolveRef.current = null
    // Close animation first, then resolve
    setState((s) => (s ? { ...s, isOpen: false } : null))
    setTimeout(() => {
      setState(null)
      resolve?.(result)
    }, 220)
  }, [])

  const modal = state ? (
    <ConfirmModal
      isOpen={state.isOpen}
      title={state.title}
      message={state.message}
      confirmLabel={state.confirmLabel}
      variant={state.variant}
      onConfirm={() => settle(true)}
      onCancel={() => settle(false)}
    />
  ) : null

  return { confirm, modal }
}