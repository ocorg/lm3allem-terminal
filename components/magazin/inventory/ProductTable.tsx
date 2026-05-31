"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { PencilLine, ToggleLeft, ToggleRight, Plus } from "lucide-react"
import { DataTable, type Column } from "@/components/ui/DataTable"
import { Badge }       from "@/components/ui/Badge"
import { Button }      from "@/components/ui/Button"
import { useConfirm }  from "@/hooks/useConfirm"
import { toast }       from "@/hooks/useToast"
import { toggleProductActive } from "@/lib/actions/magazin/inventory"
import { formatMAD }   from "@/lib/utils/currency"
import { ProductFormModal } from "./ProductFormModal"
import { useTranslations } from "next-intl"
import type { ProductForInventory } from "@/lib/actions/magazin/inventory"

type LookupItem    = { id: string; label_fr: string; label_ar: string }
type LookupMapItem = { label_fr: string; label_ar: string }

interface ProductTableProps {
  products:   ProductForInventory[]
  categories: LookupItem[]
  sizes:      LookupItem[]
  colors:     LookupItem[]
  lookupById: Record<string, LookupMapItem>
  role:       string
  locale:     string
}

export function ProductTable({ products, categories, sizes, colors, lookupById, role }: ProductTableProps) {
  const router                = useRouter()
  const { confirm, modal }    = useConfirm()
  const [formMode, setFormMode]       = useState<"create" | "edit" | null>(null)
  const [editProduct, setEditProduct] = useState<ProductForInventory | null>(null)
  const t       = useTranslations("magazin.inventory")
  const tPos    = useTranslations("magazin.pos")
  const tCom    = useTranslations("common")
  const isAdmin = role === "admin" || role === "superadmin"
  const lookupMap = lookupById

  const openEdit = (p: ProductForInventory) => { setEditProduct(p); setFormMode("edit") }
  const openCreate = () => { setEditProduct(null); setFormMode("create") }
  const closeForm = () => { setFormMode(null); setEditProduct(null) }

  const handleToggle = async (product: ProductForInventory) => {
    const ok = await confirm({
      title:        product.isActive ? t("deactivate") : t("activate"),
      message:      product.isActive ? t("deactivateConfirm") : t("activateConfirm"),
      confirmLabel: product.isActive ? t("deactivate") : t("activate"),
      variant:      product.isActive ? "danger" : "primary",
    })
    if (!ok) return
    try {
      await toggleProductActive(product.id)
      toast(t("toggleSuccess"), "success")
      router.refresh()
    } catch {
      toast(tCom("error"), "error")
    }
  }

  const columns: Column<ProductForInventory & { id: string }>[] = [
    {
      key: "images", label: "Photo", width: 60,
      render: (_, row) => (
        <div style={{ width: 40, height: 40, borderRadius: 6, overflow: "hidden", background: "var(--surface-2)" }}>
          {row.images[0]
            ? <img src={row.images[0]} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" />
            : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🧳</div>
          }
        </div>
      ),
    },
    {
      key: "name_fr", label: "Produit", sortable: true,
      render: (_, row) => (
        <div>
          <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", margin: 0 }}>{row.name_fr}</p>
          <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "1px 0 0" }}>{row.name_ar}</p>
        </div>
      ),
    },
    { key: "categoryId", label: t("category"),
      render: (val) => <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{lookupMap[val as string]?.label_fr ?? "—"}</span>,
    },
    {
      key: "totalStock", label: t("stock"), align: "center", sortable: true,
      render: (val) => {
        const n = val as number
        return (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: n === 0 ? "var(--danger)" : "var(--text)" }}>{n}</span>
            {n > 0 && n <= 3 && <Badge variant="warning">{t("stockBas")}</Badge>}
            {n === 0   && <Badge variant="danger">{tPos("outOfStock")}</Badge>}
          </div>
        )
      },
    },
    {
      key: "sellingPrice", label: t("sellingPrice"), align: "right", sortable: true,
      render: (val) => <span style={{ fontSize: 13, fontWeight: 600 }}>{formatMAD(val as string)}</span>,
    },
    ...(isAdmin ? [
      {
        key: "buyingPrice" as keyof ProductForInventory, label: t("buyingPrice"), align: "right" as const,
        render: (val: unknown) => <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{formatMAD(val as string)}</span>,
      },
      {
        key: "minSellingPrice" as keyof ProductForInventory, label: t("minSellingPrice"), align: "right" as const,
        render: (val: unknown) => <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{formatMAD(val as string)}</span>,
      },
    ] : []),
    {
      key: "isActive", label: tCom("status"), align: "center",
      render: (val) => <Badge variant={val ? "success" : "default"}>{val ? t("active") : t("inactive")}</Badge>,
    },
    {
      key: "id", label: "", width: 72,
      render: (_, row) => (
        <div style={{ display: "flex", gap: 2 }}>
          <button onClick={e => { e.stopPropagation(); openEdit(row) }} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4 }}>
            <PencilLine size={14} />
          </button>
          <button onClick={e => { e.stopPropagation(); handleToggle(row) }} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
            {row.isActive
              ? <ToggleRight size={16} style={{ color: "var(--success)" }} />
              : <ToggleLeft  size={16} style={{ color: "var(--text-muted)" }} />}
          </button>
        </div>
      ),
    },
  ]

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.02em", margin: 0 }}>
            {t("title")}
          </h1>
          {isAdmin && (
            <Button icon={<Plus size={15} />} onClick={openCreate}>
              {t("addProduct")}
            </Button>
          )}
        </div>

        <DataTable
          columns={columns as any}
          data={products}
          searchable
          searchKeys={["name_fr", "name_ar"]}
          emptyMessage={t("noProducts")}
        />
      </div>

      {modal}

      <ProductFormModal
        isOpen={formMode !== null}
        mode={formMode ?? "create"}
        product={editProduct}
        categories={categories}
        sizes={sizes}
        colors={colors}
        lookupById={lookupById}
        onClose={closeForm}
        onSuccess={() => { closeForm(); router.refresh() }}
      />
    </>
  )
}