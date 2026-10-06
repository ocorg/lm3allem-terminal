"use client"

import { createContext, useContext, type ReactNode } from "react"
import type { SerializedCaisseSession } from "@/lib/actions/caisse"
import React from "react"

interface CaisseContextValue {
  /** null only inside an "optional" guard (screens that stay usable while the caisse is closed) */
  session: SerializedCaisseSession | null
}

const CaisseContext = createContext<CaisseContextValue | null>(null)

export function CaisseProvider({
  session,
  children,
}: {
  session:  SerializedCaisseSession | null
  children: ReactNode
}) {
  return (
    <CaisseContext.Provider value={{ session }}>
      {children}
    </CaisseContext.Provider>
  )
}

/** Use inside any component rendered under a strict CaisseGuard: the session is guaranteed. */
export function useCaisse(): { session: SerializedCaisseSession } {
  const ctx = useContext(CaisseContext)
  if (!ctx || !ctx.session) throw new Error("useCaisse must be used within CaisseProvider (inside a strict CaisseGuard)")
  return { session: ctx.session }
}

/** For screens that remain usable while the caisse is closed (e.g. viewing rentals). */
export function useOptionalCaisse(): { session: SerializedCaisseSession | null } {
  const ctx = useContext(CaisseContext)
  return { session: ctx?.session ?? null }
}
