"use client"

import { useState, useEffect, useRef } from "react"
import { useTranslations }             from "next-intl"
import { Search, X }                   from "lucide-react"
import React from "react"

interface SearchBarProps {
  value:        string
  onChange:     (value: string) => void
  placeholder?: string
  debounce?:    number
}

export function SearchBar({
  value,
  onChange,
  placeholder,
  debounce = 300,
}: SearchBarProps) {
  const tUi         = useTranslations("ui")
  const [local, setLocal]   = useState(value)
  const timerRef            = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const onChangeRef         = useRef(onChange)

  useEffect(() => { onChangeRef.current = onChange })
  useEffect(() => {
    if (value === "") setLocal("")
  }, [value])
  useEffect(() => () => clearTimeout(timerRef.current), [])

  const handleChange = (next: string) => {
    setLocal(next)
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => onChangeRef.current(next), debounce)
  }

  const handleClear = () => {
    clearTimeout(timerRef.current)
    setLocal("")
    onChangeRef.current("")
  }

  return (
    <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
      <Search
        size={15}
        style={{
          position:         "absolute",
          insetInlineStart: 12,
          color:            "var(--text-muted)",
          pointerEvents:    "none",
        }}
      />
      <input
        type="text"
        value={local}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={placeholder ?? tUi("search")}
        style={{
          width:              "100%",
          height:             40,
          background:         "var(--surface-2)",
          border:             "1px solid var(--border)",
          borderRadius:       8,
          paddingInlineStart: 36,
          paddingInlineEnd:   local ? 36 : 12,
          fontSize:           13,
          color:              "var(--text)",
          outline:            "none",
        }}
      />
      {local && (
        <button
          onClick={handleClear}
          aria-label="Clear search"
          style={{
            position:       "absolute",
            insetInlineEnd: 10,
            background:     "none",
            border:         "none",
            cursor:         "pointer",
            color:          "var(--text-muted)",
            display:        "flex",
            alignItems:     "center",
            padding:        2,
          }}
        >
          <X size={14} />
        </button>
      )}
    </div>
  )
}
