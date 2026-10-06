"use client"

import { useSyncExternalStore } from "react"
import { formatDate, formatDateTime } from "@/lib/utils/date"

const subscribe = () => () => {}

/**
 * Shows the moment something happened (a sale, a login...) using the clock of the device.
 * The text is filled in by the browser only, so the server and the browser can never disagree
 * about it (their time-zone data for Morocco is not always the same).
 */
export function DateText({ value, time = false }: { value: Date | string | null | undefined; time?: boolean }) {
  const inBrowser = useSyncExternalStore(subscribe, () => true, () => false)
  if (!value) return <>-</>
  return <>{inBrowser ? (time ? formatDateTime(value) : formatDate(value)) : " "}</>
}
