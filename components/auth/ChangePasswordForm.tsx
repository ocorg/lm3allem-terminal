"use client"

import { useState, useTransition, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { PasswordInput } from "@/components/ui/PasswordInput"
import { Button } from "@/components/ui/Button"
import { toast } from "@/hooks/useToast"
import { changePassword, signOutUser } from "@/lib/auth/actions"
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/password-rules"
import React from "react"

interface Props {
  locale: string
  /** true when the password was set by an admin and MUST be replaced before using the app */
  forced: boolean
}

export default function ChangePasswordForm({ locale, forced }: Props) {
  const t = useTranslations("auth")
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [current, setCurrent] = useState("")
  const [next, setNext]       = useState("")
  const [confirm, setConfirm] = useState("")
  const [error, setError]     = useState<string | null>(null)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (next.length < MIN_PASSWORD_LENGTH) return setError(t("passwordTooShort", { count: MIN_PASSWORD_LENGTH }))
    if (next !== confirm) return setError(t("passwordMismatch"))

    startTransition(async () => {
      const res = await changePassword(current, next)
      if (!res.ok) { setError(res.message); return }
      toast(t("passwordChanged"), "success")
      // Full page load (not router.replace): the in-app router may serve a cached copy of the next
      // page from BEFORE the change, which redirects straight back here and looks like an endless load.
      window.location.assign(`/${locale}/select-portal`)
    })
  }

  return (
    <main style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "var(--bg)", padding: 24 }}>
      <form
        onSubmit={handleSubmit}
        style={{ width: "100%", maxWidth: 380, display: "flex", flexDirection: "column", gap: 14, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 24 }}
      >
        <h1 style={{ fontSize: 18, fontWeight: 700, color: "var(--text)", margin: 0 }}>{t("changePasswordTitle")}</h1>
        {forced && (
          <p style={{ fontSize: 13, color: "var(--warning)", margin: 0, lineHeight: 1.6 }}>{t("changePasswordForced")}</p>
        )}

        <PasswordInput label={t("currentPassword")} autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
        <PasswordInput label={t("newPassword")} autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} hint={t("passwordHint", { count: MIN_PASSWORD_LENGTH })} required />
        <PasswordInput label={t("confirmPassword")} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />

        {error && <p style={{ color: "var(--danger)", fontSize: 13, margin: 0 }}>{error}</p>}

        <Button type="submit" fullWidth size="lg" loading={isPending} disabled={!current || !next || !confirm}>
          {t("savePassword")}
        </Button>

        {forced ? (
          <Button type="button" variant="ghost" fullWidth onClick={() => startTransition(async () => { await signOutUser(locale) })}>
            {t("logout")}
          </Button>
        ) : (
          <Button type="button" variant="ghost" fullWidth onClick={() => router.back()}>
            {t("cancel")}
          </Button>
        )}
      </form>
    </main>
  )
}
