"use client"

import { createContext, useContext, type ReactNode } from "react"
import React from "react"

const CurrentUserContext = createContext<string | null>(null)

/** The logged-in person's id, for the few browser features that must know it (offline sales). */
export function CurrentUserProvider({ userId, children }: { userId: string; children: ReactNode }) {
  return <CurrentUserContext.Provider value={userId}>{children}</CurrentUserContext.Provider>
}

export function useCurrentUserId(): string | null {
  return useContext(CurrentUserContext)
}
