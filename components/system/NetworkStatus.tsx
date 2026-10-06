"use client"

import { formatDateTime } from "@/lib/utils/date"
import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { CloudOff, RefreshCw, TriangleAlert } from "lucide-react"
import { Modal } from "@/components/ui/Modal"
import { Button } from "@/components/ui/Button"
import { toast } from "@/hooks/useToast"
import { useOfflineQueue } from "@/hooks/useOfflineQueue"
import { isNetworkError, useOnline } from "@/lib/client/online"
import { removeQueuedSale, updateQueuedSale } from "@/lib/offline/queue"
import { syncQueuedSales } from "@/lib/offline/sync"
import { formatMAD } from "@/lib/utils/currency"
import React from "react"

const KIND_LABEL = { magazin: "المتجر", costumes: "البدلات" } as const

/**
 * Global connection layer (mounted once for the whole app):
 *  - tells the user clearly when the connection is lost / back;
 *  - sends the sales saved on this device as soon as the connection returns;
 *  - turns "failed to fetch" crashes into a readable explanation instead of a silent freeze.
 */
export default function NetworkStatus() {
  const router = useRouter()
  const online = useOnline()
  const { sales, pending, failed } = useOfflineQueue()
  const [panelOpen, setPanelOpen] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const wasOnline = useRef(true)

  const syncNow = useCallback(async (manual = false) => {
    if (!navigator.onLine) {
      if (manual) toast("لا يوجد اتصال بالإنترنت حاليا، ستُرسل العمليات تلقائيا عند عودته", "info")
      return
    }
    setSyncing(true)
    try {
      const r = await syncQueuedSales()
      if (r.synced > 0) {
        toast(`تم إرسال ${r.synced} ${r.synced > 1 ? "عمليات بيع" : "عملية بيع"} كانت محفوظة على هذا الجهاز`, "success")
        router.refresh()
      }
      if (r.failed > 0) toast(`${r.failed} عملية بيع رفضها الخادم، افتح قائمة العمليات المعلقة لمعرفة السبب`, "error", 10_000)
      if (r.stopped === "login") toast("انتهت الجلسة. سجّل الدخول من جديد وستُرسل العمليات المحفوظة تلقائيا", "error", 10_000)
    } catch {
      if (manual) toast("تعذر إرسال العمليات الآن، سنحاول مرة أخرى تلقائيا", "error")
    } finally {
      setSyncing(false)
    }
  }, [router])

  // Connection lost / back
  useEffect(() => {
    if (online && !wasOnline.current) {
      toast("عاد الاتصال بالإنترنت", "success")
      void syncNow()
    } else if (!online && wasOnline.current) {
      toast("انقطع الاتصال بالإنترنت. يمكنك متابعة البيع وستُحفظ العمليات على هذا الجهاز", "info", 8000)
    }
    wasOnline.current = online
  }, [online, syncNow])

  // First load + periodic retry while something is waiting
  useEffect(() => {
    const first = setTimeout(() => { void syncNow() }, 0)
    const id = setInterval(() => { if (navigator.onLine) void syncNow() }, 30_000)
    return () => { clearTimeout(first); clearInterval(id) }
  }, [syncNow])

  // A request that dies because of the network must explain itself, not vanish into the console
  useEffect(() => {
    const onRejection = (e: PromiseRejectionEvent) => {
      if (!isNetworkError(e.reason)) return
      e.preventDefault()
      toast("تعذر الاتصال بالخادم. تحقق من الإنترنت ثم أعد المحاولة. لم تُحفظ هذه العملية بعد", "error", 8000)
    }
    window.addEventListener("unhandledrejection", onRejection)
    return () => window.removeEventListener("unhandledrejection", onRejection)
  }, [])

  const showPill = !online || sales.length > 0
  if (!showPill) return null

  const label = !online
    ? `غير متصل${pending.length ? ` | ${pending.length} في الانتظار` : ""}`
    : failed.length
      ? `${failed.length} عملية تحتاج إلى مراجعة`
      : `${pending.length} عملية في انتظار الإرسال`

  const tone = !online ? "var(--warning)" : failed.length ? "var(--danger)" : "var(--info)"

  return (
    <>
      <button
        type="button"
        onClick={() => setPanelOpen(true)}
        style={{
          position: "fixed", bottom: 16, insetInlineStart: 16, zIndex: 9990,
          display: "flex", alignItems: "center", gap: 8,
          padding: "8px 14px", borderRadius: 999, cursor: "pointer",
          background: "var(--surface)", color: "var(--text)",
          border: `1px solid ${tone}`, boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
          fontSize: 12, fontWeight: 600,
        }}
      >
        {!online ? <CloudOff size={14} style={{ color: tone }} /> : failed.length ? <TriangleAlert size={14} style={{ color: tone }} /> : <RefreshCw size={14} className={syncing ? "spin" : undefined} style={{ color: tone }} />}
        {label}
      </button>

      <Modal isOpen={panelOpen} onClose={() => setPanelOpen(false)} title="العمليات المحفوظة على هذا الجهاز" size="lg">
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)", lineHeight: 1.7 }}>
            {online
              ? "هذه عمليات بيع أُنجزت أثناء انقطاع الإنترنت. تُرسل تلقائيا وبالترتيب، ولا يمكن أن تُسجَّل مرتين."
              : "لا يوجد اتصال بالإنترنت. تُحفظ عمليات البيع هنا وتُرسل تلقائيا عند عودة الاتصال. تجنّب إغلاق المتصفح أو مسح بيانات الموقع قبل ذلك."}
          </p>

          {sales.length === 0 ? (
            <p style={{ margin: 0, textAlign: "center", color: "var(--text-muted)", padding: 16 }}>لا توجد عمليات معلقة</p>
          ) : (
            <div style={{ border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
              {sales.map((s, i) => (
                <div key={s.requestId} style={{ padding: "10px 14px", borderBottom: i < sales.length - 1 ? "1px solid var(--border)" : "none", display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
                      {KIND_LABEL[s.kind]} | {formatMAD(s.totalAmount)} | {s.itemCount} {s.itemCount > 1 ? "قطع" : "قطعة"}
                    </p>
                    <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--text-muted)" }}>
                      {formatDateTime(new Date(s.createdAt))}
                    </p>
                    {s.status === "failed" && (
                      <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--danger)" }}>رفضها الخادم: {s.error}</p>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    {s.status === "failed" && (
                      <Button size="sm" variant="secondary" onClick={async () => { await updateQueuedSale({ ...s, status: "pending", error: undefined }); void syncNow(true) }}>
                        إعادة المحاولة
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={async () => {
                        if (window.confirm("حذف هذه العملية نهائيا من هذا الجهاز؟ لن تُسجَّل في النظام.")) await removeQueuedSale(s.requestId)
                      }}
                    >
                      حذف
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <Button variant="secondary" onClick={() => setPanelOpen(false)}>إغلاق</Button>
            <Button onClick={() => syncNow(true)} loading={syncing} disabled={pending.length === 0}>إرسال الآن</Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
