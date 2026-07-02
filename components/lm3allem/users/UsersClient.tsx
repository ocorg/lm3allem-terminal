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
  createUser, updateUser, toggleUserActive, resetUserPin,
  type SerializedUser, type CreateUserInput,
} from "@/lib/actions/lm3allem/users"
import React from "react"

const ALL_PORTALS  = ["magazin", "costumes", "lm3allem"]
const MAG_MODULES  = ["pos", "inventory", "caisse", "credits", "requests"]
const COS_MODULES  = ["pos", "inventory", "clients", "rentals", "caisse"]

interface Props { initialUsers: SerializedUser[] }

const EMPTY_FORM = (): CreateUserInput => ({
  name: "", role: "staff", portalAccess: [], modulePermissions: {},
})

export function UsersClient({ initialUsers }: Props) {
  const t = useTranslations("lm3allem.users")
  const router = useRouter()
  const { confirm, modal } = useConfirm()
  const [isSaving,   startSave]   = useTransition()
  const [isToggling, startToggle] = useTransition()
  const [, startReset] = useTransition()

  const [formOpen, setFormOpen]   = useState(false)
  const [pinModal, setPinModal]   = useState<{ name: string; pin: string } | null>(null)
  const [editTarget, setEditTarget] = useState<SerializedUser | null>(null)
  const [form, setForm]           = useState<CreateUserInput>(EMPTY_FORM())

  function openCreate() {
    setEditTarget(null)
    setForm(EMPTY_FORM())
    setFormOpen(true)
  }

  function openEdit(u: SerializedUser) {
    setEditTarget(u)
    setForm({ name: u.name, role: u.role as CreateUserInput["role"], portalAccess: u.portalAccess as CreateUserInput["portalAccess"], modulePermissions: u.modulePermissions as CreateUserInput["modulePermissions"] })
    setFormOpen(true)
  }

  function togglePortal(portal: string) {
    const p = portal as CreateUserInput["portalAccess"][number]
    setForm((f) => ({
      ...f,
      portalAccess: f.portalAccess.includes(p)
        ? f.portalAccess.filter((x) => x !== p)
        : [...f.portalAccess, p],
    }))
  }

  function toggleModule(module: string) {
    setForm((f) => {
      const perms = { ...(f.modulePermissions as Record<string, unknown>) }
      perms[module] = !perms[module]
      return { ...f, modulePermissions: perms as CreateUserInput["modulePermissions"] }
    })
  }

  function handleSave() {
    startSave(async () => {
      try {
        if (editTarget) {
          await updateUser({ id: editTarget.id, ...form })
          toast(t("updated"), "success")
          setFormOpen(false)
          router.refresh()
        } else {
          const { plainPin, user } = await createUser(form)
          setFormOpen(false)
          setPinModal({ name: user.name, pin: plainPin })
          router.refresh()
        }
      } catch {
        toast(t("saveError"), "error")
      }
    })
  }

  async function handleToggleActive(u: SerializedUser) {
    if (u.role === "superadmin") return
    const ok = await confirm({ title: u.isActive ? t("confirmDeactivate") : t("confirmActivate", { name: u.name }), message: "", variant: u.isActive ? "danger" : "primary" })
    if (!ok) return
    startToggle(async () => {
      try {
        await toggleUserActive(u.id)
        toast(u.isActive ? t("deactivated") : t("activated"), "success")
        router.refresh()
      } catch (e: unknown) {
        toast((e instanceof Error ? e.message : null) ?? t("toggleError"), "error")
      }
    })
  }

  async function handleResetPin(u: SerializedUser) {
    const ok = await confirm({ title: t("confirmResetPin", { name: u.name }), message: "", variant: "primary" })
    if (!ok) return
    startReset(async () => {
      try {
        const { plainPin } = await resetUserPin(u.id)
        setPinModal({ name: u.name, pin: plainPin })
      } catch {
        toast(t("pinResetError"), "error")
      }
    })
  }

  const isSuperadmin = (u: SerializedUser) => u.role === "superadmin"

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 24 }}>
      {modal}

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <Button variant="primary" onClick={openCreate}>{t("add")}</Button>
      </div>

      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "8px", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ background: "var(--surface-2)" }}>
              {[t("name"), t("role"), t("portals"), t("active"), t("actionsHeader")].map((h, i) => (
                <th key={i} style={{ padding: "12px 16px", textAlign: "start", fontWeight: 600, fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em", borderBottom: "1px solid var(--border)" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {initialUsers.map((u, i) => (
              <tr key={u.id} style={{ borderBottom: i < initialUsers.length - 1 ? "1px solid var(--border)" : "none", opacity: u.isActive ? 1 : 0.55 }}>
                <td style={{ padding: "12px 16px", fontWeight: 600 }}>{u.name}</td>
                <td style={{ padding: "12px 16px" }}>
                  <Badge variant={u.role === "superadmin" ? "primary" : u.role === "admin" ? "info" : "default"}>
                    {t(`roles.${u.role}`)}
                  </Badge>
                </td>
                <td style={{ padding: "12px 16px" }}>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {u.portalAccess.map((p) => <Badge key={p} variant="default">{p}</Badge>)}
                  </div>
                </td>
                <td style={{ padding: "12px 16px" }}>
                  <Badge variant={u.isActive ? "success" : "default"}>{u.isActive ? t("active") : t("inactive")}</Badge>
                </td>
                <td style={{ padding: "12px 16px" }}>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {!isSuperadmin(u) && <Button variant="ghost" size="sm" onClick={() => openEdit(u)}>{t("edit")}</Button>}
                    {!isSuperadmin(u) && <Button variant="ghost" size="sm" onClick={() => handleResetPin(u)}>{t("resetPin")}</Button>}
                    {!isSuperadmin(u) && (
                      <Button variant={u.isActive ? "danger" : "primary"} size="sm" onClick={() => handleToggleActive(u)} loading={isToggling}>
                        {u.isActive ? t("deactivate") : t("activate")}
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create / Edit Modal */}
      <Modal isOpen={formOpen} onClose={() => setFormOpen(false)} title={editTarget ? t("edit") : t("add")}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16, width: "100%" }}>
          <Input label={t("name")} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          {!editTarget && (
            <Select
              label={t("role")}
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as CreateUserInput["role"] }))}
              options={[
                { value: "staff", label: t("roles.staff") },
                { value: "admin", label: t("roles.admin") },
              ]}
            />
          )}

          <div>
            <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 8, textTransform: "uppercase" }}>{t("portals")}</p>
            <div style={{ display: "flex", gap: 8 }}>
              {ALL_PORTALS.map((p) => {
                const portalVal = p as CreateUserInput["portalAccess"][number]
                return (
                  <button key={p} onClick={() => togglePortal(p)} style={{ padding: "0.25rem 0.75rem", borderRadius: "4px", border: "1px solid var(--border)", background: form.portalAccess.includes(portalVal) ? "var(--primary)" : "var(--surface-2)", color: form.portalAccess.includes(portalVal) ? "#000" : "var(--text)", cursor: "pointer", fontSize: 13 }}>
                    {p}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 8, textTransform: "uppercase" }}>{t("permissions")}</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>MAGAZIN</p>
                {MAG_MODULES.map((m) => (
                  <label key={m} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginBottom: 4, cursor: "pointer" }}>
                    <input type="checkbox" checked={!!(form.modulePermissions as Record<string, unknown>)[m]} onChange={() => toggleModule(m)} />
                    {m}
                  </label>
                ))}
              </div>
              <div>
                <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>COSTUMES</p>
                {COS_MODULES.map((m) => (
                  <label key={m} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginBottom: 4, cursor: "pointer" }}>
                    <input type="checkbox" checked={!!(form.modulePermissions as Record<string, unknown>)[m]} onChange={() => toggleModule(m)} />
                    {m}
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
            <Button variant="ghost" onClick={() => setFormOpen(false)}>{t("cancel")}</Button>
            <Button variant="primary" onClick={handleSave} loading={isSaving}>{t("save")}</Button>
          </div>
        </div>
      </Modal>

      {/* PIN Display Modal */}
      <Modal isOpen={!!pinModal} onClose={() => setPinModal(null)} title={t("pinGenerated")}>
        {pinModal && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16, alignItems: "center", padding: 16, minWidth: "280px" }}>
            <p style={{ color: "var(--text-muted)", fontSize: 14 }}>{pinModal.name}</p>
            <div style={{ fontSize: 40, fontWeight: 700, letterSpacing: "0.4em", color: "var(--primary)", fontVariantNumeric: "tabular-nums", padding: "8px 16px", background: "var(--surface-2)", borderRadius: "8px", border: "1px solid var(--border)" }}>
              {pinModal.pin}
            </div>
            <p style={{ color: "var(--warning)", fontSize: 13, textAlign: "center" }}>{t("pinWarning")}</p>
            <div style={{ display: "flex", gap: 8 }}>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => { navigator.clipboard.writeText(pinModal.pin).catch(() => {}) }}
              >
                {t("copyPin")}
              </Button>
              <Button variant="primary" onClick={() => setPinModal(null)}>{t("pinConfirm")}</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}