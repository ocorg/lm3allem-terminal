"use client"

import { useMemo, useState }  from "react"
import { useRouter }          from "next/navigation"
import { useTranslations }    from "next-intl"
import { PencilLine, Plus, ToggleLeft, ToggleRight } from "lucide-react"
import Image                  from "next/image"
import { DataTable, type Column } from "@/components/ui/DataTable"
import { Badge }              from "@/components/ui/Badge"
import { Button }             from "@/components/ui/Button"
import { Modal }              from "@/components/ui/Modal"
import { Input }              from "@/components/ui/Input"
import { CreatableSelect }    from "@/components/ui/CreatableSelect"
import { toast }              from "@/hooks/useToast"
import { useConfirm }         from "@/hooks/useConfirm"
import { formatMAD }          from "@/lib/utils/currency"
import { parseAmount }        from "@/lib/utils/money"
import { ImageUploader }      from "@/components/magazin/inventory/ImageUploader"
import {
  createCostumeItem,
  updateCostumeItem,
  toggleCostumeItemActive,
} from "@/lib/actions/costumes/inventory"
import type {
  CostumeItemForInventory,
  CostumeItemInput,
  CostumeSegment,
} from "@/lib/actions/costumes/inventory"
import type { LookupItem, LookupById } from "@/lib/actions/costumes/pos"
import { IconButton, IconButtonGroup } from "@/components/ui/IconButton"

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

const SEGMENT_LABEL: Record<CostumeSegment, string> = {
  rental: "قطع الإيجار",
  sale:   "قطع للبيع",
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
      <rect x="2" y="20" width="10" height="13" rx="2.5" opacity="0.85" />
      <rect x="2" y="30" width="84" height="5" rx="2.5" opacity="0.35" />
      <path d="M12 29 L12 18 Q14 7 30 5 Q56 1 76 15 Q86 19 86 26 L86 30 Z" opacity="0.55" />
      <line x1="2" y1="38" x2="86" y2="38" stroke="currentColor" strokeWidth="1.5" opacity="0.22" strokeDasharray="4 3" />
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
  const isAdmin = role === "admin" || role === "ghost"
  const { confirm, modal } = useConfirm()

  const [segment,  setSegment]  = useState<CostumeSegment>("rental")
  const [editing,  setEditing]  = useState<CostumeItemForInventory | null>(null)
  const [creating, setCreating] = useState(false)

  const rows = useMemo(
    () => items.filter(i => i.segment === segment).map(i => ({ ...i, searchText: `${i.sku ?? ""} ${i.name_ar} ${i.typeLabelAr}` })),
    [items, segment]
  )

  const handleToggle = async (item: CostumeItemForInventory) => {
    const ok = await confirm({
      title:        item.isActive ? tInv("deactivate") : tInv("activate"),
      message:      item.isActive ? tInv("deactivateConfirm") : tInv("activateConfirm"),
      confirmLabel: item.isActive ? tInv("deactivate") : tInv("activate"),
      variant:      item.isActive ? "danger" : "primary",
    })
    if (!ok) return
    const res = await toggleCostumeItemActive(item.id)
    if (!res.ok) { toast(res.message || tCom("error"), "error"); return }
    toast(tInv("toggleSuccess"), "success")
    router.refresh()
  }

  const sizeCell = (id: string | null) =>
    id && lookupById[id]
      ? <span style={{ fontSize: 13 }}>{lookupById[id].label_ar}</span>
      : <span style={{ color: "var(--text-muted)", fontSize: 13 }}>-</span>

  const columns: Column<(typeof rows)[number]>[] = [
    {
      key: "images", label: tInv("colPhoto"), width: 56,
      render: (_, row) => row.images[0]
        ? <Image src={row.images[0]} alt="" width={40} height={40} style={{ borderRadius: 6, objectFit: "cover" }} />
        : <div style={{ width: 40, height: 40, borderRadius: 6, background: "var(--surface-2)" }} />,
    },
    {
      key: "sku", label: "الرمز", sortable: true,
      render: (_, row) => <span className="mono" style={{ fontSize: 12, fontWeight: 600 }}>{row.sku ?? "-"}</span>,
    },
    {
      key: "typeId", label: tInv("type"),
      render: (_, row) => (
        <div>
          <Badge variant="default">{row.typeLabelAr}</Badge>
          {segment === "sale" && <p style={{ fontSize: 12, margin: "4px 0 0", color: "var(--text)" }}>{row.name_ar}</p>}
        </div>
      ),
    },
    { key: "sizeId",      label: "مقاس البدلة",  render: (_, row) => sizeCell(row.sizeId) },
    { key: "colorId",     label: "مقاس السروال", render: (_, row) => sizeCell(row.colorId) },
    { key: "shirtSizeId", label: "مقاس القميص", render: (_, row) => sizeCell(row.shirtSizeId) },
    { key: "shoeSizeId",  label: "مقاس الحذاء",  render: (_, row) => sizeCell(row.shoeSizeId) },
    {
      key: "sellingPrice", label: segment === "sale" ? "سعر البيع" : "سعر الإيجار المرجعي",
      render: (_, row) => {
        const price = segment === "sale" ? row.sellingPrice : row.refGuidePrice
        return price && parseFloat(price) > 0
          ? <span style={{ fontSize: 13, fontWeight: 600 }}>{formatMAD(price)}</span>
          : <span style={{ color: "var(--text-muted)", fontSize: 13 }}>-</span>
      },
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
      key: "id" as const, label: "", width: 112,
      render: (_: unknown, row: CostumeItemForInventory) => (
        <IconButtonGroup>
          <IconButton label={tCom("edit")} onClick={() => setEditing(row)}>
            <PencilLine size={18} />
          </IconButton>
          <IconButton label={row.isActive ? tInv("deactivate") : tInv("activate")} tone={row.isActive ? "success" : "neutral"} onClick={() => handleToggle(row)}>
            {row.isActive ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
          </IconButton>
        </IconButtonGroup>
      ),
    }] : []),
  ]

  return (
    <div style={{ padding: 8 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, gap: 12, flexWrap: "wrap" }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)",margin: 0 }}>
          {tInv("title")}
        </h1>
        {isAdmin && (
          <Button size="sm" icon={<Plus size={14} />} onClick={() => setCreating(true)}>
            {tInv("addItem")}
          </Button>
        )}
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
        {(["rental", "sale"] as const).map(seg => (
          <button
            key={seg}
            onClick={() => setSegment(seg)}
            style={{
              padding: "8px 16px", minHeight: 36, borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: "pointer", border: "none",
              background: segment === seg ? "var(--brand)" : "var(--surface-2)",
              color:      segment === seg ? "var(--on-brand)"        : "var(--text-muted)",
            }}
          >
            {SEGMENT_LABEL[seg]} ({items.filter(i => i.segment === seg).length})
          </button>
        ))}
      </div>

      <DataTable
        columns={columns}
        data={rows}
        searchable
        searchKeys={["searchText"]}
        emptyMessage={tUi("noResults")}
      />

      {modal}

      <CostumeItemFormModal
        key={editing?.id ?? (creating ? `new-${segment}` : "closed")}
        isOpen={creating || !!editing}
        mode={editing ? "edit" : "create"}
        item={editing}
        segment={editing?.segment ?? segment}
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
  segment:           CostumeSegment
  initialSuitSizes:  LookupItem[]
  initialPantsSizes: LookupItem[]
  initialShirtSizes: LookupItem[]
  initialShoeSizes:  LookupItem[]
  costumeTypes:      LookupItem[]
  onClose:           () => void
  onSuccess:         () => void
}

function CostumeItemFormModal({
  isOpen, mode, item, segment,
  initialSuitSizes, initialPantsSizes, initialShirtSizes, initialShoeSizes,
  costumeTypes,
  onClose, onSuccess,
}: FormModalProps) {
  const isEdit = mode === "edit"
  const isSale = segment === "sale"
  const tInv   = useTranslations("inventory")
  const tCom   = useTranslations("common")

  const [typeId,      setTypeId]      = useState(item?.typeId      ?? costumeTypes[0]?.id ?? "")
  const [name,        setName]        = useState(item?.name_ar     ?? "")
  const [suitSizeId,  setSuitSizeId]  = useState(item?.sizeId      ?? "")
  const [pantsSizeId, setPantsSizeId] = useState(item?.colorId     ?? "")
  const [shirtSizeId, setShirtSizeId] = useState(item?.shirtSizeId ?? "")
  const [shoeSizeId,  setShoeSizeId]  = useState(item?.shoeSizeId  ?? "")
  const [stock,       setStock]       = useState(item ? String(item.stock) : "")
  const [images,      setImages]      = useState<string[]>(item?.images ?? [])
  const [buying,      setBuying]      = useState(item && isSale ? item.buyingPrice : "")
  const [selling,     setSelling]     = useState(item && isSale ? item.sellingPrice : "")
  const [minSell,     setMinSell]     = useState(item && isSale ? item.minSellingPrice : "")
  const [refPrice,    setRefPrice]    = useState(item?.refGuidePrice ?? "")
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
    const stockNum = parseAmount(stock)
    if (!typeId) e.typeId = tCom("required")
    if (isNaN(stockNum) || stockNum < 0 || !Number.isInteger(stockNum)) e.stock = tCom("required")
    if (isSale) {
      if (!name.trim()) e.name = tCom("required")
      const s = parseAmount(selling), m = parseAmount(minSell)
      if (isNaN(s) || s < 0) e.selling = tCom("invalidAmount")
      if (isNaN(m) || m < 0) e.minSell = tCom("invalidAmount")
      else if (!isNaN(s) && m > s) e.minSell = tInv("minAboveSelling")
      if (buying.trim() !== "" && (isNaN(parseAmount(buying)) || parseAmount(buying) < 0)) e.buying = tCom("invalidAmount")
    } else if (refPrice.trim() !== "" && (isNaN(parseAmount(refPrice)) || parseAmount(refPrice) < 0)) {
      e.refPrice = tCom("invalidAmount")
    }
    return e
  }

  const handleSave = async () => {
    const e = validate()
    setErrors(e)
    if (Object.keys(e).length) return

    setLoading(true)
    const input: CostumeItemInput = {
      segment,
      typeId,
      name_ar:       isSale ? name.trim() : undefined,
      sizeId:        suitSizeId  || null,
      colorId:       pantsSizeId || null,
      shirtSizeId:   shirtSizeId || null,
      shoeSizeId:    shoeSizeId  || null,
      stock:         parseInt(String(parseAmount(stock))),
      // the save applies the difference against this value, so concurrent rentals/sales are preserved
      originalStock: isEdit && item ? item.stock : undefined,
      images,
      ...(isSale
        ? {
            buyingPrice:     buying.trim() === "" ? 0 : parseAmount(buying),
            sellingPrice:    parseAmount(selling),
            minSellingPrice: parseAmount(minSell),
          }
        : { refGuidePrice: refPrice.trim() === "" ? null : parseAmount(refPrice) }),
    }

    try {
      const res = isEdit && item ? await updateCostumeItem(item.id, input) : await createCostumeItem(input)
      if (!res.ok) { toast(res.message || tCom("error"), "error"); return }
      toast(isEdit ? tInv("updateSuccess") : tInv("createSuccess"), "success")
      onSuccess()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${isEdit ? tInv("editItem") : tInv("addItem")} · ${SEGMENT_LABEL[segment]}`}
      size="lg"
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {isEdit && item?.sku && (
          <p className="mono" style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>{item.sku}</p>
        )}

        {/* ── النوع ── */}
        <CreatableSelect
          label={tInv("type")}
          value={typeId}
          onChange={setTypeId}
          onCreated={opt => setLocalTypes(prev => [...prev, { id: opt.value, label_fr: opt.label, label_ar: opt.label }])}
          onDeleted={id  => setLocalTypes(prev => prev.filter(t => t.id !== id))}
          canDelete
          slug="costume_item_types"
          placeholder="اختر النوع"
          options={TYPE_OPTIONS}
          error={errors.typeId}
        />

        {isSale && (
          <Input label="اسم القطعة *" value={name} onChange={e => setName(e.target.value)} error={errors.name} dir="rtl" />
        )}

        {/* ── مقاس البدلة + مقاس السروال ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <CreatableSelect
            label="مقاس البدلة"
            value={suitSizeId}
            onChange={setSuitSizeId}
            onCreated={opt => setSuitSizes(prev  => [...prev,  opt])}
            onDeleted={id  => setSuitSizes(prev  => prev.filter(s => s.value !== id))}
            canDelete
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
            canDelete
            slug="pants_sizes"
            placeholder="بدون"
            options={pantsSizes}
          />
        </div>

        {/* ── مقاس القميص + مقاس الحذاء ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, alignItems: "start" }}>
          <CreatableSelect
            label="مقاس القميص"
            value={shirtSizeId}
            onChange={setShirtSizeId}
            onCreated={opt => setShirtSizes(prev => [...prev,  opt])}
            onDeleted={id  => setShirtSizes(prev => prev.filter(s => s.value !== id))}
            canDelete
            slug="shirt_sizes"
            placeholder="بدون"
            options={shirtSizes}
          />

          {/* Shoe size with visual guide */}
          <div>
            <CreatableSelect
              label="مقاس الحذاء"
              value={shoeSizeId}
              onChange={setShoeSizeId}
              onCreated={opt => setShoeSizes(prev => [...prev,  opt])}
              onDeleted={id  => setShoeSizes(prev => prev.filter(s => s.value !== id))}
              canDelete
              slug="shoe_sizes"
              placeholder="بدون"
              options={shoeSizes}
            />
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, padding: "5px 10px", borderRadius: 6, background: "var(--surface-2)" }}>
              <ShoeGuideIcon />
              <span style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.4 }}>
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

        {/* ── الأسعار ── */}
        {isSale ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <Input label="سعر الشراء" type="number" value={buying}  onChange={e => setBuying(e.target.value)}  error={errors.buying}  />
            <Input label="سعر البيع *" type="number" value={selling} onChange={e => setSelling(e.target.value)} error={errors.selling} />
            <Input label="الحد الأدنى *" type="number" value={minSell} onChange={e => setMinSell(e.target.value)} error={errors.minSell} />
          </div>
        ) : (
          <Input
            label="سعر الإيجار المرجعي (اختياري)"
            type="number"
            value={refPrice}
            onChange={e => setRefPrice(e.target.value)}
            error={errors.refPrice}
            hint="يظهر كمجموع مقترح عند إنشاء إيجار جديد"
          />
        )}

        {/* ── الصور ── (the uploader shows its own title: no second label above it) */}
        <ImageUploader label={tInv("images")} images={images} onChange={setImages} />

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
