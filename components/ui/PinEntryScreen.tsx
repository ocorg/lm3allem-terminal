"use client"

import { useEffect, useState, useTransition } from "react"
import { useTranslations } from "next-intl"
import PinPad from "@/components/ui/PinPad"
import ThemeToggle from "@/components/ui/ThemeToggle"
import LanguageToggle from "@/components/ui/LanguageToggle"
import { authenticateWithPin } from "@/lib/auth/actions"

interface LockState {
  isLocked: boolean
  lockedUntil: number | null
  attemptsLeft: number
}

interface Props {
  locale: string
  initialLockState: LockState
}

export default function PinEntryScreen({ locale, initialLockState }: Props) {
  const t = useTranslations("auth")
  const [isPending, startTransition] = useTransition()

  // Pin digits — lifted here so PinPad is fully controlled
  const [pin, setPin] = useState("")

  // Lockout — initialised from server (survives language switch)
  const [lockedUntil, setLockedUntil] = useState<number | null>(
    initialLockState.lockedUntil
  )
  const [attemptsLeft, setAttemptsLeft] = useState(initialLockState.attemptsLeft)
  const [errorMsg, setErrorMsg]         = useState<string | null>(null)
  const [countdown, setCountdown]       = useState(0)

  // Countdown timer — derived from lockedUntil timestamp
  useEffect(() => {
    if (!lockedUntil) return
    const iv = setInterval(() => {
      const rem = Math.ceil((lockedUntil - Date.now()) / 1000)
      if (rem <= 0) {
        setLockedUntil(null)
        setCountdown(0)
      } else {
        setCountdown(rem)
      }
    }, 500)
    return () => clearInterval(iv)
  }, [lockedUntil])

  // Initialise countdown on mount if already locked
  useEffect(() => {
    if (initialLockState.lockedUntil) {
      const rem = Math.ceil((initialLockState.lockedUntil - Date.now()) / 1000)
      setCountdown(Math.max(0, rem))
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const isLocked = lockedUntil !== null && Date.now() < lockedUntil

  function handleSubmit(submittedPin: string) {
    if (isLocked || isPending) return
    setErrorMsg(null)

    startTransition(async () => {
      const result = await authenticateWithPin(submittedPin, locale)

      if (!result.ok) {
        if (result.error === "locked") {
          setLockedUntil(result.lockedUntil)
          setCountdown(Math.ceil((result.lockedUntil - Date.now()) / 1000))
          setAttemptsLeft(0)
          setErrorMsg(null)
        } else {
          setAttemptsLeft(result.attemptsLeft)
          setErrorMsg(t("invalidPin"))
        }
      }
      // On success: server throws redirect — nothing to handle
    })
  }

  return (
    <div
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
      {/* Toggles */}
      <div
        style={{
          position: "absolute",
          top: 20,
          insetInlineEnd: 20,
          display: "flex",
          gap: 8,
        }}
      >
        <ThemeToggle />
        <LanguageToggle currentLocale={locale} />
      </div>

      {/* Logo */}
      <div style={{ textAlign: "center", marginBottom: 44 }}>
        <p
          style={{
            fontSize: 30,
            fontWeight: 700,
            color: "var(--primary)",
            letterSpacing: "-0.025em",
            lineHeight: 1,
          }}
        >
          Lm3allem
        </p>
        <p
          style={{
            fontSize: 11,
            color: "var(--text-muted)",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            marginTop: 6,
          }}
        >
          Terminal
        </p>
      </div>

      {/* Numpad */}
      <PinPad
        pin={pin}
        setPin={setPin}
        onSubmit={handleSubmit}
        disabled={isLocked}
        loading={isPending}
      />

      {/* Status area — fixed height prevents layout shift */}
      <div
        style={{
          marginTop: 28,
          minHeight: 44,
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 6,
        }}
      >
        {isLocked && (
          <p style={{ color: "var(--danger)", fontSize: 13, fontWeight: 500 }}>
            {t("lockedOut", { seconds: countdown })}
          </p>
        )}

        {!isLocked && errorMsg && (
          <>
            <p style={{ color: "var(--danger)", fontSize: 13, fontWeight: 500 }}>
              {errorMsg}
            </p>
            {attemptsLeft > 0 && (
              <p style={{ color: "var(--text-muted)", fontSize: 12 }}>
                {t("attemptsRemaining", { count: attemptsLeft })}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}