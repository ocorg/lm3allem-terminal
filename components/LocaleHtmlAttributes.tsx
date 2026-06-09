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
    html.setAttribute("data-theme", theme)
    html.className = theme === "dark" ? "dark" : "light"
  }, [locale, dir, theme])

  return null
}