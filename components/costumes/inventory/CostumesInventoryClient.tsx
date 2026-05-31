"use client"

import { useState, useEffect }  from "react"
import { useRouter }            from "next/navigation"
import { useTranslations }      from "next-intl"
import { PencilLine, Plus }     from "lucide-react"
import { DataTable, type Column } from "@/components/ui/DataTable"
import { Badge }                from "@/components/ui/Badge"
import { Button }               from "@/components/ui/Button"
import { Modal }                from "@/components/ui/Modal"
import { Input }                from "@/components/ui/Input"
import { Select }               from "@/components/ui/Select"
import { toast }                from "@/hooks/useToast"
import { formatMAD }            from "@/lib/utils/currency"
import { ImageUploader }        from "@/components/magazin/inventory/ImageUploader"
import { createCostumeItem, updateCostumeItem } from "@/lib/actions/costumes/inventory"
import type { CostumeItemForInventory, CostumeItemInput } from "@/lib/actions/costumes/inventory"
import type { LookupItem, LookupById } from "@/lib/actions/costumes/pos"
import type { CostumeItemType } from "@prisma/client"

interface Props {
  items:      CostumeItemForInventory[]
  sizes:      LookupItem[]
  colors:     LookupItem[]
  lookupById: LookupById
  role:       string
  locale:     string
}

export function CostumesInventoryClient({ items, sizes, colors, lookupById, role }: Props) {
  const router   = useRouter()
  const tInv     = useTranslations("costumes.inventory")
  const tType    = useTranslations("costumes.itemType")
  const tCom     = useTranslations("common")
  const tUi      = useTranslations("ui")
  const isAdmin  = role === "admin" || role === "superadmin"
  const [editing,  setEditing]  = useState<CostumeItemForInventory | null>(null)
  const [creating, setCreating] = useState(false)

  const typeLabel = (t: CostumeItemType) =>
    tType(t as Parameters<typeof tType>[0])

  const columns: Column<CostumeItemForInventory>[] = [
    {
      key: "images", label: tInv("colPhoto"), width: 56,
      render: (_, row) => row.images[0]
        ? <img src={row.images[0]} alt="" style={{ width: 40, height: 40, borderRadius: 6, objectFit: "cover" }} />
        : <div style={{ width: 40, height: 40, borderRadius: 6, background: "var(--surface-2)" }} />,
    },
    {
      key: "name_fr", label: tInv("colArticle"), sortable: true,
      render: (_, row) => (
        <div>
          <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", margin: 0 }}>{row.name_fr}</p>
          <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "2px 0 0" }}>{row.name_ar}</p>
        </div>
      ),
    },
    {
      key: "type", label: tInv("type"),
      render: (_, row) => <Badge variant="default">{typeLabel(row.type)}</Badge>,
    },
    {
      key: "sizeId", label: tInv("size"),
      render: (_, row) => row.sizeId && lookupById[row.sizeId]
        ? <span style={{ fontSize: 13 }}>{lookupById[row.sizeId].label_fr}</span>
        : <span style={{ color: "var(--text-muted)", fontSize: 13 }}>—</span>,
    },
    {
      key: "colorId", label: tInv("color"),
      render: (_, row) => row.colorId && lookupById[row.colorId]
        ? <span style={{ fontSize: 13 }}>{lookupById[row.colorId].label_fr}</span>
        : <span style={{ color: "var(--text-muted)", fontSize: 13 }}>—</span>,
    },
    {
      key: "stock", label: tInv("stock"), sortable: true,
      render: (_, row) => (
        <span style={{ fontWeight: 600, color: row.stock <= 2 ? "var(--warning)" : "var(--text)" }}>
          {row.stock}
        </span>
      ),
    },
    { key: "sellingPrice",    label: tInv("colSellingPrice"), render: (_, row) => formatMAD(row.sellingPrice) },
    { key: "minSellingPrice", label: tInv("colMinPrice"),     render: (_, row) => formatMAD(row.minSellingPrice) },
    {
      key: "isActive", label: tCom("status"),
      render: (_, row) => (
        <Badge variant={row.isActive ? "success" : "default"}>
          {row.isActive ? tCom("active") : tCom("inactive")}
        </Badge>
      ),
    },
    ...(isAdmin ? [{
      key: "id" as const, label: "", width: 40,
      render: (_: unknown, row: CostumeItemForInventory) => (
        <button
          onClick={() => setEditing(row)}
          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4 }}
        >
          <PencilLine size={15} />
        </button>
      ),
    }] : []),
  ]

  return (
    <div style={{ padding: 8 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.02em", margin: 0 }}>
          {tInv("title")}
        </h1>
        {isAdmin && (
          <Button size="sm" icon={<Plus size={14} />} onClick={() => setCreating(true)}>
            {tInv("addItem")}
          </Button>
        )}
      </div>

      <DataTable
        columns={columns}
        data={items}
        searchable
        searchKeys={["name_fr", "name_ar"]}
        emptyMessage={tUi("noResults")}
      />

      <CostumeItemFormModal
        isOpen={creating || !!editing}
        mode={editing ? "edit" : "create"}
        item={editing}
        sizes={sizes}
        colors={colors}
        onClose={() => { setCreating(false); setEditing(null) }}
        onSuccess={() => { setCreating(false); setEditing(null); router.refresh() }}
      />
    </div>
  )
}

interface FormModalProps {
  isOpen:    boolean
  mode:      "create" | "edit"
  item:      CostumeItemForInventory | null
  sizes:     LookupItem[]
  colors:    LookupItem[]
  onClose:   () => void
  onSuccess: () => void
}

function CostumeItemFormModal({ isOpen, mode, item, sizes, colors, onClose, onSuccess }: FormModalProps) {
  const isEdit = mode === "edit"
  const tInv   = useTranslations("costumes.inventory")
  const tType  = useTranslations("costumes.itemType")
  const tCom   = useTranslations("common")
  const tRent  = useTranslations("costumes.rental")

  const TYPE_OPTIONS = (["suit", "vest", "shoes", "accessory"] as CostumeItemType[]).map(v => ({
    value: v,
    label: tType(v as Parameters<typeof tType>[0]),
  }))

  const [nameFr,   setNameFr]   = useState("")
  const [nameAr,   setNameAr]   = useState("")
  const [type,     setType]     = useState<CostumeItemType>("suit")
  const [sizeId,   setSizeId]   = useState("")
  const [colorId,  setColorId]  = useState("")
  const [stock,    setStock]    = useState("")
  const [buying,   setBuying]   = useState("")
  const [selling,  setSelling]  = useState("")
  const [minSell,  setMinSell]  = useState("")
  const [images,   setImages]   = useState<string[]>([])
  const [loading,  setLoading]  = useState(false)
  const [errors,   setErrors]   = useState<Record<string, string>>({})

  useEffect(() => {
    if (!isOpen) return
    if (isEdit && item) {
      setNameFr(item.name_fr); setNameAr(item.name_ar); setType(item.type)
      setSizeId(item.sizeId ?? ""); setColorId(item.colorId ?? "")
      setStock(String(item.stock)); setBuying(item.buyingPrice)
      setSelling(item.sellingPrice); setMinSell(item.minSellingPrice)
      setImages(item.images)
    } else {
      setNameFr(""); setNameAr(""); setType("suit"); setSizeId(""); setColorId("")
      setStock(""); setBuying(""); setSelling(""); setMinSell(""); setImages([])
    }
    setErrors({})
  }, [isOpen]) // eslint-disable-line react-hooks/exhaustive-deps

  const validate = () => {
    const e: Record<string, string> = {}
    const inv = tRent("validation.invalidAmount")
    if (!nameFr.trim())          e.nameFr  = tCom("required")
    if (!nameAr.trim())          e.nameAr  = tCom("required")
    if (isNaN(+stock) || +stock < 0) e.stock   = inv
    if (isNaN(+buying))          e.buying  = inv
    if (isNaN(+selling))         e.selling = inv
    if (isNaN(+minSell))         e.minSell = inv
    return e
  }

  const handleSave = async () => {
    const e = validate()
    setErrors(e)
    if (Object.keys(e).length) return

    setLoading(true)
    const input: CostumeItemInput = {
      name_fr: nameFr, name_ar: nameAr, type,
      sizeId:  sizeId  || null,
      colorId: colorId || null,
      stock:   parseInt(stock),
      buyingPrice:     parseFloat(buying),
      sellingPrice:    parseFloat(selling),
      minSellingPrice: parseFloat(minSell),
      images,
    }

    try {
      if (isEdit && item) await updateCostumeItem(item.id, input)
      else                await createCostumeItem(input)
      toast(isEdit ? tInv("updateSuccess") : tInv("createSuccess"), "success")
      onSuccess()
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : tCom("error"), "error")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? tInv("editItem") : tInv("addItem")} size="lg">
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Input label="Nom (FR)" value={nameFr} onChange={e => setNameFr(e.target.value)} error={errors.nameFr} />
          <Input label="Nom (AR)" value={nameAr} onChange={e => setNameAr(e.target.value)} dir="rtl" error={errors.nameAr} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <Select
            label={tInv("type")} value={type}
            onChange={e => setType(e.target.value as CostumeItemType)}
            options={TYPE_OPTIONS}
          />
          <Select
            label={tInv("size")} value={sizeId}
            onChange={e => setSizeId(e.target.value)}
            placeholder="— Aucune —"
            options={sizes.map(s => ({ value: s.id, label: s.label_fr }))}
          />
          <Select
            label={tInv("color")} value={colorId}
            onChange={e => setColorId(e.target.value)}
            placeholder="— Aucune —"
            options={colors.map(c => ({ value: c.id, label: c.label_fr }))}
          />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12 }}>
          <Input label={tInv("stock")}          type="number" value={stock}   onChange={e => setStock(e.target.value)}   error={errors.stock}   />
          <Input label={tInv("buyingPrice")}    type="number" value={buying}  onChange={e => setBuying(e.target.value)}  error={errors.buying}  />
          <Input label={tInv("sellingPrice")}   type="number" value={selling} onChange={e => setSelling(e.target.value)} error={errors.selling} />
          <Input label={tInv("minSellingPrice")} type="number" value={minSell} onChange={e => setMinSell(e.target.value)} error={errors.minSell} />
        </div>
        <div>
          <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 8 }}>
            {tInv("images")}
          </p>
          <ImageUploader images={images} onChange={setImages} />
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", paddingTop: 4 }}>
          <Button variant="secondary" onClick={onClose}>{tCom("cancel")}</Button>
          <Button onClick={handleSave} loading={loading}>{isEdit ? tCom("save") : tCom("confirm")}</Button>
        </div>
      </div>
    </Modal>
  )
}
