"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Select } from "@/components/ui/Select"
import { Modal } from "@/components/ui/Modal"
import { Badge } from "@/components/ui/Badge"
import { toast } from "@/hooks/useToast"
import { useConfirm } from "@/hooks/useConfirm"
import {
  createUser, updateUser, toggleUserActive, resetUserPassword,
  type SerializedUser, type CreateUserInput,
} from "@/lib/actions/lm3allem/users"
import { PORTAL_MODULES, type ModulePermissions } from "@/lib/permissions"
import { copyText } from "@/lib/client/clipboard"
import React from "react"
import { DateText } from "@/components/ui/DateText"

const PORTAL_LABELS: Record<string, string> = { magazin: "المتجر", costumes: "البدلات" }

const MODULE_LABELS: Record<string, Record<string, string>> = {
  magazin: {
    pos: "نقطة البيع", inventory: "المخزون", caisse: "الصندوق", credits: "الديون", requests: "طلبات المنتجات",
  },
  costumes: {
    pos: "بيع البدلات", rentals: "الإيجار", rental_inventory: "مخزون الإيجار", clients: "العملاء", caisse: "الصندوق",
  },
}

type EditablePortal = keyof typeof PORTAL_MODULES

interface Props {
  initialUsers: SerializedUser[]
  /** permissions pre-ticked when creating a staff account (Settings > default staff permissions) */
  defaultPermissions: ModulePermissions
}

interface FormState {
  name: string
  email: string
  role: "admin" | "staff"
  portalAccess: EditablePortal[]
  modulePermissions: ModulePermissions
}

const emptyForm = (defaults: ModulePermissions): FormState => ({
  name: "", email: "", role: "staff",
  portalAccess: ["magazin", "costumes"],
  modulePermissions: structuredClone(defaults),
})

interface Credentials { title: string; name: string; email: string | null; password: string }

export function UsersClient({ initialUsers, defaultPermissions }: Props) {
  const t = useTranslations("lm3allem.users")
  const router = useRouter()
  const { confirm, modal } = useConfirm()
  const [isSaving,   startSave]   = useTransition()
  const [isToggling, startToggle] = useTransition()
  const [, startReset] = useTransition()

  const [formOpen, setFormOpen]       = useState(false)
  const [creds, setCreds]             = useState<Credentials | null>(null)
  const [copied, setCopied]           = useState(false)
  const [editTarget, setEditTarget]   = useState<SerializedUser | null>(null)
  const [form, setForm]               = useState<FormState>(() => emptyForm(defaultPermissions))
  const [formError, setFormError]     = useState("")

  function openCreate() {
    setEditTarget(null)
    setForm(emptyForm(defaultPermissions))
    setFormError("")
    setFormOpen(true)
  }

  function openEdit(u: SerializedUser) {
    setEditTarget(u)
    setForm({
      name: u.name,
      email: u.email ?? "",
      role: u.role === "admin" ? "admin" : "staff",
      portalAccess: u.portalAccess.filter((p): p is EditablePortal => p === "magazin" || p === "costumes"),
      modulePermissions: structuredClone(u.modulePermissions),
    })
    setFormError("")
    setFormOpen(true)
  }

  function togglePortal(portal: EditablePortal) {
    setForm((f) => ({
      ...f,
      portalAccess: f.portalAccess.includes(portal)
        ? f.portalAccess.filter((x) => x !== portal)
        : [...f.portalAccess, portal],
    }))
  }

  /** Permissions are stored as { portal: { module: boolean } }: one independent set per portal. */
  function toggleModule(portal: EditablePortal, module: string) {
    setForm((f) => {
      const perms = structuredClone(f.modulePermissions)
      perms[portal] = { ...(perms[portal] ?? {}), [module]: !perms[portal]?.[module] }
      return { ...f, modulePermissions: perms }
    })
  }

  function handleSave() {
    setFormError("")
    startSave(async () => {
      const payload: CreateUserInput = {
        name: form.name,
        email: form.email,
        role: form.role,
        portalAccess: form.portalAccess,
        modulePermissions: form.modulePermissions,
      }

      if (editTarget) {
        const res = await updateUser({ id: editTarget.id, ...payload })
        if (!res.ok) { setFormError(res.message); return }
        toast(t("updated"), "success")
        setFormOpen(false)
        router.refresh()
      } else {
        const res = await createUser(payload)
        if (!res.ok) { setFormError(res.message); return }
        setFormOpen(false)
        setCreds({ title: t("accountCreated"), name: res.data.user.name, email: res.data.user.email, password: res.data.temporaryPassword })
        router.refresh()
      }
    })
  }

  async function handleToggleActive(u: SerializedUser) {
    const ok = await confirm({ title: u.isActive ? t("confirmDeactivate") : t("confirmActivate", { name: u.name }), message: "", variant: u.isActive ? "danger" : "primary" })
    if (!ok) return
    startToggle(async () => {
      const res = await toggleUserActive(u.id)
      if (!res.ok) { toast(res.message || t("toggleError"), "error"); return }
      toast(u.isActive ? t("deactivated") : t("activated"), "success")
      router.refresh()
    })
  }

  async function handleResetPassword(u: SerializedUser) {
    const ok = await confirm({ title: t("confirmResetPassword", { name: u.name }), message: t("resetPasswordInfo"), variant: "primary" })
    if (!ok) return
    startReset(async () => {
      const res = await resetUserPassword(u.id)
      if (!res.ok) { toast(res.message || t("passwordResetError"), "error"); return }
      setCreds({ title: t("passwordResetDone"), name: u.name, email: u.email, password: res.data.temporaryPassword })
      router.refresh()
    })
  }

  const isStaffForm = form.role === "staff"

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {modal}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>{t("title")}</h1>
        <Button variant="primary" onClick={openCreate}>{t("add")}</Button>
      </div>

      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "8px", overflow: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, minWidth: 900 }}>
          <thead>
            <tr style={{ background: "var(--surface-2)" }}>
              {[t("name"), t("email"), t("role"), t("portals"), t("active"), t("lastLogin"), t("actionsHeader")].map((h, i) => (
                <th key={i} style={{ padding: "12px 16px", textAlign: "start", fontWeight: 600, fontSize: 12, color: "var(--text-muted)",borderBottom: "1px solid var(--border)" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {initialUsers.map((u, i) => (
              <tr key={u.id} style={{ borderBottom: i < initialUsers.length - 1 ? "1px solid var(--border)" : "none", background: u.isActive ? undefined : "var(--surface-2)" }}>
                <td style={{ padding: "12px 16px", fontWeight: 600 }}>
                  {u.name}
                  {u.mustChangePassword && <div style={{ fontSize: 12, color: "var(--warning)", fontWeight: 400 }}>{t("passwordPending")}</div>}
                </td>
                <td dir="ltr" style={{ padding: "12px 16px", textAlign: "start", color: u.email ? "var(--text)" : "var(--danger)", fontSize: 13 }}>
                  {u.email ?? t("noEmail")}
                </td>
                <td style={{ padding: "12px 16px" }}>
                  <Badge variant={u.role === "admin" ? "info" : "default"}>
                    {t(`roles.${u.role === "admin" ? "admin" : "staff"}`)}
                  </Badge>
                </td>
                <td style={{ padding: "12px 16px" }}>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {u.role === "admin"
                      ? <Badge variant="default">{t("allPortals")}</Badge>
                      : u.portalAccess.map((p) => <Badge key={p} variant="default">{PORTAL_LABELS[p] ?? p}</Badge>)}
                  </div>
                </td>
                <td style={{ padding: "12px 16px" }}>
                  <Badge variant={u.isActive ? "success" : "default"}>{u.isActive ? t("active") : t("inactive")}</Badge>
                </td>
                <td style={{ padding: "12px 16px", color: "var(--text-muted)", fontSize: 12, whiteSpace: "nowrap" }}>
                  <DateText value={u.lastLoginAt} time />
                </td>
                <td style={{ padding: "12px 16px" }}>
                  <div style={{ display: "flex", gap: 12, flexWrap: "nowrap", alignItems: "center", whiteSpace: "nowrap" }}>
                    <Button variant="secondary" size="sm" onClick={() => openEdit(u)}>{t("edit")}</Button>
                    <Button variant="secondary" size="sm" onClick={() => handleResetPassword(u)}>{t("resetPassword")}</Button>
                    <Button variant={u.isActive ? "danger" : "primary"} size="sm" style={{ marginInlineStart: 12 }} onClick={() => handleToggleActive(u)} loading={isToggling}>
                      {u.isActive ? t("deactivate") : t("activate")}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {initialUsers.length === 0 && (
              <tr><td colSpan={7} style={{ padding: 32, textAlign: "center", color: "var(--text-muted)" }}>{t("noUsers")}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Create / Edit Modal */}
      <Modal isOpen={formOpen} onClose={() => setFormOpen(false)} title={editTarget ? t("edit") : t("add")} size="lg">
        <div style={{ display: "flex", flexDirection: "column", gap: 16, width: "100%" }}>
          <Input label={t("name")} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          <Input label={t("email")} type="email" dir="ltr" autoComplete="off" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          <Select
            label={t("role")}
            value={form.role}
            onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as "admin" | "staff" }))}
            options={[
              { value: "staff", label: t("roles.staff") },
              { value: "admin", label: t("roles.admin") },
            ]}
          />

          {isStaffForm ? (
            <>
              <div>
                <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 8 }}>{t("portals")}</p>
                <div style={{ display: "flex", gap: 8 }}>
                  {(Object.keys(PORTAL_MODULES) as EditablePortal[]).map((p) => {
                    const on = form.portalAccess.includes(p)
                    return (
                      <button type="button" key={p} onClick={() => togglePortal(p)} aria-pressed={on} style={{ padding: "0.25rem 0.75rem", borderRadius: "4px", border: "1px solid var(--border)", background: on ? "var(--brand)" : "var(--surface-2)", color: on ? "#000" : "var(--text)", cursor: "pointer", fontSize: 13 }}>
                        {PORTAL_LABELS[p]}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 8 }}>{t("permissions")}</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  {(Object.keys(PORTAL_MODULES) as EditablePortal[]).map((portal) => (
                    <div key={portal} style={{ opacity: form.portalAccess.includes(portal) ? 1 : 0.4 }}>
                      <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>{PORTAL_LABELS[portal]}</p>
                      {PORTAL_MODULES[portal].map((m) => (
                        <label key={m} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginBottom: 4, cursor: "pointer" }}>
                          <input
                            type="checkbox"
                            disabled={!form.portalAccess.includes(portal)}
                            checked={!!form.modulePermissions[portal]?.[m]}
                            onChange={() => toggleModule(portal, m)}
                          />
                          {MODULE_LABELS[portal][m]}
                        </label>
                      ))}
                    </div>
                  ))}
                </div>
                <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "8px 0 0" }}>{t("catalogueAlwaysOpen")}</p>
              </div>
            </>
          ) : (
            <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>{t("adminFullAccess")}</p>
          )}

          {!editTarget && <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>{t("temporaryPasswordInfo")}</p>}
          {formError && <p style={{ color: "var(--danger)", fontSize: 13, margin: 0 }}>{formError}</p>}

          <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
            <Button variant="ghost" onClick={() => setFormOpen(false)}>{t("cancel")}</Button>
            <Button variant="primary" onClick={handleSave} loading={isSaving} disabled={!form.name.trim() || !form.email.trim()}>{t("save")}</Button>
          </div>
        </div>
      </Modal>

      {/* One-time credentials */}
      <Modal isOpen={!!creds} onClose={() => { setCreds(null); setCopied(false) }} title={creds?.title}>
        {creds && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14, alignItems: "center", padding: 8, minWidth: 280 }}>
            <p style={{ color: "var(--text-muted)", fontSize: 14, margin: 0 }}>{creds.name}</p>
            {creds.email && <p dir="ltr" style={{ margin: 0, fontSize: 14, color: "var(--text)" }}>{creds.email}</p>}
            <div dir="ltr" className="mono" style={{ fontSize: 26, fontWeight: 700,color: "var(--primary)", padding: "8px 16px", background: "var(--surface-2)", borderRadius: 8, border: "1px solid var(--border)", userSelect: "all" }}>
              {creds.password}
            </div>
            <p style={{ color: "var(--warning)", fontSize: 13, textAlign: "center", margin: 0 }}>{t("passwordWarning")}</p>
            <div style={{ display: "flex", gap: 8 }}>
              <Button
                variant="secondary"
                size="sm"
                onClick={async () => {
                  if (await copyText(creds.password, "كلمة المرور المؤقتة")) {
                    setCopied(true)
                    setTimeout(() => setCopied(false), 2500)
                  }
                }}
              >
                {copied ? t("copied") : t("copyPassword")}
              </Button>
              <Button variant="primary" onClick={() => { setCreds(null); setCopied(false) }}>{t("passwordConfirm")}</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
