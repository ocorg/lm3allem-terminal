"use client"

import { useEffect, useState, useTransition, type FormEvent } from "react"
import { useTranslations } from "next-intl"
import ThemeToggle from "@/components/ui/ThemeToggle"
import { Input } from "@/components/ui/Input"
import { PasswordInput } from "@/components/ui/PasswordInput"
import { Button } from "@/components/ui/Button"
import { authenticateWithPassword } from "@/lib/auth/actions"
import React from "react"
import { BrandLogo } from "@/components/ui/BrandLogo"

interface Props {
  locale: string
}

export default function LoginScreen({ locale }: Props) {
  const t = useTranslations("auth")
  const [isPending, startTransition] = useTransition()

  const [email, setEmail]       = useState("")
  const [password, setPassword] = useState("")
  const [error, setError]       = useState<string | null>(null)
  const [attemptsLeft, setAttemptsLeft] = useState<number | null>(null)
  const [lockedUntil, setLockedUntil]   = useState<number | null>(null)
  const [countdown, setCountdown]       = useState(0)

  // Lockout countdown, derived from the server-provided timestamp
  useEffect(() => {
    if (!lockedUntil) return
    const tick = () => {
      const rem = Math.ceil((lockedUntil - Date.now()) / 1000)
      if (rem <= 0) { setLockedUntil(null); setCountdown(0) }
      else setCountdown(rem)
    }
    tick()
    const iv = setInterval(tick, 500)
    return () => clearInterval(iv)
  }, [lockedUntil])

  const isLocked = lockedUntil !== null

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (isLocked || isPending || !email.trim() || !password) return
    setError(null)

    startTransition(async () => {
      const result = await authenticateWithPassword(email, password, locale)
      // On success the server action redirects, so nothing is returned.
      if (result.ok) return

      setPassword("")
      if (result.error === "locked") {
        setLockedUntil(result.lockedUntil)
        setAttemptsLeft(null)
      } else if (result.error === "invalid") {
        setAttemptsLeft(result.attemptsLeft)
        setError(t("invalidCredentials"))
      } else {
        setError(t("invalidInput"))
      }
    })
  }

  return (
    <main
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        background: "var(--bg)",
        padding: 24,
        position: "relative",
      }}
    >
      <div style={{ position: "absolute", top: 20, insetInlineEnd: 20 }}>
        <ThemeToggle />
      </div>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, marginBottom: 24 }}>
        <BrandLogo size={132} />
        <h1 style={{ fontSize: 15, fontWeight: 500, color: "var(--text-muted)", margin: 0 }}>{t("title")}</h1>
      </div>

      <form
        onSubmit={handleSubmit}
        style={{
          width: "100%",
          maxWidth: 360,
          display: "flex",
          flexDirection: "column",
          gap: 14,
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 14,
          padding: 24,
        }}
      >
        <Input
          label={t("email")}
          type="email"
          name="email"
          autoComplete="username"
          dir="ltr"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={isLocked}
          autoFocus
          required
        />

        <PasswordInput
          label={t("password")}
          name="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={isLocked}
          required
        />

        <div style={{ minHeight: 40, textAlign: "center", display: "flex", flexDirection: "column", gap: 4, justifyContent: "center" }}>
          {isLocked && (
            <p style={{ color: "var(--danger)", fontSize: 13, fontWeight: 500, margin: 0 }}>
              {t("lockedOut", { seconds: countdown })}
            </p>
          )}
          {!isLocked && isPending && (
            <p style={{ color: "var(--text-muted)", fontSize: 12, margin: 0 }}>{t("verifying")}</p>
          )}
          {!isLocked && !isPending && error && (
            <>
              <p style={{ color: "var(--danger)", fontSize: 13, fontWeight: 500, margin: 0 }}>{error}</p>
              {attemptsLeft !== null && attemptsLeft > 0 && (
                <p style={{ color: "var(--text-muted)", fontSize: 12, margin: 0 }}>
                  {t("attemptsRemaining", { count: attemptsLeft })}
                </p>
              )}
            </>
          )}
        </div>

        <Button type="submit" fullWidth size="lg" loading={isPending} disabled={isLocked || !email.trim() || !password}>
          {t("login")}
        </Button>
      </form>
    </main>
  )
}
