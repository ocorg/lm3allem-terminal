import { defineRouting } from "next-intl/routing"

export const routing = defineRouting({
  locales: ["ar"] as const,
  defaultLocale: "ar",
})

export type Locale = (typeof routing.locales)[number]