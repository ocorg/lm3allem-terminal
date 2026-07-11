"use client"

import React from "react"
import { useState, type InputHTMLAttributes, type ReactNode } from "react"

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?:     string
  error?:     string
  hint?:      string
  leftIcon?:  ReactNode
  rightIcon?: ReactNode
}

export function Input({
  label,
  error,
  hint,
  leftIcon,
  rightIcon,
  style,
  onFocus,
  onBlur,
  ...props
}: InputProps) {
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
            fontSize:    12,
            fontWeight:  500,
            color:       error ? "var(--danger)" : "var(--text-muted)",
            userSelect:  "none",
          }}
        >
          {label}
        </label>
      )}

      <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
        {leftIcon && (
          <span
            style={{
              position:         "absolute",
              insetInlineStart: 12,
              color:            "var(--text-muted)",
              pointerEvents:    "none",
              display:          "flex",
            }}
          >
            {leftIcon}
          </span>
        )}

        <input
          style={{
            width:              "100%",
            height:             42,
            background:         "var(--surface-2)",
            border:             `${borderWidth}px solid ${borderColor}`,
            borderRadius:       8,
            paddingInlineStart: leftIcon  ? 36 : 12,
            paddingInlineEnd:   rightIcon ? 36 : 12,
            fontSize:           13,
            color:              "var(--text)",
            outline:            "none",
            transition:         "border-color 150ms",
            ...style,
          }}
          onFocus={(e) => { setFocused(true);  onFocus?.(e) }}
          onBlur={(e)  => { setFocused(false); onBlur?.(e)  }}
          {...props}
          type={props.type === "number" ? "text" : props.type}
          inputMode={props.type === "number" ? "decimal" : props.inputMode}
        />

        {rightIcon && (
          <span
            style={{
              position:        "absolute",
              insetInlineEnd:  12,
              color:           "var(--text-muted)",
              display:         "flex",
              pointerEvents:   "none",
            }}
          >
            {rightIcon}
          </span>
        )}
      </div>

      {error && (
        <span style={{ fontSize: 11, color: "var(--danger)" }}>{error}</span>
      )}
      {hint && !error && (
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{hint}</span>
      )}
    </div>
  )
}