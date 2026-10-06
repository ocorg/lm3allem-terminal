"use client"

import { Sun, Moon } from "lucide-react"
import React from "react"
import { useEffect, useState } from "react"

interface ThemeToggleProps {
  /** Called after the theme changed (e.g. to persist it in the user's profile). */
  onChange?: (theme: "dark" | "light") => void
}

/** Applies the theme to <html> and stores it in the cookie the server reads on first paint. */
export function applyTheme(next: "dark" | "light", previous: "dark" | "light") {
  const html = document.documentElement
  html.dataset.theme = next
  html.classList.remove(previous)
  html.classList.add(next)
  document.cookie = `lm3allem-theme=${next}; path=/; max-age=31536000; samesite=lax`
}

export default function ThemeToggle({ onChange }: ThemeToggleProps) {
  const [theme, setTheme] = useState<"dark" | "light">("dark")

  useEffect(() => {
    const current = document.documentElement.dataset.theme
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (current === "light" || current === "dark") setTheme(current)
  }, [])

  function toggle() {
    const next: "dark" | "light" = theme === "dark" ? "light" : "dark"
    setTheme(next)
    applyTheme(next, theme)
    onChange?.(next)
  }

  return (
    <button
      onClick={toggle}
      aria-label={theme === "dark" ? "الوضع الفاتح" : "الوضع المظلم"}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 36,
        height: 36,
        borderRadius: 8,
        border: "1px solid var(--border)",
        background: "transparent",
        color: "var(--text-muted)",
        cursor: "pointer",
        flexShrink: 0,
        transition: "color 150ms ease, border-color 150ms ease",
      }}
      onMouseEnter={e => {
        e.currentTarget.style.color = "var(--primary)"
        e.currentTarget.style.borderColor = "var(--primary)"
      }}
      onMouseLeave={e => {
        e.currentTarget.style.color = "var(--text-muted)"
        e.currentTarget.style.borderColor = "var(--border)"
      }}
    >
      {theme === "dark" ? (
        <Sun size={16} strokeWidth={1.75} />
      ) : (
        <Moon size={16} strokeWidth={1.75} />
      )}
    </button>
  )
}
