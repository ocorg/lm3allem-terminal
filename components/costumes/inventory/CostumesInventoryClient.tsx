"use client"

import { useState }          from "react"
import { useRouter }         from "next/navigation"
import { useTranslations }   from "next-intl"
import { PencilLine, Plus }  from "lucide-react"
import Image                 from "next/image"
import { DataTable, type Column } from "@/components/ui/DataTable"
import { Badge }             from "@/components/ui/Badge"
import { Button }            from "@/components/ui/Button"
import { Modal }             from "@/components/ui/Modal"
import { Input }             from "@/components/ui/Input"
import { CreatableSelect }   from "@/components/ui/CreatableSelect"
import { toast }             from "@/hooks/useToast"
import { ImageUploader }     from "@/components/magazin/inventory/ImageUploader"
import {
  createCostumeItem,
  updateCostumeItem,
} from "@/lib/actions/costumes/inventory"
import type {
  CostumeItemForInventory,
  CostumeItemInput,
} from "@/lib/actions/costumes/inventory"
import type { LookupItem, LookupById } from "@/lib/actions/costumes/pos"

// ── Props ──────────────────────────────────────────────────────

interface Props {
  items:        CostumeItemForInventory[]
  suitSizes:    LookupItem[]
  pantsSizes:   LookupItem[]
  shirtSizes:   LookupItem[]
  shoeSizes:    LookupItem[]
  costumeTypes: LookupItem[]
  lookupById:   LookupById
  role:         string
}

// ── Shoe guide illustration ────────────────────────────────────

function ShoeGuideIcon() {
  return (
    <svg
      viewBox="0 0 88 40"
      style={{ width: 52, height: 24, color: "var(--text-muted)", flexShrink: 0 }}
      fill="currentColor"
      aria-hidden="true"
    >
      {/* Heel block */}
      <rect x="2" y="20" width="10" height="13" rx="2.5" opacity="0.85" />
      {/* Sole */}
      <rect x="2" y="30" width="84" height="5" rx="2.5" opacity="0.35" />
      {/* Upper */}
      <path
        d="M12 29 L12 18 Q14 7 30 5 Q56 1 76 15 Q86 19 86 26 L86 30 Z"
        opacity="0.55"
      />
      {/* Measurement dashes below sole */}
      <line
        x1="2" y1="38" x2="86" y2="38"
        stroke="currentColor" strokeWidth="1.5" opacity="0.22"
        strokeDasharray="4 3"
      />
      {/* End ticks */}
      <line x1="2"  y1="35" x2="2"  y2="40" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
      <line x1="86" y1="35" x2="86" y2="40" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
    </svg>
  )
}

// ── Main list component ────────────────────────────────────────

export function CostumesInventoryClient({
  items,
  suitSizes:  initialSuitSizes,
  pantsSizes: initialPantsSizes,
  shirtSizes: initialShirtSizes,
  shoeSizes:  initialShoeSizes,
  costumeTypes,
  lookupById,
  role,
}: Props) {
  const router  = useRouter()
  const tInv    = useTranslations("inventory")
  const tCom    = useTranslations("common")
  const tUi     = useTranslations("ui")
  const isAdmin = role === "admin" || role === "superadmin"

  const [editing,  setEditing]  = useState<CostumeItemForInventory | null>(null)
  const [creating, setCreating] = useState(false)

  const columns: Column<CostumeItemForInventory>[] = [
    {
      key: "images", label: tInv("colPhoto"), width: 56,
      render: (_, row) => row.images[0]
        ? <Image src={row.images[0]} alt="" width={40} height={40}
            style={{ borderRadius: 6, objectFit: "cover" }} />
        : <div style={{ width: 40, height: 40, borderRadius: 6, background: "var(--surface-2)" }} />,
    },
    {
      key: "typeId", label: tInv("type"),
      render: (_, row) => <Badge variant="default">{row.typeLabelAr}</Badge>,
    },
    {
      key: "sizeId", label: "مقاس البدلة",
      render: (_, row) => row.sizeId && lookupById[row.sizeId]
        ? <span style={{ fontSize: 13 }}>{lookupById[row.sizeId].label_ar}</span>
        : <span style={{ color: "var(--text-muted)", fontSize: 13 }}>-</span>,
    },
    {
      key: "colorId", label: "مقاس السروال",
      render: (_, row) => row.colorId && lookupById[row.colorId]
        ? <span style={{ fontSize: 13 }}>{lookupById[row.colorId].label_ar}</span>
        : <span style={{ color: "var(--text-muted)", fontSize: 13 }}>-</span>,
    },
    {
      key: "shirtSizeId", label: "مقاس القميجة",
      render: (_, row) => row.shirtSizeId && lookupById[row.shirtSizeId]
        ? <span style={{ fontSize: 13 }}>{lookupById[row.shirtSizeId].label_ar}</span>
        : <span style={{ color: "var(--text-muted)", fontSize: 13 }}>-</span>,
    },
    {
      key: "shoeSizeId", label: "مقاس الصباط",
      render: (_, row) => row.shoeSizeId && lookupById[row.shoeSizeId]
        ? <span style={{ fontSize: 13 }}>{lookupById[row.shoeSizeId].label_ar}</span>
        : <span style={{ color: "var(--text-muted)", fontSize: 13 }}>-</span>,
    },
    {
      key: "stock", label: tInv("stock"), sortable: true,
      render: (_, row) => (
        <span style={{ fontWeight: 600, color: row.stock <= 2 ? "var(--warning)" : "var(--text)" }}>
          {row.stock}
        </span>
      ),
    },
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
        searchKeys={["typeLabelAr"]}
        emptyMessage={tUi("noResults")}
      />

      <CostumeItemFormModal
        key={editing?.id ?? (creating ? "new" : "closed")}
        isOpen={creating || !!editing}
        mode={editing ? "edit" : "create"}
        item={editing}
        initialSuitSizes={initialSuitSizes}
        initialPantsSizes={initialPantsSizes}
        initialShirtSizes={initialShirtSizes}
        initialShoeSizes={initialShoeSizes}
        costumeTypes={costumeTypes}
        onClose={() => { setCreating(false); setEditing(null) }}
        onSuccess={() => { setCreating(false); setEditing(null); router.refresh() }}
      />
    </div>
  )
}

// ── Add / Edit form modal ──────────────────────────────────────

interface FormModalProps {
  isOpen:            boolean
  mode:              "create" | "edit"
  item:              CostumeItemForInventory | null
  initialSuitSizes:  LookupItem[]
  initialPantsSizes: LookupItem[]
  initialShirtSizes: LookupItem[]
  initialShoeSizes:  LookupItem[]
  costumeTypes:      LookupItem[]
  onClose:           () => void
  onSuccess:         () => void
}

function CostumeItemFormModal({
  isOpen, mode, item,
  initialSuitSizes, initialPantsSizes, initialShirtSizes, initialShoeSizes,
  costumeTypes,
  onClose, onSuccess,
}: FormModalProps) {
  const isEdit = mode === "edit"
  const tInv   = useTranslations("inventory")
  const tCom   = useTranslations("common")

  const [typeId,      setTypeId]      = useState(item?.typeId      ?? costumeTypes[0]?.id ?? "")
  const [suitSizeId,  setSuitSizeId]  = useState(item?.sizeId      ?? "")
  const [pantsSizeId, setPantsSizeId] = useState(item?.colorId     ?? "")
  const [shirtSizeId, setShirtSizeId] = useState(item?.shirtSizeId ?? "")
  const [shoeSizeId,  setShoeSizeId]  = useState(item?.shoeSizeId  ?? "")
  const [stock,       setStock]       = useState(item ? String(item.stock) : "")
  const [images,      setImages]      = useState<string[]>(item?.images ?? [])
  const [loading,     setLoading]     = useState(false)
  const [errors,      setErrors]      = useState<Record<string, string>>({})

  const [localTypes, setLocalTypes] = useState<LookupItem[]>(costumeTypes)
  const [suitSizes,  setSuitSizes]  = useState(initialSuitSizes.map( s => ({ value: s.id, label: s.label_ar })))
  const [pantsSizes, setPantsSizes] = useState(initialPantsSizes.map(s => ({ value: s.id, label: s.label_ar })))
  const [shirtSizes, setShirtSizes] = useState(initialShirtSizes.map(s => ({ value: s.id, label: s.label_ar })))
  const [shoeSizes,  setShoeSizes]  = useState(initialShoeSizes.map( s => ({ value: s.id, label: s.label_ar })))

  const TYPE_OPTIONS = localTypes.map(t => ({ value: t.id, label: t.label_ar }))

  const validate = () => {
    const e: Record<string, string> = {}
    if (!typeId)                                e.typeId = tCom("required")
    if (!stock || isNaN(+stock) || +stock < 0)  e.stock  = tCom("required")
    return e
  }

  const handleSave = async () => {
    const e = validate()
    setErrors(e)
    if (Object.keys(e).length) return

    setLoading(true)
    const input: CostumeItemInput = {
      typeId,
      sizeId:      suitSizeId  || null,
      colorId:     pantsSizeId || null,
      shirtSizeId: shirtSizeId || null,
      shoeSizeId:  shoeSizeId  || null,
      stock:       parseInt(stock),
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
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? tInv("editItem") : tInv("addItem")}
      size="lg"
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

        {/* ── النوع ── */}
        <CreatableSelect
          label={tInv("type")}
          value={typeId}
          onChange={setTypeId}
          onCreated={opt => setLocalTypes(prev => [...prev, { id: opt.value, label_fr: opt.label, label_ar: opt.label }])}
          onDeleted={id  => setLocalTypes(prev => prev.filter(t => t.id !== id))}
          slug="costume_item_types"
          placeholder="اختر النوع"
          options={TYPE_OPTIONS}
          error={errors.typeId}
        />

        {/* ── مقاس البدلة + مقاس السروال ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <CreatableSelect
            label="مقاس البدلة"
            value={suitSizeId}
            onChange={setSuitSizeId}
            onCreated={opt => setSuitSizes(prev  => [...prev,  opt])}
            onDeleted={id  => setSuitSizes(prev  => prev.filter(s => s.value !== id))}
            slug="suit_sizes"
            placeholder="بدون"
            options={suitSizes}
          />
          <CreatableSelect
            label="مقاس السروال"
            value={pantsSizeId}
            onChange={setPantsSizeId}
            onCreated={opt => setPantsSizes(prev => [...prev,  opt])}
            onDeleted={id  => setPantsSizes(prev => prev.filter(s => s.value !== id))}
            slug="pants_sizes"
            placeholder="بدون"
            options={pantsSizes}
          />
        </div>

        {/* ── مقاس القميجة + مقاس الصباط ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <CreatableSelect
            label="مقاس القميجة"
            value={shirtSizeId}
            onChange={setShirtSizeId}
            onCreated={opt => setShirtSizes(prev => [...prev,  opt])}
            onDeleted={id  => setShirtSizes(prev => prev.filter(s => s.value !== id))}
            slug="shirt_sizes"
            placeholder="بدون"
            options={shirtSizes}
          />

          {/* Shoe size with visual guide */}
          <div>
            <CreatableSelect
              label="مقاس الصباط"
              value={shoeSizeId}
              onChange={setShoeSizeId}
              onCreated={opt => setShoeSizes(prev => [...prev,  opt])}
              onDeleted={id  => setShoeSizes(prev => prev.filter(s => s.value !== id))}
              slug="shoe_sizes"
              placeholder="بدون"
              options={shoeSizes}
            />
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginTop: 6,
              padding: "5px 10px",
              borderRadius: 6,
              background: "var(--surface-2)",
            }}>
              <ShoeGuideIcon />
              <span style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.4 }}>
                من الكعب للأصابع
              </span>
            </div>
          </div>
        </div>

        {/* ── المخزون ── */}
        <Input
          label={tInv("stock")}
          type="number"
          value={stock}
          onChange={e => setStock(e.target.value)}
          error={errors.stock}
        />

        {/* ── الصور ── */}
        <div>
          <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 8 }}>
            {tInv("images")}
          </p>
          <ImageUploader images={images} onChange={setImages} />
        </div>

        {/* ── Actions ── */}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", paddingTop: 4 }}>
          <Button variant="secondary" onClick={onClose}>{tCom("cancel")}</Button>
          <Button onClick={handleSave} loading={loading}>
            {isEdit ? tCom("save") : tCom("confirm")}
          </Button>
        </div>

      </div>
    </Modal>
  )
}