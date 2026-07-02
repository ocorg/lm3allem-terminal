"use client"

import { useState, type SelectHTMLAttributes, type ReactNode } from "react"
import { ChevronDown } from "lucide-react"
import React from "react"

interface SelectOption {
  value: string
  label: string
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?:   string
  error?:   string
  hint?:    string
  options:  SelectOption[]
  placeholder?: string
}

export function Select({
  label,
  error,
  hint,
  options,
  placeholder,
  style,
  onFocus,
  onBlur,
  ...props
}: SelectProps) {
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

      <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
        <select
          style={{
            width:              "100%",
            height:             42,
            background:         "var(--surface-2)",
            border:             `${borderWidth}px solid ${borderColor}`,
            borderRadius:       8,
            paddingInlineStart: 12,
            paddingInlineEnd:   36,
            fontSize:           13,
            color:              "var(--text)",
            outline:            "none",
            appearance:         "none",
            cursor:             "pointer",
            transition:         "border-color 150ms",
            ...style,
          }}
          onFocus={(e) => { setFocused(true);  onFocus?.(e) }}
          onBlur={(e)  => { setFocused(false); onBlur?.(e)  }}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        <ChevronDown
          size={16}
          style={{
            position:        "absolute",
            insetInlineEnd:  12,
            color:           "var(--text-muted)",
            pointerEvents:   "none",
          }}
        />
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