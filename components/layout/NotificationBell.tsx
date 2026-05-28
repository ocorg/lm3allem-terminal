"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { Bell } from "lucide-react"
import { getPusherClient } from "@/lib/pusher/client"
import {
  getNotifications,
  markAsRead,
  markAllRead,
  type SerializedNotification,
} from "@/lib/actions/lm3allem/notifications"

const TYPE_COLORS: Record<string, string> = {
  rental:       "var(--primary)",
  caisse_open:  "var(--success)",
  caisse_close: "var(--text-muted)",
  low_stock:    "var(--danger)",
}

const TYPE_LABELS: Record<string, string> = {
  rental:       "Location",
  caisse_open:  "Caisse",
  caisse_close: "Caisse",
  low_stock:    "Stock",
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return "À l'instant"
  if (m < 60) return `Il y a ${m}min`
  const h = Math.floor(m / 60)
  if (h < 24) return `Il y a ${h}h`
  return `Il y a ${Math.floor(h / 24)}j`
}

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<SerializedNotification[]>([])
  const [open,          setOpen]          = useState(false)
  const [, startTransition]               = useTransition()
  const dropdownRef                       = useRef<HTMLDivElement>(null)

  const unreadCount = notifications.filter(n => !n.isRead).length

  // Load on mount
  useEffect(() => {
    getNotifications().then(setNotifications).catch(() => {})
  }, [])

  // Close on outside click
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", onClickOutside)
    return () => document.removeEventListener("mousedown", onClickOutside)
  }, [])

  // Pusher subscription
  useEffect(() => {
    const pusher  = getPusherClient()
    const channel = pusher.subscribe("private-lm3allem-notifications")

    channel.bind("notification:new", (data: SerializedNotification) => {
      setNotifications(prev => [data, ...prev].slice(0, 50))
    })

    return () => {
      channel.unbind_all()
      pusher.unsubscribe("private-lm3allem-notifications")
    }
  }, [])

  function handleOpen() {
    setOpen(prev => !prev)
  }

  function handleMarkRead(id: string) {
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, isRead: true } : n)
    )
    startTransition(async () => {
      await markAsRead(id).catch(() => {})
    })
  }

  function handleMarkAllRead() {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
    startTransition(async () => {
      await markAllRead().catch(() => {})
    })
  }

  return (
    <div ref={dropdownRef} style={{ position: "relative" }}>
      {/* Bell button */}
      <button
        onClick={handleOpen}
        style={{
          position:       "relative",
          display:        "flex",
          alignItems:     "center",
          justifyContent: "center",
          width:          36,
          height:         36,
          borderRadius:   8,
          border:         `1px solid ${open ? "var(--primary)" : "var(--border)"}`,
          background:     open ? "rgba(212,148,31,0.08)" : "transparent",
          color:          open ? "var(--primary)" : "var(--text-muted)",
          cursor:         "pointer",
          flexShrink:     0,
          transition:     "all 150ms ease",
        }}
        onMouseEnter={e => {
          if (!open) {
            e.currentTarget.style.color         = "var(--primary)"
            e.currentTarget.style.borderColor   = "var(--primary)"
          }
        }}
        onMouseLeave={e => {
          if (!open) {
            e.currentTarget.style.color         = "var(--text-muted)"
            e.currentTarget.style.borderColor   = "var(--border)"
          }
        }}
      >
        <Bell size={15} strokeWidth={1.75} />

        {/* Unread badge */}
        {unreadCount > 0 && (
          <span
            style={{
              position:       "absolute",
              top:            -4,
              insetInlineEnd: -4,
              minWidth:       16,
              height:         16,
              borderRadius:   8,
              background:     "var(--danger)",
              color:          "#ffffff",
              fontSize:       10,
              fontWeight:     700,
              display:        "flex",
              alignItems:     "center",
              justifyContent: "center",
              padding:        "0 3px",
              lineHeight:     1,
              border:         "1.5px solid var(--surface)",
            }}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div
          style={{
            position:    "absolute",
            insetInlineEnd: 0,
            top:         "calc(100% + 8px)",
            width:       340,
            background:  "var(--surface)",
            border:      "1px solid var(--border)",
            borderRadius: 10,
            boxShadow:   "0 8px 24px rgba(0,0,0,0.18)",
            zIndex:      500,
            overflow:    "hidden",
          }}
        >
          {/* Header */}
          <div
            style={{
              display:        "flex",
              alignItems:     "center",
              justifyContent: "space-between",
              padding:        "12px 14px",
              borderBottom:   "1px solid var(--border)",
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 600 }}>
              Notifications {unreadCount > 0 && `(${unreadCount})`}
            </span>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                style={{
                  fontSize:   11,
                  color:      "var(--primary)",
                  background: "none",
                  border:     "none",
                  cursor:     "pointer",
                  padding:    0,
                }}
              >
                Tout marquer lu
              </button>
            )}
          </div>

          {/* List */}
          <div style={{ maxHeight: 380, overflowY: "auto" }}>
            {notifications.length === 0 ? (
              <p
                style={{
                  padding:   "24px 14px",
                  textAlign: "center",
                  fontSize:  13,
                  color:     "var(--text-muted)",
                  margin:    0,
                }}
              >
                Aucune notification
              </p>
            ) : (
              notifications.map(n => (
                <div
                  key={n.id}
                  onClick={() => !n.isRead && handleMarkRead(n.id)}
                  style={{
                    display:       "flex",
                    gap:           10,
                    padding:       "10px 14px",
                    borderBottom:  "1px solid var(--border)",
                    background:    n.isRead ? "transparent" : "rgba(212,148,31,0.04)",
                    cursor:        n.isRead ? "default" : "pointer",
                    transition:    "background 150ms ease",
                  }}
                  onMouseEnter={e => {
                    if (!n.isRead) {
                      e.currentTarget.style.background = "rgba(212,148,31,0.08)"
                    }
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = n.isRead
                      ? "transparent"
                      : "rgba(212,148,31,0.04)"
                  }}
                >
                  {/* Type dot */}
                  <div
                    style={{
                      flexShrink:  0,
                      width:       8,
                      height:      8,
                      borderRadius: "50%",
                      background:  TYPE_COLORS[n.type] ?? "var(--text-muted)",
                      marginTop:   5,
                    }}
                  />

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display:        "flex",
                        justifyContent: "space-between",
                        gap:            6,
                        marginBottom:   2,
                      }}
                    >
                      <span
                        style={{
                          fontSize:   12,
                          fontWeight: n.isRead ? 400 : 600,
                          color:      "var(--text)",
                          overflow:   "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {n.title}
                      </span>
                      <span
                        style={{
                          fontSize:  10,
                          color:     "var(--text-muted)",
                          flexShrink: 0,
                        }}
                      >
                        {timeAgo(n.createdAt)}
                      </span>
                    </div>
                    <p
                      style={{
                        margin:       0,
                        fontSize:     12,
                        color:        "var(--text-muted)",
                        overflow:     "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace:   "nowrap",
                      }}
                    >
                      {TYPE_LABELS[n.type] ?? n.type} · {n.portal} · {n.body}
                    </p>
                  </div>

                  {/* Unread dot */}
                  {!n.isRead && (
                    <div
                      style={{
                        flexShrink:   0,
                        width:        6,
                        height:       6,
                        borderRadius: "50%",
                        background:   "var(--primary)",
                        marginTop:    6,
                      }}
                    />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}