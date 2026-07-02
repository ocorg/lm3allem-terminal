"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Select } from "@/components/ui/Select"
import { Textarea } from "@/components/ui/Textarea"
import { Modal } from "@/components/ui/Modal"
import { Badge } from "@/components/ui/Badge"
import { toast } from "@/hooks/useToast"
import { useConfirm } from "@/hooks/useConfirm"
import { formatMAD } from "@/lib/utils/currency"
import { formatDate } from "@/lib/utils/date"
import {
  createExpense, updateExpense, deleteExpense,
  type SerializedExpense, type CreateExpenseInput,
} from "@/lib/actions/lm3allem/expenses"
import type { SerializedCategory, SerializedLookupValue } from "@/lib/actions/lm3allem/options"
import React from "react"

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

const EMPTY_FORM: CreateExpenseInput = {
  portal: "lm3allem",
  categoryId: "",
  amount: "",
  description: "",
  date: new Date().toISOString().slice(0, 10),
}

export function ExpensesClient({ initialExpenses, expenseValues }: Props) {
  const t = useTranslations("lm3allem.expenses")
  const router = useRouter()
  const { confirm, modal } = useConfirm()
  const [isPending, startTransition] = useTransition()

  const [modalOpen, setModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<SerializedExpense | null>(null)
  const [form, setForm] = useState<CreateExpenseInput>(EMPTY_FORM)

  function openAdd() {
    setEditTarget(null)
    setForm(EMPTY_FORM)
    setModalOpen(true)
  }

  function openEdit(e: SerializedExpense) {
    setEditTarget(e)
    setForm({
      portal: e.portal as CreateExpenseInput["portal"],
      categoryId: e.categoryId,
      amount: e.amount,
      description: e.description,
      date: e.date.slice(0, 10),
      receiptUrl: e.receiptUrl ?? undefined,
    })
    setModalOpen(true)
  }

  function handleSave() {
    startTransition(async () => {
      try {
        if (editTarget) {
          await updateExpense({ id: editTarget.id, ...form })
        } else {
          await createExpense(form)
        }
        toast(editTarget ? t("updated") : t("added"), "success")
        setModalOpen(false)
        router.refresh()
      } catch {
        toast(t("saveError"), "error")
      }
    })
  }

  async function handleDelete(id: string) {
    const ok = await confirm({ title: t("confirmDelete"), message: "", variant: "danger" })
    if (!ok) return
    startTransition(async () => {
      try {
        await deleteExpense(id)
        toast(t("deleted"), "success")
        router.refresh()
      } catch {
        toast(t("deleteError"), "error")
      }
    })
  }

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 24 }}>
      {modal}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.02em", margin: 0 }}>
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
                    <th key={i} style={{ padding: "12px 16px", textAlign: "start", fontWeight: 600, fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em", borderBottom: "1px solid var(--border)" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {initialExpenses.map((e, i) => (
                  <tr key={e.id} style={{ borderBottom: i < initialExpenses.length - 1 ? "1px solid var(--border)" : "none" }}>
                    <td style={{ padding: "12px 16px", color: "var(--text-muted)" }}>{formatDate(e.date)}</td>
                    <td style={{ padding: "12px 16px" }}><Badge variant={PORTAL_VARIANT[e.portal] ?? "default"}>{e.portal}</Badge></td>
                    <td style={{ padding: "12px 16px" }}>{e.categoryLabel_fr}</td>
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
          <Select
            label={t("category")}
            value={form.categoryId}
            onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
            options={[
              { value: "", label: "-" },
              ...expenseValues.map((v) => ({ value: v.id, label: v.label_fr })),
            ]}
          />
          <Input label={t("amount")} type="number" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
          <Input label={t("date")} type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
          <Textarea label={t("description")} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          <Input label={t("receiptUrl")} value={form.receiptUrl ?? ""} onChange={(e) => setForm((f) => ({ ...f, receiptUrl: e.target.value || undefined }))} />
          <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Annuler</Button>
            <Button variant="primary" onClick={handleSave} loading={isPending}>Enregistrer</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}