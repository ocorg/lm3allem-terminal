"use client"

import { useTransition, type CSSProperties, type ReactNode } from "react"
import { signOutUser } from "@/lib/auth/actions"
import { clearOfflinePageCache } from "@/components/system/ServiceWorkerRegister"
import React from "react"

/**
 * Logout that also wipes the pages cached for offline use (they contain this user's data).
 * Sales still waiting to be sent are NOT deleted: they are synced when the next user logs in.
 */
export function LogoutButton({ locale, children, style, className }: {
  locale: string
  children: ReactNode
  style?: CSSProperties
  className?: string
}) {
  const [pending, start] = useTransition()
  return (
    <button
      type="button"
      className={className}
      disabled={pending}
      style={style}
      onClick={() => start(async () => {
        await clearOfflinePageCache()
        await signOutUser(locale)
      })}
    >
      {children}
    </button>
  )
}
