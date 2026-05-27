"use client"

import { useState, useTransition } from "react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Modal } from "@/components/ui/Modal"
import { Badge } from "@/components/ui/Badge"
import { Spinner } from "@/components/ui/Spinner"
import { toast } from "@/hooks/useToast"
import {
  getLookupValues, createLookupValue, updateLookupValue,
  toggleLookupValueActive, reorderLookupValues,
  type SerializedCategory, type SerializedLookupValue,
} from "@/lib/actions/lm3allem/options"

interface Props { categories: SerializedCategory[] }

export function OptionsClient({ categories }: Props) {
  const t = useTranslations("lm3allem.options")
  const [selectedCat, setSelectedCat] = useState<SerializedCategory | null>(null)
  const [values, setValues]           = useState<SerializedLookupValue[]>([])
  const [loadingValues, startLoad]    = useTransition()
  const [isPending, startTransition]  = useTransition()

  const [modalOpen, setModalOpen]   = useState(false)
  const [editTarget, setEditTarget] = useState<SerializedLookupValue | null>(null)
  const [form, setForm]             = useState({ label_fr: "", label_ar: "" })

  function selectCategory(cat: SerializedCategory) {
    setSelectedCat(cat)
    startLoad(async () => {
      const vals = await getLookupValues(cat.id)
      setValues(vals)
    })
  }

  function openAdd() {
    setEditTarget(null)
    setForm({ label_fr: "", label_ar: "" })
    setModalOpen(true)
  }

  function openEdit(v: SerializedLookupValue) {
    setEditTarget(v)
    setForm({ label_fr: v.label_fr, label_ar: v.label_ar })
    setModalOpen(true)
  }

  function handleSave() {
    if (!selectedCat) return
    startTransition(async () => {
      try {
        if (editTarget) {
          await updateLookupValue({ id: editTarget.id, ...form })
          setValues((prev) => prev.map((v) => v.id === editTarget.id ? { ...v, ...form } : v))
        } else {
          const created = await createLookupValue({ categoryId: selectedCat.id, ...form })
          setValues((prev) => [...prev, created])
        }
        toast(editTarget ? "Valeur mise à jour" : "Valeur ajoutée", "success")
        setModalOpen(false)
      } catch {
        toast("Erreur lors de l'enregistrement", "error")
      }
    })
  }

  async function handleToggle(v: SerializedLookupValue) {
    startTransition(async () => {
      try {
        await toggleLookupValueActive(v.id)
        setValues((prev) => prev.map((item) => item.id === v.id ? { ...item, isActive: !item.isActive } : item))
      } catch {
        toast("Erreur", "error")
      }
    })
  }

  // Move item up or down and call reorder
  function moveItem(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= values.length) return
    const reordered = [...values]
    const [moved] = reordered.splice(index, 1)
    reordered.splice(target, 0, moved)
    setValues(reordered)
    startTransition(async () => {
      try {
        await reorderLookupValues(reordered.map((v) => v.id))
      } catch {
        toast("Erreur lors du réordonnancement", "error")
      }
    })
  }

  return (
    <div style={{ padding: "1.5rem", display: "grid", gridTemplateColumns: "280px 1fr", gap: "1.5rem", alignItems: "start" }}>

      {/* Categories List */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "8px", overflow: "hidden" }}>
        <p style={{ padding: "0.875rem 1rem", margin: 0, fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)", borderBottom: "1px solid var(--border)", background: "var(--surface-2)" }}>
          {t("categories")}
        </p>
        {categories.length === 0
          ? <p style={{ padding: "1rem", color: "var(--text-muted)", fontSize: "0.875rem" }}>{t("noCategories")}</p>
          : categories.map((cat) => (
            <button key={cat.id} onClick={() => selectCategory(cat)} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              width: "100%", padding: "0.75rem 1rem", textAlign: "start", cursor: "pointer",
              background: selectedCat?.id === cat.id ? "var(--surface-2)" : "transparent",
              border: "none", borderBottom: "1px solid var(--border)",
              borderInlineStart: selectedCat?.id === cat.id ? "3px solid var(--primary)" : "3px solid transparent",
              color: "var(--text)", fontSize: "0.875rem",
            }}>
              <span>{cat.name_fr}</span>
              <Badge variant="default">{cat.valueCount}</Badge>
            </button>
          ))
        }
      </div>

      {/* Values Panel */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "8px", overflow: "hidden" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.875rem 1rem", borderBottom: "1px solid var(--border)", background: "var(--surface-2)" }}>
          <p style={{ margin: 0, fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)" }}>
            {selectedCat ? selectedCat.name_fr : t("selectCategory")}
          </p>
          {selectedCat && (
            <Button variant="primary" size="sm" onClick={openAdd}>{t("addValue")}</Button>
          )}
        </div>

        {!selectedCat
          ? <p style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}>{t("selectCategory")}</p>
          : loadingValues
            ? <div style={{ padding: "2rem", display: "flex", justifyContent: "center" }}><Spinner /></div>
            : values.length === 0
              ? <p style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}>{t("noValues")}</p>
              : (
                <div>
                  {values.map((v, i) => (
                    <div key={v.id} style={{
                      display: "flex", alignItems: "center", gap: "0.75rem",
                      padding: "0.625rem 1rem",
                      borderBottom: i < values.length - 1 ? "1px solid var(--border)" : "none",
                      opacity: v.isActive ? 1 : 0.5,
                    }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                        <button onClick={() => moveItem(i, -1)} disabled={i === 0} style={{ cursor: "pointer", background: "none", border: "none", color: "var(--text-muted)", fontSize: "0.65rem", lineHeight: 1, padding: "1px" }}>▲</button>
                        <button onClick={() => moveItem(i, 1)} disabled={i === values.length - 1} style={{ cursor: "pointer", background: "none", border: "none", color: "var(--text-muted)", fontSize: "0.65rem", lineHeight: 1, padding: "1px" }}>▼</button>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: "0.875rem", color: "var(--text)" }}>{v.label_fr}</div>
                        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{v.label_ar}</div>
                      </div>
                      <Badge variant={v.isActive ? "success" : "default"}>{v.isActive ? t("active") : t("inactive")}</Badge>
                      <Button variant="ghost" size="sm" onClick={() => openEdit(v)}>{t("editValue")}</Button>
                      <Button variant="ghost" size="sm" onClick={() => handleToggle(v)}>
                        {v.isActive ? t("inactive") : t("active")}
                      </Button>
                    </div>
                  ))}
                </div>
              )
        }
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editTarget ? t("editValue") : t("addValue")}>
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem", minWidth: "320px" }}>
          <Input label={t("labelFr")} value={form.label_fr} onChange={(e) => setForm((f) => ({ ...f, label_fr: e.target.value }))} />
          <Input label={t("labelAr")} value={form.label_ar} onChange={(e) => setForm((f) => ({ ...f, label_ar: e.target.value }))} dir="rtl" />
          <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Annuler</Button>
            <Button variant="primary" onClick={handleSave} loading={isPending}>Enregistrer</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}