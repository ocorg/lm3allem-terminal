"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useCaisse } from "@/components/caisse/CaisseProvider"
import { BelowMinModal, type BelowMinItem } from "@/components/caisse/BelowMinModal"
import { ProductGrid } from "./ProductGrid"
import { CartPanel } from "./CartPanel"
import { VariantPickerModal } from "./VariantPickerModal"
import { PaymentModal } from "./PaymentModal"
import { toast } from "@/hooks/useToast"
import { createSale } from "@/lib/actions/magazin/pos"
import type { ProductForPOS, SaleItemInput } from "@/lib/actions/magazin/pos"

type LookupItem    = { id: string; label_fr: string; label_ar: string }
type LookupMapItem = { label_fr: string; label_ar: string }

export interface CartItem {
  variantId:      string
  productId:      string
  name_fr:        string
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

export function POSClient({ products, categories, lookupById, locale, role }: POSClientProps) {
  const { session } = useCaisse()
  const router      = useRouter()

  const [cart,          setCart]          = useState<CartItem[]>([])
  const [pickerProduct, setPickerProduct] = useState<ProductForPOS | null>(null)
  const [showPayment,   setShowPayment]   = useState(false)
  const [showBelowMin,  setShowBelowMin]  = useState(false)
  const [pendingItems,  setPendingItems]  = useState<BelowMinItem[]>([])
  const [authorized,    setAuthorized]    = useState<Record<string, string>>({})
  const [saleLoading,   setSaleLoading]   = useState(false)

  const getVariantLabel = (v: { sizeId: string | null; colorId: string | null }) => {
    const parts: string[] = []
    if (v.sizeId  && lookupById[v.sizeId])  parts.push(lookupById[v.sizeId].label_fr)
    if (v.colorId && lookupById[v.colorId]) parts.push(lookupById[v.colorId].label_fr)
    return parts.join(" — ") || "Standard"
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
    const belowMin = cart.filter(i => i.unitPrice < i.minSellingPrice && !authorized[i.variantId])
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

  const handleBelowMinAuthorized = (adminId: string) => {
    const next = { ...authorized }
    cart.filter(i => i.unitPrice < i.minSellingPrice).forEach(i => { next[i.variantId] = adminId })
    setAuthorized(next)
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
        variantId:      i.variantId,
        quantity:       i.quantity,
        unitPrice:      i.unitPrice,
        wasBelowMin:    i.unitPrice < i.minSellingPrice,
        authorizedById: authorized[i.variantId],
      }))

      await createSale({
        caisseSessionId: session.id,
        items,
        paymentMethod:   paymentMethod as any,
        totalAmount,
        amountPaid,
        isCredit,
        clientName,
        clientPhone,
      })

      toast("Vente enregistrée", "success")
      setCart([])
      setAuthorized({})
      setShowPayment(false)
      router.refresh()
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erreur lors de la vente", "error")
    } finally {
      setSaleLoading(false)
    }
  }

  const isRTL = locale === "ar"

  return (
    <div
      style={{
        display:       "flex",
        flexDirection: isRTL ? "row-reverse" : "row",
        height:        "calc(100vh - 64px)",
        overflow:      "hidden",
      }}
    >
      {/* Left: Products */}
      <div
        style={{
          flex:           1,
          display:        "flex",
          flexDirection:  "column",
          overflow:       "hidden",
          borderInlineEnd: "1px solid var(--border)",
        }}
      >
        <ProductGrid
          products={products}
          categories={categories}
          locale={locale}
          onProductClick={handleProductClick}
        />
      </div>

      {/* Right: Cart */}
      <div style={{ width: 360, flexShrink: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <CartPanel
          items={cart}
          locale={locale}
          onUpdateItem={updateCartItem}
          onRemoveItem={removeCartItem}
          onCheckout={handleCheckout}
          loading={saleLoading}
        />
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
    </div>
  )
}