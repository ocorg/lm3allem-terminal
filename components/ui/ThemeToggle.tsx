"use client"

import { Sun, Moon } from "lucide-react"
import React from "react"
import { useEffect, useState } from "react"

export default function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">("dark")

  useEffect(() => {
    const current = document.documentElement.dataset.theme
    if (current === "light" || current === "dark") setTheme(current)
  }, [])

  function toggle() {
    const next: "dark" | "light" = theme === "dark" ? "light" : "dark"
    setTheme(next)
    const html = document.documentElement
    html.dataset.theme = next
    html.classList.remove(theme)
    html.classList.add(next)
    try {
      localStorage.setItem("lm3allem-theme", next)
    } catch {
      /* noop */
    }
  }

  return (
    <button
      onClick={toggle}
      aria-label={theme === "dark" ? "Passer en mode clair" : "Passer en mode sombre"}
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