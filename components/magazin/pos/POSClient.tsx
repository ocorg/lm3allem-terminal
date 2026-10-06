"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useCaisse } from "@/components/caisse/CaisseProvider"
import { BelowMinModal, type BelowMinItem } from "@/components/caisse/BelowMinModal"
import { ProductGrid } from "./ProductGrid"
import { CartPanel } from "./CartPanel"
import { VariantPickerModal } from "./VariantPickerModal"
import { PaymentModal } from "./PaymentModal"
import { toast } from "@/hooks/useToast"
import { createSale } from "@/lib/actions/magazin/pos"
import { newRequestId } from "@/lib/utils/request-id"
import { isNetworkError } from "@/lib/client/online"
import { enqueueSale } from "@/lib/offline/queue"
import { useReservedStock } from "@/hooks/useOfflineQueue"
import type { ProductForPOS, SaleItemInput } from "@/lib/actions/magazin/pos"
import type { PaymentMethod } from "@prisma/client"
import React from "react"
import { useBreakpoint } from "@/hooks/useBreakpoint"

type LookupItem    = { id: string; label_fr: string; label_ar: string }
type LookupMapItem = { label_fr: string; label_ar: string }

export interface CartItem {
  variantId:      string
  productId:      string
  name_fr:        string
  name_ar:        string
  variantLabel:   string
  stock:          number
  sellingPrice:   number
  minSellingPrice: number
  unitPrice:      number
  quantity:       number
}

interface POSClientProps {
  products:   ProductForPOS[]
  categories: LookupItem[]
  lookupById: Record<string, LookupMapItem>
  locale:     string
  role:       string
}

export function POSClient({ products: serverProducts, categories, lookupById, locale }: POSClientProps) {
  const { session } = useCaisse()
  const router      = useRouter()
  const tPos        = useTranslations("magazin.pos")
  const tP          = useTranslations("payment")

  // Stock promised to sales saved on this device but not yet sent: the till never sells it twice
  const reserved = useReservedStock("magazin")
  const products = useMemo(
    () => serverProducts.map((p) => ({
      ...p,
      variants: p.variants.map((v) => ({ ...v, stock: Math.max(0, v.stock - (reserved[v.id] ?? 0)) })),
    })),
    [serverProducts, reserved]
  )

  const [cart,          setCart]          = useState<CartItem[]>([])
  const [pickerProduct, setPickerProduct] = useState<ProductForPOS | null>(null)
  const [showPayment,   setShowPayment]   = useState(false)
  const [showBelowMin,  setShowBelowMin]  = useState(false)
  const [pendingItems,  setPendingItems]  = useState<BelowMinItem[]>([])
  // Signed manager-override token (verified by the SERVER when the sale is saved)
  const [overrideToken, setOverrideToken] = useState<string | null>(null)
  const [saleLoading,   setSaleLoading]   = useState(false)
  // One idempotency key per sale attempt: a retry after a network error cannot create a duplicate
  const [requestId,     setRequestId]     = useState(() => newRequestId())

  const getVariantLabel = (v: { sizeId: string | null; colorId: string | null }) => {
    const parts: string[] = []
    if (v.sizeId  && lookupById[v.sizeId])  parts.push(lookupById[v.sizeId].label_ar)
    if (v.colorId && lookupById[v.colorId]) parts.push(lookupById[v.colorId].label_ar)
    return parts.join(" - ") || "Standard"
  }

  const addVariantToCart = (product: ProductForPOS, variantId: string) => {
    const variant = product.variants.find(v => v.id === variantId)
    if (!variant || variant.stock === 0) return
    setCart(prev => {
      const existing = prev.find(i => i.variantId === variantId)
      if (existing) {
        if (existing.quantity >= variant.stock) return prev
        return prev.map(i => i.variantId === variantId ? { ...i, quantity: i.quantity + 1 } : i)
      }
      return [...prev, {
        variantId,
        productId:       product.id,
        name_fr:         product.name_fr,
        name_ar:         product.name_ar,
        variantLabel:    getVariantLabel(variant),
        stock:           variant.stock,
        sellingPrice:    parseFloat(product.sellingPrice),
        minSellingPrice: parseFloat(product.minSellingPrice),
        unitPrice:       parseFloat(product.sellingPrice),
        quantity:        1,
      }]
    })
  }

  const handleProductClick = (product: ProductForPOS) => {
    const available = product.variants.filter(v => v.stock > 0)
    if (available.length === 0) return
    if (available.length === 1) {
      addVariantToCart(product, available[0].id)
    } else {
      setPickerProduct(product)
    }
  }

  const updateCartItem = (variantId: string, updates: Partial<CartItem>) =>
    setCart(prev => prev.map(i => i.variantId === variantId ? { ...i, ...updates } : i))

  const removeCartItem = (variantId: string) =>
    setCart(prev => prev.filter(i => i.variantId !== variantId))

  const handleCheckout = () => {
    if (cart.length === 0) return
    const belowMin = cart.filter(i => i.unitPrice < i.minSellingPrice && !overrideToken)
    if (belowMin.length > 0 && !navigator.onLine) {
      // the manager's authorisation is checked by the server, so it cannot be given offline
      toast("لا يمكن البيع بسعر أقل من الحد الأدنى بدون اتصال بالإنترنت، لأن تفويض المسؤول يتطلب الاتصال بالخادم", "error", 8000)
      return
    }
    if (belowMin.length > 0) {
      setPendingItems(belowMin.map(i => ({
        name:           `${i.name_fr} (${i.variantLabel})`,
        requestedPrice: i.unitPrice,
        minPrice:       i.minSellingPrice,
      })))
      setShowBelowMin(true)
    } else {
      setShowPayment(true)
    }
  }

  const handleBelowMinAuthorized = (token: string) => {
    setOverrideToken(token)
    setShowBelowMin(false)
    setShowPayment(true)
  }

  const handleSaleComplete = async (
    paymentMethod: string,
    amountPaid:    number,
    isCredit:      boolean,
    clientName?:   string,
    clientPhone?:  string,
  ) => {
    setSaleLoading(true)
    try {
      const totalAmount = cart.reduce((s, i) => s + i.unitPrice * i.quantity, 0)
      const items: SaleItemInput[] = cart.map(i => ({
        variantId: i.variantId,
        quantity:  i.quantity,
        unitPrice: i.unitPrice,
      }))

      const saleInput = {
        requestId,
        caisseSessionId: session.id,
        items,
        paymentMethod:   paymentMethod as PaymentMethod,
        totalAmount:     Math.round(totalAmount * 100) / 100,
        amountPaid,
        clientName,
        clientPhone,
        overrideToken:   overrideToken ?? undefined,
      }

      // No connection (or it dropped mid-way): keep the sale on this device. It keeps the SAME request id,
      // so even if the server did receive it, sending it again later can never duplicate it.
      const saveOffline = async () => {
        await enqueueSale({
          requestId,
          kind:        "magazin",
          payload:     saleInput as unknown as Record<string, unknown>,
          totalAmount: saleInput.totalAmount,
          itemCount:   items.length,
          quantities:  Object.fromEntries(items.map((i) => [i.variantId, i.quantity])),
        })
        toast("لا يوجد اتصال: حُفظ البيع على هذا الجهاز وسيُرسل تلقائيا عند عودة الإنترنت", "info", 8000)
        setCart([]); setOverrideToken(null); setRequestId(newRequestId()); setShowPayment(false)
      }

      if (!navigator.onLine) { await saveOffline(); return }

      let res
      try {
        res = await createSale(saleInput)
      } catch (err) {
        if (isNetworkError(err)) { await saveOffline(); return }
        throw err
      }

      if (!res.ok) {
        toast(res.message || tP("saleError"), "error")
        // an expired / invalid authorisation must be requested again
        if (res.code === "below_min_not_authorized") setOverrideToken(null)
        return
      }

      toast(tP("saleSuccess"), "success")
      setCart([])
      setOverrideToken(null)
      setRequestId(newRequestId())
      setShowPayment(false)
      router.refresh()
    } finally {
      setSaleLoading(false)
    }
  }

  const isRTL = locale === "ar"

  const { isMobile } = useBreakpoint()
  const [mobileTab, setMobileTab] = useState<"products" | "cart">("products")
  const totalQty = cart.reduce((s, i) => s + i.quantity, 0)


  return (
    <>
      <h1 className="sr-only">نقطة البيع</h1>
      <div
        style={{
          display:       "flex",
          flexDirection: isMobile ? "column" : (isRTL ? "row-reverse" : "row"),
          height:        "calc(100vh - 64px)",
          overflow:      "hidden",
        }}
      >
        {/* Mobile: tab switcher */}
        {isMobile && (
          <div style={{ display: "flex", flexShrink: 0, background: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
            {(["products", "cart"] as const).map(tab => {
              const active = mobileTab === tab
              const label  = tab === "products"
                ? tPos("products")
                : `${tPos("cartTitle")}${totalQty > 0 ? ` (${totalQty})` : ""}`
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

        {/* Products panel */}
        {(!isMobile || mobileTab === "products") && (
          <div
            style={{
              flex:            1,
              display:         "flex",
              flexDirection:   "column",
              overflow:        "hidden",
              
            }}
          >
            <ProductGrid
              products={products}
              categories={categories}
              locale={locale}
              onProductClick={handleProductClick}
            />
          </div>
        )}

        {/* Cart panel */}
        {(!isMobile || mobileTab === "cart") && (
          <div style={{ width: isMobile ? "100%" : 360, flexShrink: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <CartPanel
              items={cart}
              locale={locale}
              onUpdateItem={updateCartItem}
              onRemoveItem={removeCartItem}
              onCheckout={handleCheckout}
              loading={saleLoading}
            />
          </div>
        )}
      </div>

      {/* Variant picker */}
      {pickerProduct && (
        <VariantPickerModal
          isOpen={true}
          product={pickerProduct}
          lookupById={lookupById}
          locale={locale}
          onClose={() => setPickerProduct(null)}
          onSelect={(variantId) => {
            addVariantToCart(pickerProduct, variantId)
            setPickerProduct(null)
          }}
        />
      )}

      <BelowMinModal
        isOpen={showBelowMin}
        items={pendingItems}
        onAuthorized={handleBelowMinAuthorized}
        onCancel={() => setShowBelowMin(false)}
      />

      {showPayment && (
        <PaymentModal
          isOpen={showPayment}
          cart={cart}
          locale={locale}
          loading={saleLoading}
          onClose={() => setShowPayment(false)}
          onConfirm={handleSaleComplete}
        />
      )}
    </>
  )
}