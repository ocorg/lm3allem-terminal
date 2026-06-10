"use client"

import { useState }  from "react"
import { useRouter }            from "next/navigation"
import { useTranslations }      from "next-intl"
import { PencilLine, Plus }     from "lucide-react"
import Image                    from "next/image"
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
import type { ItemSegment } from "@prisma/client"

interface Props {
  items:        CostumeItemForInventory[]
  segment:      "sale" | "rental"
  sizes:        LookupItem[]
  colors:       LookupItem[]
  costumeTypes: LookupItem[]
  lookupById:   LookupById
  role:         string
  locale:       string
}

export function CostumesInventoryClient({ items, segment, sizes, colors, costumeTypes, lookupById, role }: Props) {
  const router   = useRouter()
  const tInv     = useTranslations("costumes.inventory")
  const tCom     = useTranslations("common")
  const tUi      = useTranslations("ui")
  const isAdmin  = role === "admin" || role === "superadmin"
  const [editing,  setEditing]  = useState<CostumeItemForInventory | null>(null)
  const [creating, setCreating] = useState(false)


  const columns: Column<CostumeItemForInventory>[] = [
    {
      key: "images", label: tInv("colPhoto"), width: 56,
      render: (_, row) => row.images[0]
        ? <Image src={row.images[0]} alt="" width={40} height={40} style={{ borderRadius: 6, objectFit: "cover" }} />
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
      render: (_, row) => <Badge variant="default">{row.typeLabelFr}</Badge>,
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
    ...(segment === "sale" ? [
      { key: "sellingPrice"    as const, label: tInv("colSellingPrice"), render: (_: unknown, row: CostumeItemForInventory) => formatMAD(row.sellingPrice) },
      { key: "minSellingPrice" as const, label: tInv("colMinPrice"),     render: (_: unknown, row: CostumeItemForInventory) => formatMAD(row.minSellingPrice) },
    ] : [
      { key: "refGuidePrice"   as const, label: "Prix guide",            render: (_: unknown, row: CostumeItemForInventory) => row.refGuidePrice ? formatMAD(row.refGuidePrice) : <span style={{ color: "var(--text-muted)" }}>—</span> },
    ]),
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
        key={editing?.id ?? (creating ? "new" : "closed")}
        isOpen={creating || !!editing}
        mode={editing ? "edit" : "create"}
        item={editing}
        defaultSegment={segment}
        sizes={sizes}
        colors={colors}
        costumeTypes={costumeTypes}
        onClose={() => { setCreating(false); setEditing(null) }}
        onSuccess={() => { setCreating(false); setEditing(null); router.refresh() }}
      />
    </div>
  )
}

interface FormModalProps {
  isOpen:          boolean
  mode:            "create" | "edit"
  item:            CostumeItemForInventory | null
  defaultSegment:  "sale" | "rental"
  sizes:           LookupItem[]
  colors:          LookupItem[]
  costumeTypes:    LookupItem[]
  onClose:         () => void
  onSuccess:       () => void
}

function CostumeItemFormModal({ isOpen, mode, item, defaultSegment, sizes, colors, costumeTypes, onClose, onSuccess }: FormModalProps) {
  const isEdit = mode === "edit"
  const tInv   = useTranslations("costumes.inventory")
  const tCom   = useTranslations("common")
  const tRent  = useTranslations("costumes.rental")

  const TYPE_OPTIONS = costumeTypes.map(t => ({ value: t.id, label: t.label_fr }))

  const [nameFr,     setNameFr]     = useState(item?.name_fr          ?? "")
  const [nameAr,     setNameAr]     = useState(item?.name_ar          ?? "")
  const [typeId,     setTypeId]     = useState(item?.typeId            ?? costumeTypes[0]?.id ?? "")
  const [segment,    setSegment]    = useState<ItemSegment>(item?.segment ?? defaultSegment)
  const [sizeId,     setSizeId]     = useState(item?.sizeId            ?? "")
  const [colorId,    setColorId]    = useState(item?.colorId           ?? "")
  const [stock,      setStock]      = useState(item ? String(item.stock) : "")
  const [buying,     setBuying]     = useState(item?.buyingPrice       ?? "")
  const [selling,    setSelling]    = useState(item?.sellingPrice      ?? "")
  const [minSell,    setMinSell]    = useState(item?.minSellingPrice   ?? "")
  const [guidePrice, setGuidePrice] = useState(item?.refGuidePrice     ?? "")
  const [images,     setImages]     = useState<string[]>(item?.images  ?? [])
  const [loading,    setLoading]    = useState(false)
  const [errors,     setErrors]     = useState<Record<string, string>>({})

  const validate = () => {
    const e: Record<string, string> = {}
    const inv = tRent("validation.invalidAmount")
    if (!nameFr.trim())          e.nameFr  = tCom("required")
    if (!nameAr.trim())          e.nameAr  = tCom("required")
    if (isNaN(+stock) || +stock < 0) e.stock   = inv
    if (isNaN(+buying))                                          e.buying  = inv
    if (segment === "sale" && isNaN(+selling))                   e.selling = inv
    if (segment === "sale" && isNaN(+minSell))                   e.minSell = inv
    if (segment === "rental" && guidePrice && isNaN(+guidePrice)) e.guidePrice = inv
    return e
  }

  const handleSave = async () => {
    const e = validate()
    setErrors(e)
    if (Object.keys(e).length) return

    setLoading(true)
    const input: CostumeItemInput = {
      name_fr: nameFr, name_ar: nameAr, typeId, segment,
      sizeId:  sizeId  || null,
      colorId: colorId || null,
      stock:   parseInt(stock),
      buyingPrice:     parseFloat(buying) || 0,
      sellingPrice:    segment === "sale"   ? parseFloat(selling)   : 0,
      minSellingPrice: segment === "sale"   ? parseFloat(minSell)   : 0,
      refGuidePrice:   segment === "rental" ? (parseFloat(guidePrice) || null) : null,
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
            label={tInv("type")} value={typeId}
            onChange={e => setTypeId(e.target.value)}
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
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Select
            label="Segment"
            value={segment}
            onChange={e => setSegment(e.target.value as ItemSegment)}
            disabled={isEdit}
            options={[
              { value: "sale",   label: "Vente" },
              { value: "rental", label: "Location (flotte)" },
            ]}
          />
          <Input label={tInv("stock")} type="number" value={stock} onChange={e => setStock(e.target.value)} error={errors.stock} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <Input label={tInv("buyingPrice")} type="number" value={buying} onChange={e => setBuying(e.target.value)} error={errors.buying} />
          {segment === "sale" && (
            <>
              <Input label={tInv("sellingPrice")}    type="number" value={selling}    onChange={e => setSelling(e.target.value)}    error={errors.selling} />
              <Input label={tInv("minSellingPrice")} type="number" value={minSell}    onChange={e => setMinSell(e.target.value)}    error={errors.minSell} />
            </>
          )}
          {segment === "rental" && (
            <Input label="Prix guide (optionnel)" type="number" value={guidePrice} onChange={e => setGuidePrice(e.target.value)} error={errors.guidePrice} hint="Référence interne pour négociation — non affiché au client" />
          )}
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
