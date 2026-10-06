"use client"

import { useState, useTransition, type FormEvent } from "react"
import { useTranslations } from "next-intl"
import { Modal } from "@/components/ui/Modal"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { PasswordInput } from "@/components/ui/PasswordInput"
import { requestManagerOverride } from "@/lib/actions/auth"
import React from "react"
import { formatMAD } from "@/lib/utils/currency"

export interface BelowMinItem {
  name:           string
  requestedPrice: number
  minPrice:       number
}

interface BelowMinModalProps {
  isOpen:       boolean
  items:        BelowMinItem[]
  /** Receives the short-lived signed override token; the SERVER verifies it when the sale is saved. */
  onAuthorized: (overrideToken: string) => void
  onCancel:     () => void
}

export function BelowMinModal({
  isOpen,
  items,
  onAuthorized,
  onCancel,
}: BelowMinModalProps) {
  const t = useTranslations("belowMin")
  const tAuth = useTranslations("auth")
  const [isPending, startTransition] = useTransition()

  const [email, setEmail]       = useState("")
  const [password, setPassword] = useState("")
  const [error, setError]       = useState("")

  const reset = () => { setEmail(""); setPassword(""); setError("") }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!email.trim() || !password) return
    setError("")

    startTransition(async () => {
      const res = await requestManagerOverride(email, password)
      if (!res.ok) {
        setError(res.message)
        setPassword("")
        return
      }
      reset()
      onAuthorized(res.data.token)
    })
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => { reset(); onCancel() }}
      title={t("title")}
      hideClose
      size="sm"
    >
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <p style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center", margin: 0, lineHeight: 1.5 }}>
          {t("subtitle")}
        </p>

        {/* Items summary table */}
        <div style={{ border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "var(--surface-2)" }}>
                {[t("item"), t("requestedPrice"), t("minPrice")].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding:       "8px 12px",
                      fontSize:      12,
                      fontWeight:    600,
                      color:         "var(--text-muted)",
                      textAlign:     "start",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={i} style={{ borderTop: "1px solid var(--border)" }}>
                  <td style={{ padding: "8px 12px", fontSize: 12, color: "var(--text)" }}>
                    {item.name}
                  </td>
                  <td style={{ padding: "8px 12px", fontSize: 12, fontWeight: 600, color: "var(--danger)" }}>
                    {formatMAD(item.requestedPrice)}
                  </td>
                  <td style={{ padding: "8px 12px", fontSize: 12, color: "var(--text-muted)" }}>
                    {formatMAD(item.minPrice)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

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
          <p style={{ fontSize: 12, color: "var(--danger)", textAlign: "center", margin: 0 }}>
            {error}
          </p>
        )}

        <Button type="submit" fullWidth loading={isPending} disabled={!email.trim() || !password}>
          {t("authorize")}
        </Button>
        <Button
          type="button"
          variant="ghost"
          fullWidth
          onClick={() => { reset(); onCancel() }}
          disabled={isPending}
        >
          {t("cancel")}
        </Button>
      </form>
    </Modal>
  )
}
