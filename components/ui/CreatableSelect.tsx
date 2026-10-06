"use client"

import { useState, useTransition } from "react"
import { Select }                  from "@/components/ui/Select"
import { Input }                   from "@/components/ui/Input"
import { Button }                  from "@/components/ui/Button"
import { Trash2 }                  from "lucide-react"
import { toast }                   from "@/hooks/useToast"
import { createLookupBySlug, removeLookupValue } from "@/lib/actions/magazin/inventory-options"
import React from "react"

interface Option { value: string; label: string }

interface CreatableSelectProps {
  label?:       string
  value:        string
  onChange:     (newId: string) => void
  options:      Option[]
  placeholder?: string
  error?:       string
  slug:         string
  onCreated:    (opt: Option) => void
  onDeleted?:   (id: string) => void
  /** Show the "remove option" button (admins only: removing an option affects every record using it). */
  canDelete?:   boolean
}

export function CreatableSelect({
  label, value, onChange, options, placeholder, error, slug, onCreated, onDeleted, canDelete = false,
}: CreatableSelectProps) {
  const [adding,    setAdding]    = useState(false)
  const [labelAr,   setLabelAr]   = useState("")
  const [isPending, startTransition] = useTransition()

  const handleCreate = () => {
    if (!labelAr.trim()) return
    startTransition(async () => {
      const res = await createLookupBySlug(slug, labelAr.trim())
      if (!res.ok) { toast(res.message, "error"); return }
      onCreated({ value: res.data.id, label: res.data.label_ar })
      setLabelAr(""); setAdding(false)
      toast("تمت الإضافة", "success")
    })
  }

  const handleDelete = () => {
    if (!value) return
    if (!confirm("حذف هذا الخيار؟")) return
    startTransition(async () => {
      const res = await removeLookupValue(value)
      if (!res.ok) { toast(res.message || "تعذر الحذف", "error"); return }
      onDeleted?.(value)
      onChange("")
      toast("تم الحذف", "success")
    })
  }

  if (adding) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {label && (
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>
            {label}
          </span>
        )}
        <Input label="الاسم" value={labelAr} onChange={e => setLabelAr(e.target.value)} autoFocus dir="rtl" />
        <div style={{ display: "flex", gap: 6 }}>
          <Button size="sm" onClick={handleCreate} loading={isPending} disabled={!labelAr.trim()}>
            إضافة
          </Button>
          <Button size="sm" variant="ghost" onClick={() => { setAdding(false); setLabelAr("") }}>
            إلغاء
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 6 }}>
      <div style={{ flex: 1 }}>
        <Select
          label={label}
          value={value}
          onChange={e => {
            if (e.target.value === "__create__") setAdding(true)
            else onChange(e.target.value)
          }}
          placeholder={placeholder}
          error={error}
          options={[
            ...options,
            { value: "__create__", label: "+ إضافة جديد" },
          ]}
        />
      </div>
      {value && canDelete && (
        <button aria-label="حذف الخيار المحدد"
          type="button"
          onClick={handleDelete}
          disabled={isPending}
          title="حذف الخيار المحدد"
          style={{
            height: 42, width: 36, display: "flex", alignItems: "center", justifyContent: "center",
            background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8,
            color: "var(--danger)", cursor: "pointer", flexShrink: 0,
          }}
        >
          <Trash2 size={16} />
        </button>
      )}
    </div>
  )
}