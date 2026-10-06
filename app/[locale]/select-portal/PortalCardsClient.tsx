"use client"

import { useState, useEffect }     from "react"
import Link                        from "next/link"
import { useRouter }                from "next/navigation"
import { motion, useReducedMotion } from "framer-motion"
import { Store, Shirt, LayoutDashboard } from "lucide-react"
import type { LucideIcon }         from "lucide-react"
import type { Portal }             from "@prisma/client"
import React from "react"

const PORTAL_ICONS: Record<Portal, LucideIcon> = {
  magazin:  Store,
  costumes: Shirt,
  lm3allem: LayoutDashboard,
}

interface Props {
  portals: Portal[]
  locale:  string
  labels:  Record<Portal, string>
  descriptions: Record<Portal, string>
  /**
   * First screen THIS user may open in each portal (e.g. "pos", or "catalogue" for limited staff).
   * Cards link straight to it: going through the bare portal address would add a server redirect
   * on top of the loading screen, which is slower and can crash the page.
   */
  homes:   Record<Portal, string>
}

export function PortalCardsClient({ portals, locale, labels, descriptions, homes }: Props) {
  const shouldReduce = useReducedMotion()
  const router = useRouter()

  // Preload the first screen of every portal the user can open, while they are still choosing:
  // the click then feels instant instead of starting a cold load.
  useEffect(() => {
    for (const portal of portals) router.prefetch(`/${locale}/${portal}/${homes[portal]}`)
  }, [portals, locale, router, homes])
  // Gate the entrance animation until after client hydration.
  // Cards render fully visible (opacity 1) during SSR and on first paint,
  // then framer-motion animates them in from a slight y-offset.
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // rAF ensures we're past the first paint before triggering animation
    const id = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(id)
  }, [])

  return (
    <div style={{ display: "flex", gap: 20, flexWrap: "wrap", justifyContent: "center" }}>
      {portals.map((portal, index) => {
        const Icon = PORTAL_ICONS[portal]

        return (
          <motion.div
            key={portal}
            // Before mount: skip initial (renders at animate target = visible)
            // After mount:  animate from hidden → visible with stagger delay
            initial={mounted && !shouldReduce ? { opacity: 0, y: 24 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={
              mounted && !shouldReduce
                ? { duration: 0.32, delay: 0.1 + index * 0.08, ease: [0.22, 1, 0.36, 1] }
                : { duration: 0 }
            }
            whileHover={!shouldReduce ? { scale: 1.03 } : undefined}
            whileTap={!shouldReduce ? { scale: 0.97 } : undefined}
          >
            <Link href={`/${locale}/${portal}/${homes[portal]}`} className="portal-card">
              <span className="portal-card__icon">
                <Icon size={40} strokeWidth={1.5} />
              </span>
              <span className="portal-card__name">{labels[portal]}</span>
              <span className="portal-card__desc">{descriptions[portal]}</span>
            </Link>
          </motion.div>
        )
      })}
    </div>
  )
}
