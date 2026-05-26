"use client"

import { useState, useEffect } from "react"
import { Modal }    from "@/components/ui/Modal"
import { Input }    from "@/components/ui/Input"
import { Select }   from "@/components/ui/Select"
import { Button }   from "@/components/ui/Button"
import { toast }    from "@/hooks/useToast"
import { createProduct, updateProduct } from "@/lib/actions/magazin/inventory"
import { ImageUploader } from "./ImageUploader"
import { VariantManager } from "./VariantManager"
import type { ProductForInventory, VariantInput } from "@/lib/actions/magazin/inventory"

type LookupItem = { id: string; label_fr: string; label_ar: string }

interface ProductFormModalProps {
  isOpen:     boolean
  mode:       "create" | "edit"
  product:    ProductForInventory | null
  categories: LookupItem[]
  sizes:      LookupItem[]
  colors:     LookupItem[]
  lookupById: Record<string, LookupItem>
  onClose:    () => void
  onSuccess:  () => void
}

export function ProductFormModal({ isOpen, mode, product, categories, sizes, colors, lookupById, onClose, onSuccess }: ProductFormModalProps) {
  const isEdit = mode === "edit"

  const [nameFr,   setNameFr]   = useState("")
  const [nameAr,   setNameAr]   = useState("")
  const [catId,    setCatId]    = useState("")
  const [buying,   setBuying]   = useState("")
  const [selling,  setSelling]  = useState("")
  const [minSell,  setMinSell]  = useState("")
  const [images,   setImages]   = useState<string[]>([])
  const [variants, setVariants] = useState<VariantInput[]>([])
  const [loading,  setLoading]  = useState(false)
  const [errors,   setErrors]   = useState<Record<string, string>>({})

  useEffect(() => {
    if (!isOpen) return
    if (isEdit && product) {
      setNameFr(product.name_fr)
      setNameAr(product.name_ar)
      setCatId(product.categoryId)
      setBuying(product.buyingPrice)
      setSelling(product.sellingPrice)
      setMinSell(product.minSellingPrice)
      setImages(product.images)
      setVariants(product.variants.map(v => ({ id: v.id, sizeId: v.sizeId, colorId: v.colorId, stock: v.stock })))
    } else {
      setNameFr(""); setNameAr(""); setCatId(""); setBuying(""); setSelling(""); setMinSell(""); setImages([]); setVariants([])
    }
    setErrors({})
  }, [isOpen])

  const validate = () => {
    const e: Record<string, string> = {}
    if (!nameFr.trim())                e.nameFr   = "Requis"
    if (!catId)                        e.catId    = "Requis"
    if (isNaN(parseFloat(selling)))    e.selling  = "Montant invalide"
    if (isNaN(parseFloat(buying)))     e.buying   = "Montant invalide"
    if (isNaN(parseFloat(minSell)))    e.minSell  = "Montant invalide"
    if (variants.length === 0)         e.variants = "Ajoutez au moins une variante"
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
        toast("Produit mis à jour", "success")
      } else {
        await createProduct(data)
        toast("Produit créé", "success")
      }
      onSuccess()
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erreur", "error")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? "Modifier le produit" : "Nouveau produit"} size="lg">
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

        {/* Names */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Input label="Nom (FR) *" value={nameFr} onChange={e => setNameFr(e.target.value)} error={errors.nameFr} placeholder="ex: Costume Bleu" />
          <Input label="Nom (AR)"   value={nameAr} onChange={e => setNameAr(e.target.value)} placeholder="مثال: بدلة زرقاء" />
        </div>

        {/* Category */}
        <Select
          label="Catégorie *"
          value={catId}
          onChange={e => setCatId(e.target.value)}
          error={errors.catId}
          placeholder="Choisir une catégorie"
          options={categories.map(c => ({ value: c.id, label: c.label_fr }))}
        />

        {/* Prices */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <Input label="Prix d'achat *"  type="number" min="0" step="0.01" value={buying}  onChange={e => setBuying(e.target.value)}  error={errors.buying}  placeholder="0.00" />
          <Input label="Prix de vente *" type="number" min="0" step="0.01" value={selling} onChange={e => setSelling(e.target.value)} error={errors.selling} placeholder="0.00" />
          <Input label="Prix minimum *"  type="number" min="0" step="0.01" value={minSell} onChange={e => setMinSell(e.target.value)} error={errors.minSell} placeholder="0.00" />
        </div>

        {/* Images */}
        <ImageUploader images={images} onChange={setImages} />

        {/* Variants */}
        <div>
          <p style={{ fontSize: 12, fontWeight: 600, color: errors.variants ? "var(--danger)" : "var(--text-muted)", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Variantes *
          </p>
          {errors.variants && <p style={{ fontSize: 11, color: "var(--danger)", margin: "0 0 8px" }}>{errors.variants}</p>}
          <VariantManager variants={variants} onChange={setVariants} sizes={sizes} colors={colors} />
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <Button variant="ghost" onClick={onClose} disabled={loading}>Annuler</Button>
          <Button onClick={handleSave} loading={loading}>{isEdit ? "Enregistrer" : "Créer le produit"}</Button>
        </div>
      </div>
    </Modal>
  )
}