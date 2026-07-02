"use client"

import { useState, useEffect }  from "react"
import { useTranslations }      from "next-intl"
import { Modal }                from "@/components/ui/Modal"
import { Button }               from "@/components/ui/Button"
import PinPad                   from "@/components/ui/PinPad"
import { verifyAdminPin }       from "@/lib/actions/auth"
import React from "react"

export interface BelowMinItem {
  name:           string
  requestedPrice: number
  minPrice:       number
}

interface BelowMinModalProps {
  isOpen:       boolean
  items:        BelowMinItem[]
  onAuthorized: (adminId: string) => void
  onCancel:     () => void
}

export function BelowMinModal({
  isOpen,
  items,
  onAuthorized,
  onCancel,
}: BelowMinModalProps) {
  const t     = useTranslations("belowMin")
  const tAuth = useTranslations("auth")
  const tUi   = useTranslations("ui")

  const [pin,         setPin]         = useState("")
  const [error,       setError]       = useState("")
  const [loading,     setLoading]     = useState(false)
  const [lockedUntil, setLockedUntil] = useState<number | null>(null)
  const [secondsLeft, setSecondsLeft] = useState(0)

  useEffect(() => {
    if (!lockedUntil) return
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((lockedUntil - Date.now()) / 1000))
      setSecondsLeft(remaining)
      if (remaining === 0) setLockedUntil(null)
    }
    tick()
    const id = setInterval(tick, 500)
    return () => clearInterval(id)
  }, [lockedUntil])

  const isLocked = lockedUntil !== null

  const handleSubmit = async (submittedPin: string) => {
    if (isLocked) return
    setLoading(true)
    setError("")
    try {
      const result = await verifyAdminPin(submittedPin)
      if ("adminId" in result) {
        setPin("")
        onAuthorized(result.adminId)
      } else if (result.lockedUntil) {
        setLockedUntil(result.lockedUntil)
        setPin("")
      } else {
        setError(t("unauthorized"))
        setPin("")
      }
    } catch {
      setError(tUi("error"))
      setPin("")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      title={t("title")}
      hideClose
      size="sm"
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
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
                      fontSize:      10,
                      fontWeight:    600,
                      color:         "var(--text-muted)",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
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
                    {item.requestedPrice.toFixed(2)} MAD
                  </td>
                  <td style={{ padding: "8px 12px", fontSize: 12, color: "var(--text-muted)" }}>
                    {item.minPrice.toFixed(2)} MAD
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center", margin: 0 }}>
          {t("enterAdminPin")}
        </p>

        {/* Lockout banner */}
        {isLocked && (
          <div
            style={{
              background:   "color-mix(in srgb, var(--danger) 10%, transparent)",
              border:       "1px solid color-mix(in srgb, var(--danger) 30%, transparent)",
              borderRadius: 8,
              padding:      "10px 14px",
              fontSize:     12,
              color:        "var(--danger)",
              textAlign:    "center",
            }}
          >
            {tAuth("lockedOut", { seconds: secondsLeft })}
          </div>
        )}

        <PinPad
          pin={pin}
          setPin={setPin}
          onSubmit={handleSubmit}
          disabled={isLocked || loading}
          loading={loading}
        />

        {error && !isLocked && (
          <p style={{ fontSize: 12, color: "var(--danger)", textAlign: "center", margin: 0 }}>
            {error}
          </p>
        )}

        <Button
          variant="ghost"
          fullWidth
          onClick={onCancel}
          disabled={loading}
          style={{ marginTop: 4 }}
        >
          {t("cancel")}
        </Button>
      </div>
    </Modal>
  )
}
