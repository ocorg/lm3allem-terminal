"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Select } from "@/components/ui/Select"
import { CreatableSelect } from "@/components/ui/CreatableSelect"
import { Textarea } from "@/components/ui/Textarea"
import { Modal } from "@/components/ui/Modal"
import { Badge } from "@/components/ui/Badge"
import { toast } from "@/hooks/useToast"
import { useConfirm } from "@/hooks/useConfirm"
import { formatMAD } from "@/lib/utils/currency"
import { formatDay } from "@/lib/utils/date"
import { calendarKey, todayKey } from "@/lib/utils/time"
import {
  createExpense, updateExpense, deleteExpense,
  type SerializedExpense, type CreateExpenseInput,
} from "@/lib/actions/lm3allem/expenses"
import type { SerializedCategory, SerializedLookupValue } from "@/lib/actions/lm3allem/options"
import React from "react"
import { portalLabel } from "@/lib/utils/labels"

const PORTAL_VARIANT: Record<string, "primary" | "info" | "success"> = {
  magazin:  "primary",
  costumes: "info",
  lm3allem: "success",
}

const PORTALS = ["magazin", "costumes", "lm3allem"] as const

interface Props {
  initialExpenses: SerializedExpense[]
  categories: SerializedCategory[]
  expenseValues: SerializedLookupValue[]
}

// Built at call time: a module-level `new Date()` would freeze the date for a tab left open overnight
const emptyForm = (): CreateExpenseInput => ({
  portal: "lm3allem",
  categoryId: "",
  amount: "",
  description: "",
  date: todayKey(),
})

export function ExpensesClient({ initialExpenses, expenseValues: initialExpenseValues }: Props) {
  const t = useTranslations("lm3allem.expenses")
  const tCom = useTranslations("common")
  const router = useRouter()
  const [expenseValues, setExpenseValues] = useState<{ id: string; label_fr: string; label_ar: string }[]>(initialExpenseValues)
  const { confirm, modal } = useConfirm()
  const [isPending, startTransition] = useTransition()

  const [modalOpen, setModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<SerializedExpense | null>(null)
  const [form, setForm] = useState<CreateExpenseInput>(emptyForm)

  function openAdd() {
    setEditTarget(null)
    setForm(emptyForm())
    setModalOpen(true)
  }

  function openEdit(e: SerializedExpense) {
    setEditTarget(e)
    setForm({
      portal: e.portal as CreateExpenseInput["portal"],
      categoryId: e.categoryId,
      amount: e.amount,
      description: e.description,
      date: calendarKey(e.date),
      receiptUrl: e.receiptUrl ?? undefined,
    })
    setModalOpen(true)
  }

  function handleSave() {
    startTransition(async () => {
      const res = editTarget
        ? await updateExpense({ id: editTarget.id, categoryId: form.categoryId, amount: form.amount, description: form.description, date: form.date, receiptUrl: form.receiptUrl ?? null })
        : await createExpense(form)
      if (!res.ok) { toast(res.message || t("saveError"), "error"); return }
      toast(editTarget ? t("updated") : t("added"), "success")
      setModalOpen(false)
      router.refresh()
    })
  }

  async function handleDelete(id: string) {
    const ok = await confirm({ title: t("confirmDelete"), message: "", variant: "danger" })
    if (!ok) return
    startTransition(async () => {
      const res = await deleteExpense(id)
      if (!res.ok) { toast(res.message || t("deleteError"), "error"); return }
      toast(t("deleted"), "success")
      router.refresh()
    })
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {modal}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)",margin: 0 }}>
          {t("title")}
        </h1>
        <Button variant="primary" onClick={openAdd}>{t("add")}</Button>
      </div>

      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "8px", overflow: "hidden" }}>
        {initialExpenses.length === 0
          ? <p style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}>{t("noExpenses")}</p>
          : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ background: "var(--surface-2)" }}>
                  {[t("date"), t("portal"), t("category"), t("description"), t("amount"), t("recordedBy"), ""].map((h, i) => (
                    <th key={i} style={{ padding: "12px 16px", textAlign: "start", fontWeight: 600, fontSize: 12, color: "var(--text-muted)",borderBottom: "1px solid var(--border)" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {initialExpenses.map((e, i) => (
                  <tr key={e.id} style={{ borderBottom: i < initialExpenses.length - 1 ? "1px solid var(--border)" : "none" }}>
                    <td style={{ padding: "12px 16px", color: "var(--text-muted)" }}>{formatDay(e.date)}</td>
                    <td style={{ padding: "12px 16px" }}><Badge variant={PORTAL_VARIANT[e.portal] ?? "default"}>{portalLabel(e.portal)}</Badge></td>
                    <td style={{ padding: "12px 16px" }}>{e.categoryLabel_ar}</td>
                    <td style={{ padding: "12px 16px" }}>{e.description}</td>
                    <td style={{ padding: "12px 16px", fontWeight: 600 }}>{formatMAD(e.amount)}</td>
                    <td style={{ padding: "12px 16px", color: "var(--text-muted)" }}>{e.recordedByName}</td>
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ display: "flex", gap: 8 }}>
                        <Button variant="ghost" size="sm" onClick={() => openEdit(e)}>{t("edit")}</Button>
                        <Button variant="danger" size="sm" onClick={() => handleDelete(e.id)}>{t("delete")}</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        }
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editTarget ? t("edit") : t("add")}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16, width: "100%" }}>
          <Select
            label={t("portal")}
            value={form.portal}
            onChange={(e) => setForm((f) => ({ ...f, portal: e.target.value as CreateExpenseInput["portal"] }))}
            options={PORTALS.map((p) => ({ value: p, label: p }))}
          />
          <CreatableSelect
            label={t("category")}
            value={form.categoryId}
            onChange={(id) => setForm((f) => ({ ...f, categoryId: id }))}
            onCreated={(opt) => setExpenseValues((prev) => [...prev, { id: opt.value, label_fr: opt.label, label_ar: opt.label }])}
            onDeleted={(id) => setExpenseValues((prev) => prev.filter((v) => v.id !== id))}
            canDelete
            slug="expense_categories"
            placeholder="-"
            options={expenseValues.map((v) => ({ value: v.id, label: v.label_ar }))}
          />
          <Input label={t("amount")} type="number" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
          <Input label={t("date")} type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
          <Textarea label={t("description")} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          <Input label={t("receiptUrl")} dir="ltr" value={form.receiptUrl ?? ""} onChange={(e) => setForm((f) => ({ ...f, receiptUrl: e.target.value || undefined }))} />
          <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>{tCom("cancel")}</Button>
            <Button variant="primary" onClick={handleSave} loading={isPending}>{tCom("save")}</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}