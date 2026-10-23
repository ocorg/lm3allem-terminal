"use client"

import { useState, useSyncExternalStore, useTransition, type FormEvent, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { useTranslations } from "next-intl"
import { Modal } from "@/components/ui/Modal"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { PasswordInput } from "@/components/ui/PasswordInput"
import { requestManagerOverride, type OverridePurpose } from "@/lib/actions/auth"
import React from "react"

interface AdminApprovalModalProps {
  isOpen:        boolean
  title:         string
  subtitle:      string
  /** what the admin is approving (shown above the login fields) */
  children?:     ReactNode
  /** without it: a sale below the minimum price */
  purpose?:      OverridePurpose
  authorizeLabel: string
  cancelLabel:   string
  /** Receives the short-lived signed token; the SERVER verifies it when the action is saved. */
  onAuthorized:  (token: string) => void
  onCancel:      () => void
}

const subscribe = () => () => {}

/**
 * An admin types their own email + password at the counter to approve something.
 * Rendered at the page level (portal) so it also works when opened from inside another window:
 * it is never clipped by that window, and a click in it never reaches the window behind.
 */
export function AdminApprovalModal({
  isOpen, title, subtitle, children, purpose, authorizeLabel, cancelLabel, onAuthorized, onCancel,
}: AdminApprovalModalProps) {
  const t = useTranslations("belowMin")
  const tAuth = useTranslations("auth")
  const [isPending, startTransition] = useTransition()

  const [email, setEmail]       = useState("")
  const [password, setPassword] = useState("")
  const [error, setError]       = useState("")

  const inBrowser = useSyncExternalStore(subscribe, () => true, () => false)
  const reset = () => { setEmail(""); setPassword(""); setError("") }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!email.trim() || !password) return
    setError("")

    startTransition(async () => {
      const res = await requestManagerOverride(email, password, purpose)
      if (!res.ok) {
        setError(res.message)
        setPassword("")
        return
      }
      reset()
      onAuthorized(res.data.token)
    })
  }

  if (!inBrowser) return null
  return createPortal(
    <div onClick={(e) => e.stopPropagation()}>
    <Modal isOpen={isOpen} onClose={() => { reset(); onCancel() }} title={title} hideClose size="sm">
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <p style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center", margin: 0, lineHeight: 1.5 }}>
          {subtitle}
        </p>

        {children}

        <p style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center", margin: 0 }}>
          {t("enterAdminCredentials")}
        </p>

        <Input
          label={tAuth("email")}
          type="email"
          dir="ltr"
          autoComplete="off"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setError("") }}
          disabled={isPending}
          autoFocus
        />
        <PasswordInput
          label={tAuth("password")}
          value={password}
          onChange={(e) => { setPassword(e.target.value); setError("") }}
          disabled={isPending}
        />

        {error && (
          <p role="alert" style={{ fontSize: 12, color: "var(--danger)", textAlign: "center", margin: 0 }}>
            {error}
          </p>
        )}

        <Button type="submit" fullWidth loading={isPending} disabled={!email.trim() || !password}>
          {authorizeLabel}
        </Button>
        <Button type="button" variant="ghost" fullWidth onClick={() => { reset(); onCancel() }} disabled={isPending}>
          {cancelLabel}
        </Button>
      </form>
    </Modal>
    </div>,
    document.body
  )
}
