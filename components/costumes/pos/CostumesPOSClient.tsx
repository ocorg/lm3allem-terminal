"use client"

import { useState, useMemo, useEffect }  from "react"
import { useRouter }          from "next/navigation"
import { ShoppingCart, Package } from "lucide-react"
import Image                     from "next/image"
import { useCaisse }          from "@/components/caisse/CaisseProvider"
import { BelowMinModal, type BelowMinItem } from "@/components/caisse/BelowMinModal"
import { Modal }              from "@/components/ui/Modal"
import { Button }             from "@/components/ui/Button"
import { SearchBar }          from "@/components/ui/SearchBar"
import { toast }              from "@/hooks/useToast"
import { formatMAD }          from "@/lib/utils/currency"
import { createCostumeSale }  from "@/lib/actions/costumes/pos"
import type { CostumeItemForPOS, LookupById, LookupItem } from "@/lib/actions/costumes/pos"
import type { PaymentMethod }                              from "@prisma/client"
import React from "react"

// ── Types ──────────────────────────────────────────────────────
interface CartEntry {
  costumeItemId:   string
  name_fr:         string
  itemLabel:       string
  stock:           number
  sellingPrice:    number
  minSellingPrice: number
  unitPrice:       number
  quantity:        number
}

interface Props {
  items:        CostumeItemForPOS[]
  costumeTypes: LookupItem[]
  lookupById:   LookupById
  locale:       string
  role:         string
}

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "cash",   label: "Espèces"  },
  { value: "tpe",    label: "TPE"      },
  { value: "banque", label: "Virement" },
]

// ── Component ──────────────────────────────────────────────────
export function CostumesPOSClient({ items, costumeTypes, lookupById, locale }: Props) {
  const { session } = useCaisse()
  const router      = useRouter()

  const [cart,         setCart]         = useState<CartEntry[]>([])
  const [search,       setSearch]       = useState("")
  const [typeFilter,   setTypeFilter]   = useState<string | null>(null)
  const [showPayment,  setShowPayment]  = useState(false)
  const [showBelowMin, setShowBelowMin] = useState(false)
  const [pendingItems, setPendingItems] = useState<BelowMinItem[]>([])
  const [authorized,   setAuthorized]   = useState<Record<string, string>>({})
  const [payMethod,    setPayMethod]    = useState<PaymentMethod>("cash")
  const [loading,      setLoading]      = useState(false)

  const label = (item: CostumeItemForPOS) => {
    const parts: string[] = []
    if (item.sizeId  && lookupById[item.sizeId])  parts.push(lookupById[item.sizeId].label_fr)
    if (item.colorId && lookupById[item.colorId]) parts.push(lookupById[item.colorId].label_fr)
    return parts.join(" - ") || item.typeLabelFr
  }

  const filtered = useMemo(() => items.filter(i => {
    const q = search.trim().toLowerCase()
    return (!typeFilter || i.typeId === typeFilter)
      && (!q || i.name_fr.toLowerCase().includes(q) || i.name_ar.includes(q))
  }), [items, typeFilter, search])

  const addToCart = (item: CostumeItemForPOS) => {
    if (item.stock === 0) return
    setCart(prev => {
      const ex = prev.find(c => c.costumeItemId === item.id)
      if (ex) {
        if (ex.quantity >= item.stock) return prev
        return prev.map(c => c.costumeItemId === item.id ? { ...c, quantity: c.quantity + 1 } : c)
      }
      return [...prev, {
        costumeItemId:   item.id,
        name_fr:         item.name_fr,
        itemLabel:       label(item),
        stock:           item.stock,
        sellingPrice:    parseFloat(item.sellingPrice),
        minSellingPrice: parseFloat(item.minSellingPrice),
        unitPrice:       parseFloat(item.sellingPrice),
        quantity:        1,
      }]
    })
  }

  const updateQty   = (id: string, qty: number) =>
    qty <= 0
      ? setCart(p => p.filter(c => c.costumeItemId !== id))
      : setCart(p => p.map(c => c.costumeItemId === id ? { ...c, quantity: Math.min(qty, c.stock) } : c))

  const updatePrice = (id: string, price: number) =>
    setCart(p => p.map(c => c.costumeItemId === id ? { ...c, unitPrice: price } : c))

  const subtotal  = useMemo(() => cart.reduce((s, c) => s + c.unitPrice * c.quantity, 0), [cart])
  const totalQty  = cart.reduce((s, c) => s + c.quantity, 0)
  const isRTL     = locale === "ar"

  const [isMobile,  setIsMobile]  = useState(false)
  const [mobileTab, setMobileTab] = useState<"products" | "cart">("products")

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener("resize", check)
    return () => window.removeEventListener("resize", check)
  }, [])

  const handleCheckout = () => {
    if (!cart.length) return
    const below = cart.filter(c => c.unitPrice < c.minSellingPrice && !authorized[c.costumeItemId])
    if (below.length) {
      setPendingItems(below.map(c => ({ name: c.name_fr, requestedPrice: c.unitPrice, minPrice: c.minSellingPrice })))
      setShowBelowMin(true)
    } else {
      setShowPayment(true)
    }
  }

  const handleConfirm = async () => {
    setLoading(true)
    try {
      await createCostumeSale({
        caisseSessionId: session.id,
        paymentMethod:   payMethod,
        totalAmount:     subtotal,
        items: cart.map(c => ({
          costumeItemId:   c.costumeItemId,
          quantity:        c.quantity,
          unitPrice:       c.unitPrice,
          wasBelowMin:     c.unitPrice < c.minSellingPrice,
          authorizedById:  authorized[c.costumeItemId],
        })),
      })
      toast("Vente enregistrée", "success")
      setCart([]); setAuthorized({}); setShowPayment(false)
      router.refresh()
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erreur", "error")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: isMobile ? "column" : (isRTL ? "row-reverse" : "row"), height: "calc(100vh - 64px)", overflow: "hidden" }}>

      {/* Mobile: tab switcher */}
      {isMobile && (
        <div style={{ display: "flex", flexShrink: 0, background: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
          {(["products", "cart"] as const).map(tab => {
            const active = mobileTab === tab
            const label  = tab === "products"
              ? "Articles"
              : `Panier${totalQty > 0 ? ` (${totalQty})` : ""}`
            return (
              <button
                key={tab}
                onClick={() => setMobileTab(tab)}
                style={{
                  flex: 1, padding: "14px 8px",
                  border: "none",
                  borderBottom: `2px solid ${active ? "var(--primary)" : "transparent"}`,
                  background: "none", cursor: "pointer",
                  fontSize: 14, fontWeight: active ? 700 : 500,
                  color: active ? "var(--primary)" : "var(--text-muted)",
                  transition: "all 0.15s",
                }}
              >
                {label}
              </button>
            )
          })}
        </div>
      )}

      {/* ── Items panel ── */}
      {(!isMobile || mobileTab === "products") && (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", borderInlineEnd: isMobile ? "none" : "1px solid var(--border)" }}>
        <div style={{ padding: "12px 16px 0", display: "flex", flexDirection: "column", gap: 10, flexShrink: 0 }}>
          <SearchBar value={search} onChange={setSearch} placeholder="Rechercher..." />
          <div style={{ display: "flex", gap: 6, overflowX: "auto", scrollbarWidth: "none", paddingBottom: 2 }}>
            <Chip label="Tous"  active={!typeFilter}   onClick={() => setTypeFilter(null)} />
            {costumeTypes.map(t => (
              <Chip key={t.id} label={t.label_fr} active={typeFilter === t.id} onClick={() => setTypeFilter(f => f === t.id ? null : t.id)} />
            ))}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px 16px" }}>
          {filtered.length === 0 ? (
            <p style={{ textAlign: "center", color: "var(--text-muted)", paddingTop: 64, fontSize: 13, margin: 0 }}>Aucun article</p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(148px, 1fr))", gap: 12 }}>
              {filtered.map(item => {
                const inCart = cart.some(c => c.costumeItemId === item.id)
                const isOut  = item.stock === 0
                const name   = locale === "ar" ? item.name_ar : item.name_fr
                return (
                  <button key={item.id} onClick={() => addToCart(item)} disabled={isOut} style={{
                    background:   isOut ? "var(--surface-2)" : "var(--surface)",
                    border:       `1px solid ${inCart ? "var(--primary)" : "var(--border)"}`,
                    borderRadius: 10, padding: 0, cursor: isOut ? "not-allowed" : "pointer",
                    textAlign: "left", overflow: "hidden", opacity: isOut ? 0.5 : 1, transition: "border-color 0.15s",
                  }}>
                    <div style={{ position: "relative", width: "100%", aspectRatio: "1", overflow: "hidden", background: "var(--surface-2)" }}>
                      {item.images[0]
                        ? <Image src={item.images[0]} alt={name} fill style={{ objectFit: "cover" }} />
                        : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}><Package size={28} style={{ color: "var(--border)" }} /></div>
                      }
                    </div>
                    <div style={{ padding: "8px 10px 10px" }}>
                      <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", margin: "0 0 2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</p>
                      <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "0 0 6px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label(item)}</p>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text)" }}>{formatMAD(item.sellingPrice)}</span>
                        <span style={{
                          fontSize: 10, fontWeight: 600, padding: "2px 6px", borderRadius: 999,
                          color:       isOut ? "var(--danger)" : item.stock <= 2 ? "var(--warning)" : "var(--success)",
                          background:  isOut ? "color-mix(in srgb,var(--danger) 10%,transparent)" : item.stock <= 2 ? "color-mix(in srgb,var(--warning) 10%,transparent)" : "color-mix(in srgb,var(--success) 10%,transparent)",
                        }}>
                          {isOut ? "Épuisé" : `×${item.stock}`}
                        </span>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
      )}

      {/* ── Cart panel ── */}
      {(!isMobile || mobileTab === "cart") && (
      <div style={{ width: isMobile ? "100%" : 340, flexShrink: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "14px 16px 12px", borderBottom: "1px solid var(--border)", flexShrink: 0, display: "flex", alignItems: "center", gap: 8 }}>
          <ShoppingCart size={16} style={{ color: "var(--text-muted)" }} />
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>Panier</span>
          {totalQty > 0 && <span style={{ background: "var(--primary)", color: "#1a1a1a", borderRadius: 999, fontSize: 10, fontWeight: 700, padding: "1px 7px", marginInlineStart: "auto" }}>{totalQty}</span>}
        </div>

        <div style={{ flex: 1, overflowY: "auto" }}>
          {cart.length === 0
            ? <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 56, gap: 8 }}><ShoppingCart size={36} style={{ color: "var(--border)" }} /><p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>Panier vide</p></div>
            : cart.map(entry => (
              <div key={entry.costumeItemId} style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <div style={{ flex: 1, minWidth: 0, marginInlineEnd: 8 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{entry.name_fr}</p>
                    <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "2px 0 0" }}>{entry.itemLabel}</p>
                  </div>
                  <button onClick={() => updateQty(entry.costumeItemId, 0)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 2, fontSize: 14 }}>✕</button>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, background: "var(--surface-2)", borderRadius: 8, padding: "2px 6px" }}>
                    <button onClick={() => updateQty(entry.costumeItemId, entry.quantity - 1)} style={{ width: 22, height: 22, border: "none", background: "none", cursor: "pointer", color: "var(--text)", fontSize: 16 }}>-</button>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", minWidth: 20, textAlign: "center" }}>{entry.quantity}</span>
                    <button onClick={() => updateQty(entry.costumeItemId, entry.quantity + 1)} style={{ width: 22, height: 22, border: "none", background: "none", cursor: "pointer", color: "var(--text)", fontSize: 16 }}>+</button>
                  </div>
                  <input
                    type="number"
                    value={entry.unitPrice}
                    onChange={e => updatePrice(entry.costumeItemId, parseFloat(e.target.value) || 0)}
                    style={{
                      flex: 1, background: "var(--surface-2)", outline: "none",
                      border: `1px solid ${entry.unitPrice < entry.minSellingPrice ? "var(--warning)" : "var(--border)"}`,
                      borderRadius: 6, padding: "4px 8px", fontSize: 13, fontWeight: 600, color: "var(--text)",
                    }}
                  />
                  <span style={{ fontSize: 12, color: "var(--text-muted)", whiteSpace: "nowrap" }}>{formatMAD(entry.unitPrice * entry.quantity)}</span>
                </div>
              </div>
            ))
          }
        </div>

        <div style={{ padding: 16, borderTop: "1px solid var(--border)", flexShrink: 0 }}>
          {cart.some(c => c.unitPrice < c.minSellingPrice) && (
            <div style={{ background: "color-mix(in srgb,var(--warning) 10%,transparent)", border: "1px solid color-mix(in srgb,var(--warning) 30%,transparent)", borderRadius: 8, padding: "8px 12px", marginBottom: 12 }}>
              <p style={{ fontSize: 11, color: "var(--warning)", margin: 0, fontWeight: 500 }}>⚠ Articles en dessous du prix minimum.</p>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Sous-total</span>
            <span style={{ fontSize: 16, fontWeight: 700, color: "var(--text)" }}>{formatMAD(subtotal)}</span>
          </div>
          <Button fullWidth onClick={handleCheckout} disabled={!cart.length} loading={loading}>Encaisser</Button>
        </div>
      </div>
      )}

      {/* ── Modals ── */}
      <BelowMinModal
        isOpen={showBelowMin}
        items={pendingItems}
        onAuthorized={adminId => {
          const next = { ...authorized }
          cart.filter(c => c.unitPrice < c.minSellingPrice).forEach(c => { next[c.costumeItemId] = adminId })
          setAuthorized(next); setShowBelowMin(false); setShowPayment(true)
        }}
        onCancel={() => setShowBelowMin(false)}
      />

      <Modal isOpen={showPayment} onClose={() => setShowPayment(false)} title="Paiement" size="sm">
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ background: "var(--surface-2)", borderRadius: 10, padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Total</span>
            <span style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.02em" }}>{formatMAD(subtotal)}</span>
          </div>
          <div>
            <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>Mode de paiement</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              {PAYMENT_METHODS.map(m => (
                <button key={m.value} onClick={() => setPayMethod(m.value)} style={{
                  padding: "10px 8px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer",
                  border: `2px solid ${payMethod === m.value ? "var(--primary)" : "var(--border)"}`,
                  background: payMethod === m.value ? "color-mix(in srgb,var(--primary) 10%,transparent)" : "var(--surface)",
                  color: "var(--text)",
                }}>{m.label}</button>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Button variant="secondary" fullWidth onClick={() => setShowPayment(false)}>Annuler</Button>
            <Button fullWidth onClick={handleConfirm} loading={loading}>Confirmer</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      padding: "5px 14px", borderRadius: 999, fontSize: 12, fontWeight: active ? 600 : 500,
      cursor: "pointer", whiteSpace: "nowrap",
      border: `1px solid ${active ? "var(--primary)" : "var(--border)"}`,
      background: active ? "color-mix(in srgb,var(--primary) 12%,transparent)" : "transparent",
      color: active ? "var(--primary)" : "var(--text-muted)", transition: "all 0.15s",
    }}>{label}</button>
  )
}