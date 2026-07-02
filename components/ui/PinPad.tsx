"use client"

import { Delete, XCircle } from "lucide-react"
import React from "react"

const DIGITS = 6

const GRID: string[][] = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["backspace", "0", "clear"],
]

interface PinPadProps {
  onSubmit: (pin: string) => void
  disabled?: boolean
  loading?: boolean
  pin: string
  setPin: (p: string | ((prev: string) => string)) => void
}

export default function PinPad({
  onSubmit,
  disabled = false,
  loading = false,
  pin,
  setPin,
}: PinPadProps) {
  const blocked = disabled || loading

  function handleKey(key: string) {
    if (blocked) return

    if (key === "backspace") {
      setPin(p => p.slice(0, -1))
      return
    }

    if (key === "clear") {
      setPin("")
      return
    }

    // Digit key
    if (pin.length < DIGITS) {
      const next = pin + key
      setPin(next)
      if (next.length === DIGITS) {
        // Brief pause so the 6th dot renders before auth kicks off
        setTimeout(() => {
          setPin("")
          onSubmit(next)
        }, 80)
      }
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 28, userSelect: "none" }}>
      {/* Dot display - fixed 6 positions */}
      <div style={{ display: "flex", gap: 14, alignItems: "center", height: 20 }}>
        {Array.from({ length: DIGITS }).map((_, i) => {
          const filled = i < pin.length
          return (
            <div
              key={i}
              style={{
                width: filled ? 13 : 10,
                height: filled ? 13 : 10,
                borderRadius: "50%",
                background: loading && i < pin.length
                  ? "var(--text-muted)"
                  : filled
                  ? "var(--primary)"
                  : "transparent",
                border: `2px solid ${
                  loading && i < pin.length
                    ? "var(--text-muted)"
                    : filled
                    ? "var(--primary)"
                    : "var(--border)"
                }`,
                transition: "all 120ms ease",
              }}
            />
          )
        })}
      </div>

      {/* Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 80px)", gap: 10 }}>
        {GRID.flat().map(key => (
          <KeyButton
            key={key}
            keyValue={key}
            blocked={blocked}
            hasPinDigits={pin.length > 0}
            loading={loading}
            onClick={() => handleKey(key)}
          />
        ))}
      </div>
    </div>
  )
}

interface KeyButtonProps {
  keyValue: string
  blocked: boolean
  hasPinDigits: boolean
  loading: boolean
  onClick: () => void
}

function KeyButton({ keyValue, blocked, hasPinDigits, loading, onClick }: KeyButtonProps) {
  const isBackspace = keyValue === "backspace"
  const isClear     = keyValue === "clear"
  const isSymbol    = isBackspace || isClear
  const isDisabled  = blocked || (isClear && !hasPinDigits)

  function scale(el: HTMLButtonElement, pressed: boolean) {
    if (!isDisabled) el.style.transform = pressed ? "scale(0.93)" : "scale(1)"
  }

  return (
    <button
      onClick={onClick}
      disabled={isDisabled}
      title={isBackspace ? "Effacer" : isClear ? "Tout effacer" : keyValue}
      style={{
        width: 80,
        height: 64,
        borderRadius: 10,
        border: "1px solid var(--border)",
        background: "var(--surface-2)",
        color: isClear
          ? hasPinDigits ? "var(--danger)" : "var(--border)"
          : isBackspace
          ? "var(--text-muted)"
          : "var(--text)",
        fontSize: isSymbol ? 0 : 22,
        fontWeight: 500,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: isDisabled ? "not-allowed" : "pointer",
        opacity: isDisabled && !isClear ? 0.4 : 1,
        transition: "all 120ms ease",
        WebkitTapHighlightColor: "transparent",
        touchAction: "manipulation",
      }}
      onMouseDown={e => scale(e.currentTarget, true)}
      onMouseUp={e => scale(e.currentTarget, false)}
      onMouseLeave={e => scale(e.currentTarget, false)}
      onTouchStart={e => scale(e.currentTarget, true)}
      onTouchEnd={e => scale(e.currentTarget, false)}
    >
      {isBackspace && <Delete size={20} strokeWidth={1.75} />}
      {isClear     && <XCircle size={18} strokeWidth={1.75} />}
      {!isSymbol   && keyValue}
    </button>
  )
}