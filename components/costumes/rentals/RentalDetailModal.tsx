"use client"

import { formatDate, formatDay } from "@/lib/utils/date"
import { calendarKey } from "@/lib/utils/time"
import { useState, useEffect, useCallback } from "react"
import { useRouter }           from "next/navigation"
import { useTranslations }     from "next-intl"
import { ChevronRight, Plus, Pencil, Ban } from "lucide-react"
import { useOptionalCaisse }   from "@/components/caisse/CaisseProvider"
import { Modal }               from "@/components/ui/Modal"
import { Button }              from "@/components/ui/Button"
import { Input }               from "@/components/ui/Input"
import { Select }              from "@/components/ui/Select"
import { Textarea }            from "@/components/ui/Textarea"
import { Badge }               from "@/components/ui/Badge"
import { Spinner }             from "@/components/ui/Spinner"
import { toast }               from "@/hooks/useToast"
import { formatMAD }           from "@/lib/utils/currency"
import { parseAmount }         from "@/lib/utils/money"
import {
  getRentalById, advanceRentalStatus, addRentalPayment, cancelRental, updateRental, setKitItemReturned,
} from "@/lib/actions/costumes/rentals"
import type { RentalDetail }   from "@/lib/actions/costumes/rentals"
import type { LookupById }     from "@/lib/actions/costumes/pos"
import type { RentalStatus }   from "@prisma/client"
import React from "react"

const STATUS_ORDER: RentalStatus[] = ["booked", "in_preparation", "ready_for_pickup", "picked_up", "returned", "cleaning", "available"]

const GUARANTEE_LABELS: Record<string, string> = {
  cash_deposit:    "وديعة نقدية",
  id_card:         "بطاقة التعريف الوطنية",
  passport:        "جواز السفر",
  drivers_license: "رخصة السياقة",
}

const PAYMENT_TYPE_KEYS: Record<string, string> = {
  rental_payment:    "payTypeRental",
  remaining_balance: "payTypeBalance",
  deposit_collected: "payTypeDeposit",
  deposit_returned:  "payTypeRefund",
}

// Strings of the cancel / edit / deposit flows (the app is Arabic-only)
const L = {
  cancelledBadge:   "ملغى",
  cancelRental:     "إلغاء الإيجار",
  cancelWarning:    "سيتم تحرير القطع المحجوزة. هذا الإجراء لا رجعة فيه.",
  cancelReason:     "سبب الإلغاء *",
  refundAmount:     "المبلغ المسترجع للعميل (درهم)",
  refundHint:       "المبلغ المدفوع",
  refundMethod:     "طريقة الاسترجاع",
  refundNeedsCaisse:"الصندوق مغلق: لا يمكن تسجيل استرجاع نقدي الآن.",
  confirmCancel:    "تأكيد الإلغاء",
  keep:             "تراجع",
  editRental:       "تعديل الإيجار",
  pickup:           "تاريخ الاستلام",
  ret:              "تاريخ الإرجاع",
  event:            "تاريخ الحدث",
  total:            "المبلغ الإجمالي (درهم)",
  notes:            "ملاحظات",
  saved:            "تم الحفظ",
  cancelled:        "تم إلغاء الإيجار",
  depositHeld:      "ضمان محتفظ به",
  guaranteeAgreed:  "الضمان المتفق عليه",
  guaranteePhoto:   "صورة وثيقة الضمان",
  noCaisse:         "الصندوق مغلق: لا يمكن تسجيل المدفوعات.",
  itemReturned:     "مُرجَع",
  markReturned:     "تأكيد الإرجاع",
  undoReturned:     "تراجع",
  cancelledOn:      "ألغي بتاريخ",
}

interface Props {
  rentalId:   string
  lookupById: LookupById
  onClose:    () => void
}

export function RentalDetailModal({ rentalId, lookupById, onClose }: Props) {
  const { session } = useOptionalCaisse()
  const router      = useRouter()
  const tR          = useTranslations("costumes.rentals")
  const tS          = useTranslations("costumes.status")
  const tCom        = useTranslations("common")

  const [rental,       setRental]       = useState<RentalDetail | null>(null)
  const [loadingData,  setLoadingData]  = useState(true)
  const [showPayment,  setShowPayment]  = useState(false)
  const [showEdit,     setShowEdit]     = useState(false)
  const [showCancel,   setShowCancel]   = useState(false)
  const [advancing,    setAdvancing]    = useState(false)

  const load = useCallback(async () => {
    setLoadingData(true)
    try {
      setRental(await getRentalById(rentalId))
    } finally {
      setLoadingData(false)
    }
  }, [rentalId])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load() }, [load])

  const refresh = () => { void load(); router.refresh() }

  const handleAdvance = async () => {
    if (!rental) return
    setAdvancing(true)
    try {
      const res = await advanceRentalStatus(rental.id)
      if (!res.ok) { toast(res.message || tCom("error"), "error"); return }
      toast(`${tCom("status")}: ${tS(res.data.newStatus)}`, "success")
      refresh()
    } finally {
      setAdvancing(false)
    }
  }

  const handleItemReturned = async (kitItemId: string, returned: boolean) => {
    const res = await setKitItemReturned(kitItemId, returned)
    if (!res.ok) { toast(res.message || tCom("error"), "error"); return }
    void load()
  }

  const isCancelled  = rental?.status === "cancelled"
  const currentIdx   = rental && !isCancelled ? STATUS_ORDER.indexOf(rental.status) : -1
  const nextStatus   = rental && !isCancelled && currentIdx >= 0 && currentIdx < STATUS_ORDER.length - 1 ? STATUS_ORDER[currentIdx + 1] : null
  const editable     = !!rental && ["booked", "in_preparation", "ready_for_pickup"].includes(rental.status)
  const itemsTrackable = !!rental && ["picked_up", "returned", "cleaning"].includes(rental.status)
  const canPay       = !!rental && !isCancelled

  const sizeLine = (k: RentalDetail["kitItems"][number]) =>
    [
      k.sizeId && lookupById[k.sizeId] ? `بدلة ${lookupById[k.sizeId].label_ar}` : null,
      k.pantsSizeId && lookupById[k.pantsSizeId] ? `سروال ${lookupById[k.pantsSizeId].label_ar}` : null,
      k.shirtSizeId && lookupById[k.shirtSizeId] ? `قميص ${lookupById[k.shirtSizeId].label_ar}` : null,
      k.shoeSizeId && lookupById[k.shoeSizeId] ? `حذاء ${lookupById[k.shoeSizeId].label_ar}` : null,
    ].filter(Boolean).join(" · ")

  return (
    <Modal isOpen onClose={onClose} title={rental ? `${tR("rentalLabel")} ${rental.kitReference ?? rental.id.slice(0, 8)}` : tR("rentalLabel")} size="xl">
      {loadingData && !rental ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 40 }}><Spinner /></div>
      ) : !rental ? (
        <p style={{ color: "var(--text-muted)", textAlign: "center", padding: 24 }}>{tCom("noData")}</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

          {isCancelled ? (
            <div style={{ background: "color-mix(in srgb, var(--danger) 10%, transparent)", border: "1px solid color-mix(in srgb, var(--danger) 30%, transparent)", borderRadius: 8, padding: "10px 14px" }}>
              <Badge variant="danger">{L.cancelledBadge}</Badge>
              <p style={{ fontSize: 12, color: "var(--text)", margin: "6px 0 0" }}>
                {L.cancelledOn} {rental.cancelledAt ? formatDate(rental.cancelledAt) : "-"} - {rental.cancelReason}
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 0, overflowX: "auto", paddingBottom: 4 }}>
              {STATUS_ORDER.map((s, i) => {
                const done    = i < currentIdx
                const current = i === currentIdx
                return (
                  <div key={s} style={{ display: "flex", alignItems: "center" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                      <div style={{
                        width: 22, height: 22, borderRadius: "50%", fontSize: 12, fontWeight: 700,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        background: done || current ? "var(--brand)" : "var(--surface-2)",
                        color:      done || current ? "var(--on-brand)" : "var(--text-muted)",
                        border:     `2px solid ${done || current ? "var(--primary)" : "var(--border)"}`,
                        flexShrink: 0,
                      }}>{i + 1}</div>
                      <span style={{ fontSize: 12, fontWeight: current ? 700 : 400, color: current ? "var(--text)" : "var(--text-muted)", whiteSpace: "nowrap" }}>{tS(s)}</span>
                    </div>
                    {i < STATUS_ORDER.length - 1 && <div style={{ width: 24, height: 2, background: done ? "var(--brand)" : "var(--border)", flexShrink: 0, marginBottom: 14 }} />}
                  </div>
                )
              })}
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <InfoBox label={tR("infoClient")} value={`${rental.clientName} · ${rental.clientPhone}`} />
            <InfoBox label={tR("infoPickupReturn")} value={`من ${formatDay(rental.scheduledPickupDate)} إلى ${formatDay(rental.scheduledReturnDate)}`} />
            <InfoBox label={tR("infoTotalDeposit")} value={`${formatMAD(rental.totalAmount)} / ${formatMAD(rental.amountPaid)}`} />
            <InfoBox label={tR("infoBalance")} value={<span style={{ color: parseFloat(rental.balance) > 0 ? "var(--warning)" : "var(--success)", fontWeight: 700 }}>{formatMAD(rental.balance)}</span>} />
            <InfoBox
              label={tR("infoGuarantee")}
              value={
                <>
                  {GUARANTEE_LABELS[rental.guaranteeType] ?? rental.guaranteeType}
                  {rental.guaranteeAmount && <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{L.guaranteeAgreed}: {formatMAD(rental.guaranteeAmount)}</div>}
                  {rental.depositApplied && !rental.depositReturned && <div style={{ fontSize: 12, color: "var(--warning)", marginTop: 2 }}>{L.depositHeld}: {formatMAD(rental.depositHeld)}</div>}
                </>
              }
            />
            {rental.notes && <InfoBox label={tR("infoNotes")} value={rental.notes} />}
          </div>

          {rental.guaranteePhotoUrl && (
            <div>
              <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", margin: "0 0 8px" }}>{L.guaranteePhoto}</p>
              <a href={rental.guaranteePhotoUrl} target="_blank" rel="noopener noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={rental.guaranteePhotoUrl} alt={L.guaranteePhoto} style={{ maxHeight: 160, maxWidth: "100%", borderRadius: 8, border: "1px solid var(--border)", objectFit: "contain" }} />
              </a>
            </div>
          )}

          {rental.kitItems.length > 0 && (
            <div>
              <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", margin: "0 0 8px" }}>{tR("kitContents")}</p>
              <div style={{ border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
                {rental.kitItems.map((ki, i) => (
                  <div key={ki.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "8px 14px", borderBottom: i < rental.kitItems.length - 1 ? "1px solid var(--border)" : "none" }}>
                    <div style={{ minWidth: 0 }}>
                      <span style={{ fontSize: 13, color: "var(--text)" }}>{ki.sku ? `${ki.sku} · ` : ""}{ki.typeLabelAr}</span>
                      {sizeLine(ki) && <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{sizeLine(ki)}</div>}
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
                      {ki.quantity > 1 && <span style={{ fontSize: 12, color: "var(--text-muted)" }}>×{ki.quantity}</span>}
                      <Badge variant={ki.returned ? "success" : "default"}>{ki.returned ? tR("returned") : tR("inProgress")}</Badge>
                      {itemsTrackable && (
                        <Button size="sm" variant="secondary" onClick={() => handleItemReturned(ki.id, !ki.returned)}>
                          {ki.returned ? L.undoReturned : L.markReturned}
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", margin: 0 }}>{tR("payments")}</p>
              {canPay && (
                <Button size="sm" variant="secondary" icon={<Plus size={12} />} onClick={() => setShowPayment(true)} disabled={!session}>{tR("addPayment")}</Button>
              )}
            </div>
            {canPay && !session && <p style={{ fontSize: 12, color: "var(--warning)", margin: "0 0 8px" }}>{L.noCaisse}</p>}
            {rental.payments.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>{tR("noPayments")}</p>
            ) : (
              <div style={{ border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
                {rental.payments.map((p, i) => {
                  const outflow = p.type === "deposit_returned" || p.type === "rental_refund"
                  const typeKey = PAYMENT_TYPE_KEYS[p.type]
                  return (
                    <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 14px", borderBottom: i < rental.payments.length - 1 ? "1px solid var(--border)" : "none" }}>
                      <div>
                        <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", margin: 0 }}>
                          {p.type === "rental_refund" ? "استرجاع إيجار ملغى" : typeKey ? tR(typeKey as Parameters<typeof tR>[0]) : p.type}
                        </p>
                        <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "2px 0 0" }}>{p.actorName} · {formatDate(p.createdAt)}</p>
                      </div>
                      <span style={{ fontWeight: 700, color: outflow ? "var(--danger)" : "var(--success)" }}>{formatMAD(outflow ? -Number(p.amount) : p.amount)}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
            <div style={{ display: "flex", gap: 8 }}>
              {editable && <Button variant="secondary" size="sm" icon={<Pencil size={13} />} onClick={() => setShowEdit(true)}>{L.editRental}</Button>}
              {editable && <Button variant="danger" size="sm" icon={<Ban size={13} />} onClick={() => setShowCancel(true)}>{L.cancelRental}</Button>}
            </div>
            {nextStatus && (
              <Button icon={<ChevronRight size={14} />} onClick={handleAdvance} loading={advancing}>
                {tR("advance")}: {tS(nextStatus)}
              </Button>
            )}
          </div>
        </div>
      )}

      {showPayment && rental && (
        <AddPaymentModal
          rental={rental}
          sessionId={session?.id ?? null}
          onClose={() => setShowPayment(false)}
          onSuccess={() => { setShowPayment(false); refresh() }}
        />
      )}
      {showEdit && rental && (
        <EditRentalModal rental={rental} onClose={() => setShowEdit(false)} onSuccess={() => { setShowEdit(false); refresh() }} />
      )}
      {showCancel && rental && (
        <CancelRentalModal rental={rental} sessionId={session?.id ?? null} onClose={() => setShowCancel(false)} onSuccess={() => { setShowCancel(false); refresh() }} />
      )}
    </Modal>
  )
}

function InfoBox({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ background: "var(--surface-2)", borderRadius: 8, padding: "10px 14px" }}>
      <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", margin: "0 0 4px" }}>{label}</p>
      <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text)" }}>{value}</div>
    </div>
  )
}

type Method = "cash" | "tpe" | "banque"
type PaymentType = "rental_payment" | "remaining_balance" | "deposit_collected" | "deposit_returned"

function AddPaymentModal({ rental, sessionId, onClose, onSuccess }: { rental: RentalDetail; sessionId: string | null; onClose: () => void; onSuccess: () => void }) {
  const tR   = useTranslations("costumes.rentals")
  const tP   = useTranslations("payment")
  const tCom = useTranslations("common")

  const balance = parseFloat(rental.balance)

  // Only the operations that make sense for the rental's current state are offered
  const PAYMENT_TYPE_OPTIONS: { value: PaymentType; label: string }[] = [
    ...(balance > 0 ? [
      { value: "rental_payment" as const,    label: tR("payTypeRental")  },
      { value: "remaining_balance" as const, label: tR("payTypeBalance") },
    ] : []),
    ...(!rental.depositApplied ? [{ value: "deposit_collected" as const, label: tR("payTypeDeposit") }] : []),
    ...(rental.depositApplied && !rental.depositReturned ? [{ value: "deposit_returned" as const, label: tR("payTypeRefund") }] : []),
  ]
  const PAYMENT_METHOD_OPTIONS = [
    { value: "cash",   label: tP("cash")   },
    { value: "tpe",    label: tP("tpe")    },
    { value: "banque", label: tP("banque") },
  ]

  const defaultType = PAYMENT_TYPE_OPTIONS[0]?.value ?? "rental_payment"
  const defaultAmount = (t: PaymentType) =>
    t === "deposit_returned" ? rental.depositHeld
    : t === "deposit_collected" && rental.guaranteeAmount ? rental.guaranteeAmount
    : (t === "rental_payment" || t === "remaining_balance") && balance > 0 ? String(balance) : ""

  const [amount,  setAmount]  = useState(defaultAmount(defaultType))
  const [type,    setType]    = useState<PaymentType>(defaultType)
  const [method,  setMethod]  = useState<Method>("cash")
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState("")

  const handleSave = async () => {
    if (!sessionId) { setError(L.noCaisse); return }
    const num = parseAmount(amount)
    if (isNaN(num) || num <= 0) { setError(tCom("invalidAmount")); return }
    setLoading(true)
    try {
      const res = await addRentalPayment({ rentalId: rental.id, caisseSessionId: sessionId, amount: num, method, type })
      if (!res.ok) { setError(res.message); return }
      toast(tR("paymentAdded"), "success")
      onSuccess()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal isOpen onClose={onClose} title={tR("addPayment")} size="sm">
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {PAYMENT_TYPE_OPTIONS.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>{tR("noPaymentOperations")}</p>
        ) : (
          <>
            <Select label={tR("payType")} value={type} onChange={e => { const t = e.target.value as PaymentType; setType(t); setAmount(defaultAmount(t)); setError("") }} options={PAYMENT_TYPE_OPTIONS} />
            <Input  label={`${tCom("amount")} (درهم)`} type="number" value={amount} onChange={e => { setAmount(e.target.value); setError("") }} error={error} />
            <Select label={tP("paymentMethod")} value={method} onChange={e => setMethod(e.target.value as Method)} options={PAYMENT_METHOD_OPTIONS} />
          </>
        )}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <Button variant="secondary" onClick={onClose}>{tCom("cancel")}</Button>
          <Button onClick={handleSave} loading={loading} disabled={PAYMENT_TYPE_OPTIONS.length === 0}>{tCom("save")}</Button>
        </div>
      </div>
    </Modal>
  )
}

function EditRentalModal({ rental, onClose, onSuccess }: { rental: RentalDetail; onClose: () => void; onSuccess: () => void }) {
  const tCom = useTranslations("common")
  const toDate = (iso: string | null) => (iso ? calendarKey(iso) : "")

  const [pickup, setPickup] = useState(toDate(rental.scheduledPickupDate))
  const [ret,    setRet]    = useState(toDate(rental.scheduledReturnDate))
  const [event,  setEvent]  = useState(toDate(rental.eventDate))
  const [total,  setTotal]  = useState(rental.totalAmount)
  const [notes,  setNotes]  = useState(rental.notes ?? "")
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState("")

  const handleSave = async () => {
    const totalNum = parseAmount(total)
    if (isNaN(totalNum) || totalNum <= 0) { setError(tCom("invalidAmount")); return }
    if (ret < pickup) { setError("تاريخ الإرجاع يجب أن يكون بعد تاريخ الاستلام"); return }
    if (event && (event < pickup || event > ret)) { setError("يجب أن يكون تاريخ المناسبة بين تاريخ الاستلام وتاريخ الإرجاع"); return }
    setLoading(true)
    try {
      const res = await updateRental(rental.id, {
        scheduledPickupDate: pickup,
        scheduledReturnDate: ret,
        eventDate:           event || null,
        totalAmount:         totalNum,
        notes:               notes.trim() || null,
      })
      if (!res.ok) { setError(res.message); return }
      toast(L.saved, "success")
      onSuccess()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal isOpen onClose={onClose} title={L.editRental} size="md">
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Input label={L.pickup} type="date" value={pickup} onChange={e => { setPickup(e.target.value); setError("") }} />
          <Input label={L.ret} type="date" min={pickup} value={ret} onChange={e => { setRet(e.target.value); setError("") }} />
        </div>
        <Input label={L.event} type="date" min={pickup} max={ret} value={event} onChange={e => { setEvent(e.target.value); setError("") }} />
        <Input label={L.total} type="number" value={total} onChange={e => { setTotal(e.target.value); setError("") }} />
        <Textarea label={L.notes} value={notes} onChange={e => setNotes(e.target.value)} rows={3} />
        {error && <p style={{ color: "var(--danger)", fontSize: 12, margin: 0 }}>{error}</p>}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <Button variant="secondary" onClick={onClose}>{tCom("cancel")}</Button>
          <Button onClick={handleSave} loading={loading}>{tCom("save")}</Button>
        </div>
      </div>
    </Modal>
  )
}

function CancelRentalModal({ rental, sessionId, onClose, onSuccess }: { rental: RentalDetail; sessionId: string | null; onClose: () => void; onSuccess: () => void }) {
  const tP   = useTranslations("payment")
  const paid = parseFloat(rental.amountPaid)

  const [reason, setReason]   = useState("")
  const [refund, setRefund]   = useState(paid > 0 ? String(paid) : "")
  const [method, setMethod]   = useState<Method>("cash")
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState("")

  const handleCancel = async () => {
    if (reason.trim().length < 3) { setError("سبب الإلغاء مطلوب"); return }
    const refundNum = refund.trim() === "" ? 0 : parseAmount(refund)
    if (isNaN(refundNum) || refundNum < 0 || refundNum > paid) { setError("مبلغ الاسترجاع غير صالح"); return }
    if (refundNum > 0 && !sessionId) { setError(L.refundNeedsCaisse); return }

    setLoading(true)
    try {
      const res = await cancelRental(rental.id, {
        reason: reason.trim(),
        refund: refundNum > 0 && sessionId ? { amount: refundNum, method, caisseSessionId: sessionId } : undefined,
      })
      if (!res.ok) { setError(res.message); return }
      toast(L.cancelled, "success")
      onSuccess()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal isOpen onClose={onClose} title={L.cancelRental} size="sm">
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <p style={{ fontSize: 13, color: "var(--warning)", margin: 0, lineHeight: 1.6 }}>{L.cancelWarning}</p>
        <Textarea label={L.cancelReason} value={reason} onChange={e => { setReason(e.target.value); setError("") }} rows={3} />
        {paid > 0 && (
          <>
            <Input label={`${L.refundAmount} - ${L.refundHint}: ${formatMAD(paid)}`} type="number" value={refund} onChange={e => { setRefund(e.target.value); setError("") }} />
            <Select
              label={L.refundMethod}
              value={method}
              onChange={e => setMethod(e.target.value as Method)}
              options={[{ value: "cash", label: tP("cash") }, { value: "tpe", label: tP("tpe") }, { value: "banque", label: tP("banque") }]}
            />
          </>
        )}
        {error && <p style={{ color: "var(--danger)", fontSize: 12, margin: 0 }}>{error}</p>}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <Button variant="secondary" onClick={onClose}>{L.keep}</Button>
          <Button variant="danger" onClick={handleCancel} loading={loading}>{L.confirmCancel}</Button>
        </div>
      </div>
    </Modal>
  )
}
