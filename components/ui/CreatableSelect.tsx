"use client"

import { useState, useTransition } from "react"
import { Select }                  from "@/components/ui/Select"
import { Input }                   from "@/components/ui/Input"
import { Button }                  from "@/components/ui/Button"
import { toast }                   from "@/hooks/useToast"
import { createLookupBySlug }      from "@/lib/actions/magazin/inventory-options"
import React from "react"

interface Option { value: string; label: string; labelFr: string; labelAr: string }

interface CreatableSelectProps {
  label?:      string
  value:       string
  onChange:    (newId: string) => void
  options:     { value: string; label: string }[]
  placeholder?: string
  error?:      string
  slug:        "product_categories" | "product_sizes" | "product_colors"
  onCreated:   (opt: Option) => void
}

export function CreatableSelect({ label, value, onChange, options, placeholder, error, slug, onCreated }: CreatableSelectProps) {
  const [adding,    setAdding]    = useState(false)
  const [labelAr,   setLabelAr]   = useState("")
  const [labelFr,   setLabelFr]   = useState("")
  const [isPending, startTransition] = useTransition()

  const handleCreate = () => {
    if (!labelAr.trim() && !labelFr.trim()) return
    startTransition(async () => {
      try {
        const created = await createLookupBySlug(slug, labelAr.trim() || labelFr.trim(), labelFr.trim() || labelAr.trim())
        onCreated({ value: created.id, label: created.label_ar || created.label_fr, labelFr: created.label_fr, labelAr: created.label_ar })
        setLabelAr(""); setLabelFr(""); setAdding(false)
        toast("تمت الإضافة", "success")
      } catch {
        toast("خطأ في الإضافة", "error")
      }
    })
  }

  if (adding) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {label && (
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            {label}
          </span>
        )}
        <Input label="الاسم بالعربية *" value={labelAr} onChange={e => setLabelAr(e.target.value)} autoFocus />
        <Input label="الاسم بالفرنسية (اختياري)" value={labelFr} onChange={e => setLabelFr(e.target.value)} />
        <div style={{ display: "flex", gap: 6 }}>
          <Button size="sm" onClick={handleCreate} loading={isPending} disabled={!labelAr.trim() && !labelFr.trim()}>
            إضافة
          </Button>
          <Button size="sm" variant="ghost" onClick={() => { setAdding(false); setLabelAr(""); setLabelFr("") }}>
            إلغاء
          </Button>
        </div>
      </div>
    )
  }

  return (
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
  )
}