"use client"

import { useState } from "react"
import { useTranslations, useLocale } from "next-intl"
import { Modal }                from "@/components/ui/Modal"
import { Input }                from "@/components/ui/Input"
import { Select }               from "@/components/ui/Select"
import { Button }               from "@/components/ui/Button"
import { toast }                from "@/hooks/useToast"
import { createProduct, updateProduct } from "@/lib/actions/magazin/inventory"
import { ImageUploader }        from "./ImageUploader"
import { VariantManager }       from "./VariantManager"
import type { ProductForInventory, VariantInput } from "@/lib/actions/magazin/inventory"

type LookupItem    = { id: string; label_fr: string; label_ar: string }
type LookupMapItem = { label_fr: string; label_ar: string }

interface ProductFormModalProps {
  isOpen:     boolean
  mode:       "create" | "edit"
  product:    ProductForInventory | null
  categories: LookupItem[]
  sizes:      LookupItem[]
  colors:     LookupItem[]
  lookupById: Record<string, LookupMapItem>
  onClose:    () => void
  onSuccess:  () => void
}

export function ProductFormModal({ isOpen, mode, product, categories, sizes, colors, onClose, onSuccess }: ProductFormModalProps) {
  const isEdit = mode === "edit"
  const tInv   = useTranslations("magazin.inventory")
  const tCom   = useTranslations("common")
  const locale = useLocale()

  const [nameFr,   setNameFr]   = useState(product?.name_fr ?? "")
  const [nameAr,   setNameAr]   = useState(product?.name_ar ?? "")
  const [catId,    setCatId]    = useState(product?.categoryId ?? "")
  const [buying,   setBuying]   = useState(product?.buyingPrice ?? "")
  const [selling,  setSelling]  = useState(product?.sellingPrice ?? "")
  const [minSell,  setMinSell]  = useState(product?.minSellingPrice ?? "")
  const [images,   setImages]   = useState<string[]>(product?.images ?? [])
  const [variants, setVariants] = useState<VariantInput[]>(
    product?.variants.map(v => ({ id: v.id, sizeId: v.sizeId, colorId: v.colorId, stock: v.stock })) ?? []
  )
  const [loading,  setLoading]  = useState(false)
  const [errors,   setErrors]   = useState<Record<string, string>>({})

  const validate = () => {
    const e: Record<string, string> = {}
    if (!nameFr.trim())             e.nameFr   = tCom("required")
    if (!catId)                     e.catId    = tCom("required")
    if (isNaN(parseFloat(selling))) e.selling  = tInv("invalidAmount")
    if (isNaN(parseFloat(buying)))  e.buying   = tInv("invalidAmount")
    if (isNaN(parseFloat(minSell))) e.minSell  = tInv("invalidAmount")
    if (variants.length === 0)      e.variants = tInv("variantsRequired")
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSave = async () => {
    if (!validate()) return
    setLoading(true)
    try {
      const data = {
        name_fr:         nameFr.trim(),
        name_ar:         nameAr.trim(),
        categoryId:      catId,
        buyingPrice:     parseFloat(buying),
        sellingPrice:    parseFloat(selling),
        minSellingPrice: parseFloat(minSell),
        images,
        variants,
      }
      if (isEdit && product) {
        await updateProduct(product.id, data)
        toast(tInv("productUpdated"), "success")
      } else {
        await createProduct(data)
        toast(tInv("productCreated"), "success")
      }
      onSuccess()
    } catch (e) {
      toast(e instanceof Error ? e.message : tCom("error"), "error")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? tInv("editProduct") : tInv("newProduct")} size="lg">
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

        {/* Names */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Input label={tInv("productNameFr")} value={nameFr} onChange={e => setNameFr(e.target.value)} error={errors.nameFr} placeholder="ex: Costume Bleu" />
          <Input label={tInv("productNameAr")} value={nameAr} onChange={e => setNameAr(e.target.value)} placeholder="مثال: بدلة زرقاء" />
        </div>

        {/* Category */}
        <Select
          label={tInv("categoryRequired")}
          value={catId}
          onChange={e => setCatId(e.target.value)}
          error={errors.catId}
          placeholder={tInv("chooseCategory")}
          options={categories.map(c => ({ value: c.id, label: locale === "ar" ? c.label_ar : c.label_fr }))}
        />

        {/* Prices */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <Input label={tInv("buyingRequired")}  type="number" min="0" step="0.01" value={buying}  onChange={e => setBuying(e.target.value)}  error={errors.buying}  placeholder="0.00" />
          <Input label={tInv("sellingRequired")} type="number" min="0" step="0.01" value={selling} onChange={e => setSelling(e.target.value)} error={errors.selling} placeholder="0.00" />
          <Input label={tInv("minRequired")}     type="number" min="0" step="0.01" value={minSell} onChange={e => setMinSell(e.target.value)} error={errors.minSell} placeholder="0.00" />
        </div>

        {/* Images */}
        <ImageUploader images={images} onChange={setImages} />

        {/* Variants */}
        <div>
          <p style={{ fontSize: 12, fontWeight: 600, color: errors.variants ? "var(--danger)" : "var(--text-muted)", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            {tInv("variantsSectionLabel")}
          </p>
          {errors.variants && <p style={{ fontSize: 11, color: "var(--danger)", margin: "0 0 8px" }}>{errors.variants}</p>}
          <VariantManager variants={variants} onChange={setVariants} sizes={sizes} colors={colors} />
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <Button variant="ghost" onClick={onClose} disabled={loading}>{tCom("cancel")}</Button>
          <Button onClick={handleSave} loading={loading}>{isEdit ? tCom("save") : tCom("confirm")}</Button>
        </div>
      </div>
    </Modal>
  )
}
