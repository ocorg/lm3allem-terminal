"use client"

import { createContext, useContext, type ReactNode } from "react"
import type { SerializedCaisseSession } from "@/lib/actions/caisse"
import React from "react"

interface CaisseContextValue {
  session: SerializedCaisseSession
}

const CaisseContext = createContext<CaisseContextValue | null>(null)

export function CaisseProvider({
  session,
  children,
}: {
  session:  SerializedCaisseSession
  children: ReactNode
}) {
  return (
    <CaisseContext.Provider value={{ session }}>
      {children}
    </CaisseContext.Provider>
  )
}

/** Use inside any component rendered under CaisseGuard when a session is open. */
export function useCaisse(): CaisseContextValue {
  const ctx = useContext(CaisseContext)
  if (!ctx) throw new Error("useCaisse must be used within CaisseProvider (inside CaisseGuard)")
  return ctx
}