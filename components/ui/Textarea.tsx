"use client"

import React from "react"
import { useState, type TextareaHTMLAttributes } from "react"

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
  hint?:  string
  rows?:  number
}

export function Textarea({
  label,
  error,
  hint,
  rows = 4,
  style,
  onFocus,
  onBlur,
  ...props
}: TextareaProps) {
  const [focused, setFocused] = useState(false)

  const borderColor = focused
    ? "var(--primary)"
    : error
    ? "var(--danger)"
    : "var(--border)"

  const borderWidth = focused ? 2 : 1

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {label && (
        <label
          style={{
            fontSize:   12,
            fontWeight: 500,
            color:      error ? "var(--danger)" : "var(--text-muted)",
            userSelect: "none",
          }}
        >
          {label}
        </label>
      )}

      <textarea
        rows={rows}
        style={{
          width:       "100%",
          background:  "var(--surface-2)",
          border:      `${borderWidth}px solid ${borderColor}`,
          borderRadius: 8,
          padding:     "10px 12px",
          fontSize:    13,
          color:       "var(--text)",
          outline:     "none",
          resize:      "vertical",
          fontFamily:  "inherit",
          lineHeight:  1.5,
          transition:  "border-color 150ms",
          ...style,
        }}
        onFocus={(e) => { setFocused(true);  onFocus?.(e) }}
        onBlur={(e)  => { setFocused(false); onBlur?.(e)  }}
        {...props}
      />

      {error && (
        <span style={{ fontSize: 11, color: "var(--danger)" }}>{error}</span>
      )}
      {hint && !error && (
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{hint}</span>
      )}
    </div>
  )
}