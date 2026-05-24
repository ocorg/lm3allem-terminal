"use client"

import { useState, useEffect, useCallback } from "react"

export function useLocalStorage<T>(
  key:          string,
  initialValue: T
): [T, (value: T | ((prev: T) => T)) => void] {
  const [stored, setStored] = useState<T>(initialValue)

  // Read from storage on mount (avoids SSR mismatch)
  useEffect(() => {
    try {
      const item = window.localStorage.getItem(key)
      if (item !== null) setStored(JSON.parse(item) as T)
    } catch {
      // localStorage not available or invalid JSON — keep initialValue
    }
  }, [key])

  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      setStored((prev) => {
        const next = value instanceof Function ? value(prev) : value
        try {
          window.localStorage.setItem(key, JSON.stringify(next))
        } catch {
          // ignore write errors
        }
        return next
      })
    },
    [key]
  )

  return [stored, setValue]
}