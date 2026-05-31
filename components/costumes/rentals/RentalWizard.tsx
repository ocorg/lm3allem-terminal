"use client"

import { useState, useEffect, useMemo } from "react"
import { useTranslations }              from "next-intl"
import { useRouter }                    from "next/navigation"
import { Check, ChevronRight, Search, X } from "lucide-react"
import { useCaisse }                    from "@/components/caisse/CaisseProvider"
import { Modal }                        from "@/components/ui/Modal"
import { Button }                       from "@/components/ui/Button"
import { Input }                        from "@/components/ui/Input"
import { Select }                       from "@/components/ui/Select"
import { toast }                        from "@/hooks/useToast"
import { useConfirm }                   from "@/hooks/useConfirm"
import { formatMAD }                    from "@/lib/utils/currency"
import { ImageUploader }                from "@/components/magazin/inventory/ImageUploader"
import { createClient }                 from "@/lib/actions/costumes/clients"
import { createRental }                 from "@/lib/actions/costumes/rentals"
import type { CostumeItemForPOS, LookupById, LookupItem } from "@/lib/actions/costumes/pos"
import type { ClientForList }           from "@/lib/actions/costumes/clients"
import type { GuaranteeType, PaymentMethod } from "@prisma/client"

interface KitLine {
  costumeItemId: string
  quantity:      number
  name_fr:       string
  name_ar:       string
  stock:         number
  sellingPrice:  number
}

interface MeasurementLine {
  categoryId: string
  value:      string
  unit:       string
}

interface WizardData {
  clientId:            string | null
  isNewClient:         boolean
  newClientName:       string
  newClientPhone:      string
  newClientAddress:    string
  kitItems:            KitLine[]
  eventDate:           string
  scheduledPickupDate: string
  scheduledReturnDate: string
  measurements:        MeasurementLine[]
  guaranteeType:       GuaranteeType
  guaranteeAmount:     string
  guaranteePhotoUrl:   string
  totalAmount:         string
  amountPaid:          string
  paymentMethod:       PaymentMethod
}

const INITIAL: WizardData = {
  clientId: null, isNewClient: false, newClientName: "", newClientPhone: "", newClientAddress: "",
  kitItems: [],
  eventDate: "", scheduledPickupDate: "", scheduledReturnDate: "",
  measurements: [],
  guaranteeType: "id_card", guaranteeAmount: "", guaranteePhotoUrl: "",
  totalAmount: "", amountPaid: "0", paymentMethod: "cash",
}

const STEP_KEYS    = ["client", "kit", "dates", "measurements", "guarantee", "payment", "confirmation"] as const
const GUARANTEE_KEYS: GuaranteeType[] = ["cash_deposit", "id_card", "passport", "drivers_license"]
const PAYMENT_KEYS:   PaymentMethod[] = ["cash", "tpe", "banque"]

interface Props {
  isOpen:                boolean
  onClose:               () => void
  costumeItems:          CostumeItemForPOS[]
  clients:               ClientForList[]
  measurementCategories: LookupItem[]
  lookupById:            LookupById
  locale:                string
}

export function RentalWizard({ isOpen, onClose, costumeItems, clients, measurementCategories, lookupById, locale }: Props) {
  const { session } = useCaisse()
  const router      = useRouter()
  const { confirm, modal: confirmModal } = useConfirm()

  const tRental    = useTranslations("costumes.rental")
  const tGuarantee = useTranslations("costumes.guarantee")
  const tPayment   = useTranslations("payment")
  const tClients   = useTranslations("costumes.clients")
  const tCommon    = useTranslations("common")
  const tUi        = useTranslations("ui")

  const STEPS = STEP_KEYS.map(k => tRental(`steps.${k}` as Parameters<typeof tRental>[0]))
  const GUARANTEE_OPTIONS = GUARANTEE_KEYS.map(v => ({ value: v, label: tGuarantee(v as Parameters<typeof tGuarantee>[0]) }))
  const PAYMENT_OPTIONS   = PAYMENT_KEYS.map(v => ({ value: v, label: tPayment(v as Parameters<typeof tPayment>[0]) }))

  const [step,    setStep]    = useState(0)
  const [data,    setData]    = useState<WizardData>(INITIAL)
  const [loading, setLoading] = useState(false)
  const [errors,  setErrors]  = useState<Record<string, string>>({})

  const upd = (patch: Partial<WizardData>) => setData(p => ({ ...p, ...patch }))

  useEffect(() => {
    if (!isOpen) { setStep(0); setData(INITIAL); setErrors({}) }
    else if (measurementCategories.length && !data.measurements.length) {
      upd({ measurements: measurementCategories.map(c => ({ categoryId: c.id, value: "", unit: "cm" })) })
    }
  }, [isOpen, measurementCategories]) // eslint-disable-line react-hooks/exhaustive-deps

  const validate = (): boolean => {
    const e: Record<string, string> = {}
    if (step === 0) {
      if (data.isNewClient) {
        if (!data.newClientName.trim())  e.newClientName  = tCommon("required")
        if (!data.newClientPhone.trim()) e.newClientPhone = tCommon("required")
      } else {
        if (!data.clientId) e.client = tRental("validation.selectClient")
      }
    }
    if (step === 1 && !data.kitItems.length) e.kit = tRental("validation.addKitItem")
    if (step === 2) {
      if (!data.scheduledPickupDate) e.pickupDate = tCommon("required")
      if (!data.scheduledReturnDate) e.returnDate = tCommon("required")
    }
    if (step === 5) {
      if (!data.totalAmount || isNaN(+data.totalAmount)) e.totalAmount = tCommon("required")
      if (isNaN(+data.amountPaid))                       e.amountPaid  = tRental("validation.invalidAmount")
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const next = () => { if (validate()) setStep(s => Math.min(s + 1, 6)) }
  const prev = () => setStep(s => Math.max(s - 1, 0))

  const handleSubmit = async () => {
    setLoading(true)
    try {
      let clientId = data.clientId!
      if (data.isNewClient) {
        const res = await createClient({ name: data.newClientName, phone: data.newClientPhone, address: data.newClientAddress || undefined })
        clientId = res.id
      }
      await createRental({
        clientId,
        caisseSessionId:     session.id,
        eventDate:           data.eventDate    || undefined,
        scheduledPickupDate: data.scheduledPickupDate,
        scheduledReturnDate: data.scheduledReturnDate,
        totalAmount:         parseFloat(data.totalAmount),
        amountPaid:          parseFloat(data.amountPaid),
        paymentMethod:       data.paymentMethod,
        guaranteeType:       data.guaranteeType,
        guaranteeAmount:     data.guaranteeType === "cash_deposit" && data.guaranteeAmount ? parseFloat(data.guaranteeAmount) : undefined,
        guaranteePhotoUrl:   data.guaranteePhotoUrl || undefined,
        kitItems:            data.kitItems.map(ki => ({ costumeItemId: ki.costumeItemId, quantity: ki.quantity })),
        measurements:        data.measurements.filter(m => m.value).map(m => ({ categoryId: m.categoryId, value: m.value, unit: m.unit || undefined })),
      })
      toast(tRental("createSuccess"), "success")
      onClose(); router.refresh()
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : tCommon("error"), "error")
    } finally {
      setLoading(false)
    }
  }

  const handleRequestClose = async () => {
    if (step === 0 && !data.clientId && !data.newClientName) { onClose(); return }
    const ok = await confirm({
      title:        tRental("abandonTitle"),
      message:      tRental("abandonMessage"),
      confirmLabel: tRental("abandon"),
      variant:      "danger",
    })
    if (ok) onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={handleRequestClose} title={tRental("newRental")} size="xl" closeOnOverlayClick={false}>
      {confirmModal}

      {/* Stepper */}
      <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 24, overflowX: "auto", paddingBottom: 4 }}>
        {STEPS.map((s, i) => (
          <div key={s} style={{ display: "flex", alignItems: "center", gap: 0 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <div style={{
                width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700,
                background: i <= step ? "var(--primary)" : "var(--surface-2)",
                color:      i <= step ? "#1a1a1a"        : "var(--text-muted)",
                border:     `2px solid ${i <= step ? "var(--primary)" : "var(--border)"}`,
                flexShrink: 0,
              }}>
                {i < step ? <Check size={14} /> : i + 1}
              </div>
              <span style={{ fontSize: 10, fontWeight: i === step ? 600 : 400, color: i === step ? "var(--text)" : "var(--text-muted)", whiteSpace: "nowrap" }}>{s}</span>
            </div>
            {i < STEPS.length - 1 && <div style={{ width: 32, height: 2, background: i < step ? "var(--primary)" : "var(--border)", flexShrink: 0, marginBottom: 16 }} />}
          </div>
        ))}
      </div>

      {/* Step content */}
      <div style={{ minHeight: 280 }}>
        {step === 0 && <StepClient data={data} upd={upd} clients={clients} errors={errors} />}
        {step === 1 && <StepKit    data={data} upd={upd} costumeItems={costumeItems} lookupById={lookupById} locale={locale} errors={errors} />}
        {step === 2 && <StepDates  data={data} upd={upd} errors={errors} />}
        {step === 3 && <StepMeasurements data={data} upd={upd} measurementCategories={measurementCategories} lookupById={lookupById} />}
        {step === 4 && <StepGuarantee data={data} upd={upd} />}
        {step === 5 && <StepPayment   data={data} upd={upd} errors={errors} />}
        {step === 6 && <StepConfirm   data={data} clients={clients} costumeItems={costumeItems} lookupById={lookupById} measurementCategories={measurementCategories} />}
      </div>

      {/* Navigation */}
      <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 20, borderTop: "1px solid var(--border)", marginTop: 20 }}>
        <Button variant="secondary" onClick={step === 0 ? handleRequestClose : prev}>
          {step === 0 ? tCommon("cancel") : tCommon("back")}
        </Button>
        {step < 6
          ? <Button onClick={next} icon={<ChevronRight size={14} />}>{tRental("steps.next") === "steps.next" ? tCommon("next") : tRental("steps.next" as Parameters<typeof tRental>[0])}</Button>
          : <Button onClick={handleSubmit} loading={loading}>{tRental("confirmRental")}</Button>
        }
      </div>
    </Modal>
  )
}

// ── Step 1: Client ─────────────────────────────────────────────
function StepClient({ data, upd, clients, errors }: { data: WizardData; upd: (p: Partial<WizardData>) => void; clients: ClientForList[]; errors: Record<string, string> }) {
  const tClients = useTranslations("costumes.clients")
  const tRental  = useTranslations("costumes.rental")
  const tUi      = useTranslations("ui")
  const [search, setSearch] = useState("")

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return q ? clients.filter(c => c.name.toLowerCase().includes(q) || c.phone.includes(q)) : clients
  }, [clients, search])

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={() => upd({ isNewClient: false, clientId: null })}
          style={{ flex: 1, padding: "10px 0", borderRadius: 8, border: `2px solid ${!data.isNewClient ? "var(--primary)" : "var(--border)"}`, background: !data.isNewClient ? "color-mix(in srgb,var(--primary) 10%,transparent)" : "var(--surface)", cursor: "pointer", fontWeight: 600, fontSize: 13, color: "var(--text)" }}
        >
          {tRental("existingClient")}
        </button>
        <button
          onClick={() => upd({ isNewClient: true, clientId: null })}
          style={{ flex: 1, padding: "10px 0", borderRadius: 8, border: `2px solid ${data.isNewClient ? "var(--primary)" : "var(--border)"}`, background: data.isNewClient ? "color-mix(in srgb,var(--primary) 10%,transparent)" : "var(--surface)", cursor: "pointer", fontWeight: 600, fontSize: 13, color: "var(--text)" }}
        >
          {tRental("newClientToggle")}
        </button>
      </div>

      {data.isNewClient ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Input label={tClients("name")}  value={data.newClientName}  onChange={e => upd({ newClientName: e.target.value })}  error={errors.newClientName} />
          <Input label={tClients("phone")} value={data.newClientPhone} onChange={e => upd({ newClientPhone: e.target.value })} error={errors.newClientPhone} />
          <Input label={tRental("addressOptional")} value={data.newClientAddress} onChange={e => upd({ newClientAddress: e.target.value })} />
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ position: "relative" }}>
            <Search size={14} style={{ position: "absolute", insetInlineStart: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={tRental("searchClientPlaceholder")}
              style={{ width: "100%", paddingInlineStart: 32, paddingInlineEnd: 12, height: 36, border: "1px solid var(--border)", borderRadius: 8, background: "var(--surface)", color: "var(--text)", fontSize: 13, outline: "none", boxSizing: "border-box" }}
            />
          </div>
          {errors.client && <p style={{ color: "var(--danger)", fontSize: 12, margin: 0 }}>{errors.client}</p>}
          <div style={{ maxHeight: 200, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 8 }}>
            {filtered.slice(0, 20).map(c => (
              <button key={c.id} onClick={() => upd({ clientId: c.id })} style={{
                width: "100%", textAlign: "left", padding: "10px 14px", border: "none",
                borderBottom: "1px solid var(--border)", cursor: "pointer",
                background: data.clientId === c.id ? "color-mix(in srgb,var(--primary) 10%,transparent)" : "var(--surface)",
                display: "flex", justifyContent: "space-between", alignItems: "center",
              }}>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", margin: 0 }}>{c.name}</p>
                  <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "2px 0 0" }}>
                    {c.phone} · {tRental("locationsCount", { count: c.rentalCount })}
                  </p>
                </div>
                {data.clientId === c.id && <Check size={14} style={{ color: "var(--primary)" }} />}
              </button>
            ))}
            {filtered.length === 0 && (
              <p style={{ padding: "16px", color: "var(--text-muted)", fontSize: 13, margin: 0, textAlign: "center" }}>
                {tUi("noResults")}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Step 2: Kit ────────────────────────────────────────────────
function StepKit({ data, upd, costumeItems, lookupById, locale, errors }: { data: WizardData; upd: (p: Partial<WizardData>) => void; costumeItems: CostumeItemForPOS[]; lookupById: LookupById; locale: string; errors: Record<string, string> }) {
  const tRental = useTranslations("costumes.rental")
  const tUi     = useTranslations("ui")
  const [search, setSearch] = useState("")

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return q ? costumeItems.filter(i => i.name_fr.toLowerCase().includes(q) || i.name_ar.includes(q)) : costumeItems
  }, [costumeItems, search])

  const addItem = (item: CostumeItemForPOS) => {
    if (data.kitItems.some(k => k.costumeItemId === item.id)) return
    upd({ kitItems: [...data.kitItems, { costumeItemId: item.id, quantity: 1, name_fr: item.name_fr, name_ar: item.name_ar, stock: item.stock, sellingPrice: parseFloat(item.sellingPrice) }] })
  }
  const removeItem = (id: string) => upd({ kitItems: data.kitItems.filter(k => k.costumeItemId !== id) })
  const setQty     = (id: string, q: number) => upd({ kitItems: data.kitItems.map(k => k.costumeItemId === id ? { ...k, quantity: Math.max(1, Math.min(q, k.stock)) } : k) })

  const itemLabel = (item: CostumeItemForPOS) => {
    const parts: string[] = []
    if (item.sizeId  && lookupById[item.sizeId])  parts.push(lookupById[item.sizeId].label_fr)
    if (item.colorId && lookupById[item.colorId]) parts.push(lookupById[item.colorId].label_fr)
    return parts.join(" — ") || item.type
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, height: 300 }}>
      {/* Left: item search */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", margin: 0, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          {tRental("availableItems")}
        </p>
        <div style={{ position: "relative" }}>
          <Search size={14} style={{ position: "absolute", insetInlineStart: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={tUi("search")}
            style={{ width: "100%", paddingInlineStart: 32, height: 34, border: "1px solid var(--border)", borderRadius: 8, background: "var(--surface)", color: "var(--text)", fontSize: 13, outline: "none", boxSizing: "border-box" }}
          />
        </div>
        <div style={{ flex: 1, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 8 }}>
          {filtered.map(item => {
            const inKit = data.kitItems.some(k => k.costumeItemId === item.id)
            const isOut = item.stock === 0
            return (
              <button key={item.id} onClick={() => !isOut && !inKit && addItem(item)} disabled={isOut || inKit} style={{
                width: "100%", textAlign: "left", padding: "8px 12px", border: "none",
                borderBottom: "1px solid var(--border)", cursor: isOut || inKit ? "default" : "pointer",
                background: inKit ? "color-mix(in srgb,var(--primary) 8%,transparent)" : "var(--surface)",
                opacity: isOut ? 0.4 : 1,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {locale === "ar" ? item.name_ar : item.name_fr}
                    </p>
                    <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "1px 0 0" }}>{itemLabel(item)} · ×{item.stock}</p>
                  </div>
                  {inKit && <Check size={13} style={{ color: "var(--primary)", flexShrink: 0 }} />}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Right: kit */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", margin: 0, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          {tRental("kitSelected")}
        </p>
        {errors.kit && <p style={{ color: "var(--danger)", fontSize: 12, margin: 0 }}>{errors.kit}</p>}
        <div style={{ flex: 1, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 8 }}>
          {data.kitItems.length === 0
            ? <p style={{ padding: "16px", color: "var(--text-muted)", fontSize: 13, margin: 0, textAlign: "center" }}>{tRental("noItemAdded")}</p>
            : data.kitItems.map(ki => (
              <div key={ki.costumeItemId} style={{ padding: "8px 12px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ki.name_fr}</p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 4, background: "var(--surface-2)", borderRadius: 6, padding: "2px 4px" }}>
                  <button onClick={() => setQty(ki.costumeItemId, ki.quantity - 1)} style={{ width: 20, height: 20, border: "none", background: "none", cursor: "pointer", color: "var(--text)", fontSize: 14 }}>−</button>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", minWidth: 18, textAlign: "center" }}>{ki.quantity}</span>
                  <button onClick={() => setQty(ki.costumeItemId, ki.quantity + 1)} style={{ width: 20, height: 20, border: "none", background: "none", cursor: "pointer", color: "var(--text)", fontSize: 14 }}>+</button>
                </div>
                <button onClick={() => removeItem(ki.costumeItemId)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 2 }}><X size={13} /></button>
              </div>
            ))
          }
        </div>
        {data.kitItems.length > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0" }}>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{tRental("suggestedTotal")}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>
              {formatMAD(data.kitItems.reduce((s, k) => s + k.sellingPrice * k.quantity, 0))}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Step 3: Dates ──────────────────────────────────────────────
function StepDates({ data, upd, errors }: { data: WizardData; upd: (p: Partial<WizardData>) => void; errors: Record<string, string> }) {
  const tRental = useTranslations("costumes.rental")
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Input label={tRental("eventDateOptional")} type="date" value={data.eventDate} onChange={e => upd({ eventDate: e.target.value })} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Input label={tRental("pickupRequired") + " *"} type="date" value={data.scheduledPickupDate} onChange={e => upd({ scheduledPickupDate: e.target.value })} error={errors.pickupDate} />
        <Input label={tRental("returnRequired") + " *"}  type="date" value={data.scheduledReturnDate} onChange={e => upd({ scheduledReturnDate: e.target.value })} error={errors.returnDate} />
      </div>
    </div>
  )
}

// ── Step 4: Measurements ───────────────────────────────────────
function StepMeasurements({ data, upd, measurementCategories }: { data: WizardData; upd: (p: Partial<WizardData>) => void; measurementCategories: LookupItem[]; lookupById: LookupById }) {
  const tRental = useTranslations("costumes.rental")
  const tCommon = useTranslations("common")

  const setMeasurement = (categoryId: string, field: "value" | "unit", val: string) => {
    upd({ measurements: data.measurements.map(m => m.categoryId === categoryId ? { ...m, [field]: val } : m) })
  }

  if (!measurementCategories.length) return (
    <p style={{ color: "var(--text-muted)", fontSize: 13, textAlign: "center", paddingTop: 40 }}>
      {tRental("noMeasurementCats")}
    </p>
  )

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 12px" }}>{tRental("measurementNote")}</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {measurementCategories.map(cat => {
          const m = data.measurements.find(x => x.categoryId === cat.id)
          return (
            <div key={cat.id} style={{ display: "flex", gap: 6, alignItems: "flex-end" }}>
              <div style={{ flex: 1 }}>
                <Input label={cat.label_fr} type="number" value={m?.value ?? ""} onChange={e => setMeasurement(cat.id, "value", e.target.value)} />
              </div>
              <div style={{ width: 64 }}>
                <Input label={tCommon("unit")} value={m?.unit ?? "cm"} onChange={e => setMeasurement(cat.id, "unit", e.target.value)} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Step 5: Guarantee ──────────────────────────────────────────
function StepGuarantee({ data, upd }: { data: WizardData; upd: (p: Partial<WizardData>) => void }) {
  const tG      = useTranslations("costumes.guarantee")
  const tRental = useTranslations("costumes.rental")
  const GUARANTEE_OPTIONS = GUARANTEE_KEYS.map(v => ({ value: v, label: tG(v as Parameters<typeof tG>[0]) }))

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Select
        label={tRental("guaranteeTypeLabel")}
        value={data.guaranteeType}
        onChange={e => upd({ guaranteeType: e.target.value as GuaranteeType })}
        options={GUARANTEE_OPTIONS}
      />
      {data.guaranteeType === "cash_deposit" && (
        <Input label={tRental("depositAmountLabel")} type="number" value={data.guaranteeAmount} onChange={e => upd({ guaranteeAmount: e.target.value })} />
      )}
      <div>
        <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 8 }}>
          {tRental("guaranteePhotoLabel")}
        </p>
        <ImageUploader images={data.guaranteePhotoUrl ? [data.guaranteePhotoUrl] : []} onChange={urls => upd({ guaranteePhotoUrl: urls[0] ?? "" })} />
      </div>
    </div>
  )
}

// ── Step 6: Payment ────────────────────────────────────────────
function StepPayment({ data, upd, errors }: { data: WizardData; upd: (p: Partial<WizardData>) => void; errors: Record<string, string> }) {
  const tP      = useTranslations("payment")
  const tRental = useTranslations("costumes.rental")
  const PAYMENT_OPTIONS = PAYMENT_KEYS.map(v => ({ value: v, label: tP(v as Parameters<typeof tP>[0]) }))

  const suggested = useMemo(() => data.kitItems.reduce((s, k) => s + k.sellingPrice * k.quantity, 0), [data.kitItems])

  useEffect(() => {
    if (!data.totalAmount && suggested) upd({ totalAmount: suggested.toFixed(2) })
  }, [suggested]) // eslint-disable-line react-hooks/exhaustive-deps

  const total   = parseFloat(data.totalAmount) || 0
  const paid    = parseFloat(data.amountPaid)  || 0
  const balance = Math.max(0, total - paid)

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Input
        label={tRental("totalAmountLabel") + " *"}
        type="number"
        value={data.totalAmount}
        onChange={e => upd({ totalAmount: e.target.value })}
        error={errors.totalAmount}
        hint={suggested ? tRental("suggestedHint", { amount: formatMAD(suggested) }) : undefined}
      />
      <Input
        label={tRental("advanceAmountLabel")}
        type="number"
        value={data.amountPaid}
        onChange={e => upd({ amountPaid: e.target.value })}
        error={errors.amountPaid}
      />
      <div style={{ display: "flex", justifyContent: "space-between", background: "var(--surface-2)", borderRadius: 8, padding: "10px 14px" }}>
        <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{tRental("balance")}</span>
        <span style={{ fontSize: 14, fontWeight: 700, color: balance > 0 ? "var(--warning)" : "var(--success)" }}>{formatMAD(balance)}</span>
      </div>
      <div>
        <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          {tRental("paymentModeLabel")}
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          {PAYMENT_OPTIONS.map(m => (
            <button key={m.value} onClick={() => upd({ paymentMethod: m.value as PaymentMethod })} style={{
              padding: "10px 8px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer",
              border: `2px solid ${data.paymentMethod === m.value ? "var(--primary)" : "var(--border)"}`,
              background: data.paymentMethod === m.value ? "color-mix(in srgb,var(--primary) 10%,transparent)" : "var(--surface)",
              color: "var(--text)",
            }}>{m.label}</button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Step 7: Confirm ────────────────────────────────────────────
function StepConfirm({ data, clients, costumeItems: _ci, lookupById: _lb, measurementCategories: _mc }: { data: WizardData; clients: ClientForList[]; costumeItems: CostumeItemForPOS[]; lookupById: LookupById; measurementCategories: LookupItem[] }) {
  const tG      = useTranslations("costumes.guarantee")
  const tP      = useTranslations("payment")
  const tRental = useTranslations("costumes.rental")
  const tCommon = useTranslations("common")
  const GUARANTEE_OPTIONS = GUARANTEE_KEYS.map(v => ({ value: v, label: tG(v as Parameters<typeof tG>[0]) }))
  const PAYMENT_OPTIONS   = PAYMENT_KEYS.map(v => ({ value: v, label: tP(v as Parameters<typeof tP>[0]) }))

  const client     = clients.find(c => c.id === data.clientId)
  const clientName = data.isNewClient ? data.newClientName : (client?.name ?? "—")
  const kitPieces  = data.kitItems.reduce((s, k) => s + k.quantity, 0)

  const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
      <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{value}</span>
    </div>
  )

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      <Row label={tRental("confirmClientRow")}  value={clientName} />
      <Row label={tRental("confirmPickup")}     value={data.scheduledPickupDate ? new Date(data.scheduledPickupDate).toLocaleDateString("fr-MA") : "—"} />
      <Row label={tRental("confirmReturn")}     value={data.scheduledReturnDate ? new Date(data.scheduledReturnDate).toLocaleDateString("fr-MA") : "—"} />
      <Row label={tRental("confirmKitItems")}   value={tRental("kitSummary", { items: data.kitItems.length, pieces: kitPieces })} />
      <Row label={tRental("confirmGuarantee")}  value={GUARANTEE_OPTIONS.find(g => g.value === data.guaranteeType)?.label ?? data.guaranteeType} />
      <Row label={tCommon("total")}             value={formatMAD(data.totalAmount)} />
      <Row label={tRental("acompteLabel")}      value={formatMAD(data.amountPaid)} />
      <Row label={tRental("balance")}           value={formatMAD(Math.max(0, parseFloat(data.totalAmount || "0") - parseFloat(data.amountPaid || "0")))} />
      <Row label={tRental("paymentMethodColumn")} value={PAYMENT_OPTIONS.find(p => p.value === data.paymentMethod)?.label ?? data.paymentMethod} />
      <div style={{ marginTop: 12, padding: "10px 0" }}>
        <p style={{ fontSize: 12, color: "var(--success)", fontWeight: 600, margin: 0 }}>
          ✓ {tRental("readyToConfirm")}
        </p>
      </div>
    </div>
  )
}
