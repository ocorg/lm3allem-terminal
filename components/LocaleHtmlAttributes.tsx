"use client"

import { useEffect } from "react"

interface LocaleHtmlAttributesProps {
  locale: string
  dir: "ltr" | "rtl"
  theme: string
}

export default function LocaleHtmlAttributes({
  locale,
  dir,
  theme,
}: LocaleHtmlAttributesProps) {
  useEffect(() => {
    const html = document.documentElement
    html.setAttribute("lang", locale)
    html.setAttribute("dir", dir)

    // Prefer the theme the user manually picked (saved in localStorage)
    // over the server-side session value — this prevents the theme from
    // resetting whenever the language is switched.
    let activeTheme = theme
    try {
      const stored = localStorage.getItem("lm3allem-theme")
      if (stored === "dark" || stored === "light") {
        activeTheme = stored
      }
    } catch {
      /* noop */
    }

    html.setAttribute("data-theme", activeTheme)
    html.className = activeTheme === "dark" ? "dark" : "light"
  }, [locale, dir, theme])

  return null
}