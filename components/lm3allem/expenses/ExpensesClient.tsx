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
import { DataTable } from "@/components/ui/DataTable"
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

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)",margin: 0 }}>
          {t("title")}
        </h1>
        <Button variant="primary" onClick={openAdd}>{t("add")}</Button>
      </div>

      <DataTable
        data={initialExpenses}
        emptyMessage={t("noExpenses")}
        pageSize={50}
        columns={[
          { key: "description", label: t("description"), primary: true },
          { key: "amount", label: t("amount"), render: (_, e) => <span style={{ fontWeight: 600 }}>{formatMAD(e.amount)}</span> },
          { key: "date", label: t("date"), render: (_, e) => <span style={{ color: "var(--text-muted)" }}>{formatDay(e.date)}</span> },
          { key: "portal", label: t("portal"), render: (_, e) => <Badge variant={PORTAL_VARIANT[e.portal] ?? "default"}>{portalLabel(e.portal)}</Badge> },
          { key: "categoryLabel_ar", label: t("category") },
          { key: "recordedByName", label: t("recordedBy"), render: (_, e) => <span style={{ color: "var(--text-muted)" }}>{e.recordedByName}</span> },
          { key: "id", label: "", actions: true, render: (_, e) => (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Button variant="secondary" size="sm" onClick={() => openEdit(e)}>{t("edit")}</Button>
              <Button variant="danger" size="sm" onClick={() => handleDelete(e.id)}>{t("delete")}</Button>
            </div>
          ) },
        ]}
      />

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editTarget ? t("edit") : t("add")}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16, width: "100%" }}>
          <Select
            label={t("portal")}
            value={form.portal}
            onChange={(e) => setForm((f) => ({ ...f, portal: e.target.value as CreateExpenseInput["portal"] }))}
            options={PORTALS.map((p) => ({ value: p, label: portalLabel(p) }))}
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