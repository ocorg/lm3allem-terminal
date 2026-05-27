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
  const [isPending, startTransition] = useTransition()

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
    setForm({ name: u.name, role: u.role as CreateUserInput["role"], portalAccess: u.portalAccess, modulePermissions: u.modulePermissions })
    setFormOpen(true)
  }

  function togglePortal(portal: string) {
    setForm((f) => ({
      ...f,
      portalAccess: f.portalAccess.includes(portal)
        ? f.portalAccess.filter((p) => p !== portal)
        : [...f.portalAccess, portal],
    }))
  }

  function toggleModule(module: string) {
    setForm((f) => {
      const perms = { ...f.modulePermissions }
      perms[module] = !perms[module]
      return { ...f, modulePermissions: perms }
    })
  }

  function handleSave() {
    startTransition(async () => {
      try {
        if (editTarget) {
          await updateUser({ id: editTarget.id, ...form })
          toast("Utilisateur mis à jour", "success")
          setFormOpen(false)
          router.refresh()
        } else {
          const { plainPin, user } = await createUser(form)
          setFormOpen(false)
          setPinModal({ name: user.name, pin: plainPin })
          router.refresh()
        }
      } catch {
        toast("Erreur lors de l'enregistrement", "error")
      }
    })
  }

  async function handleToggleActive(u: SerializedUser) {
    if (u.role === "superadmin") return
    const ok = await confirm({ title: u.isActive ? t("confirmDeactivate") : `Activer ${u.name} ?`, message: "", variant: u.isActive ? "danger" : "primary" })
    if (!ok) return
    startTransition(async () => {
      try {
        await toggleUserActive(u.id)
        toast(u.isActive ? "Utilisateur désactivé" : "Utilisateur activé", "success")
        router.refresh()
      } catch (e: any) {
        toast(e?.message ?? "Erreur", "error")
      }
    })
  }

  async function handleResetPin(u: SerializedUser) {
    const ok = await confirm({ title: `Réinitialiser le PIN de ${u.name} ?`, message: "", variant: "primary" })
    if (!ok) return
    startTransition(async () => {
      try {
        const { plainPin } = await resetUserPin(u.id)
        setPinModal({ name: u.name, pin: plainPin })
      } catch {
        toast("Erreur lors de la réinitialisation", "error")
      }
    })
  }

  const isSuperadmin = (u: SerializedUser) => u.role === "superadmin"

  return (
    <div style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {modal}

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <Button variant="primary" onClick={openCreate}>{t("add")}</Button>
      </div>

      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "8px", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
          <thead>
            <tr style={{ background: "var(--surface-2)" }}>
              {[t("name"), t("role"), t("portals"), t("active"), "Actions"].map((h, i) => (
                <th key={i} style={{ padding: "0.75rem 1rem", textAlign: "start", fontWeight: 600, fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em", borderBottom: "1px solid var(--border)" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {initialUsers.map((u, i) => (
              <tr key={u.id} style={{ borderBottom: i < initialUsers.length - 1 ? "1px solid var(--border)" : "none", opacity: u.isActive ? 1 : 0.55 }}>
                <td style={{ padding: "0.75rem 1rem", fontWeight: 600 }}>{u.name}</td>
                <td style={{ padding: "0.75rem 1rem" }}>
                  <Badge variant={u.role === "superadmin" ? "primary" : u.role === "admin" ? "info" : "default"}>
                    {t(`roles.${u.role}`)}
                  </Badge>
                </td>
                <td style={{ padding: "0.75rem 1rem" }}>
                  <div style={{ display: "flex", gap: "0.25rem", flexWrap: "wrap" }}>
                    {u.portalAccess.map((p) => <Badge key={p} variant="default">{p}</Badge>)}
                  </div>
                </td>
                <td style={{ padding: "0.75rem 1rem" }}>
                  <Badge variant={u.isActive ? "success" : "default"}>{u.isActive ? t("active") : t("inactive")}</Badge>
                </td>
                <td style={{ padding: "0.75rem 1rem" }}>
                  <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                    <Button variant="ghost" size="sm" onClick={() => openEdit(u)}>{t("edit")}</Button>
                    <Button variant="ghost" size="sm" onClick={() => handleResetPin(u)}>{t("resetPin")}</Button>
                    {!isSuperadmin(u) && (
                      <Button variant={u.isActive ? "danger" : "primary"} size="sm" onClick={() => handleToggleActive(u)} loading={isPending}>
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
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem", minWidth: "400px" }}>
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
            <p style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: "0.5rem", textTransform: "uppercase" }}>{t("portals")}</p>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              {ALL_PORTALS.map((p) => (
                <button key={p} onClick={() => togglePortal(p)} style={{ padding: "0.25rem 0.75rem", borderRadius: "4px", border: "1px solid var(--border)", background: form.portalAccess.includes(p) ? "var(--primary)" : "var(--surface-2)", color: form.portalAccess.includes(p) ? "#000" : "var(--text)", cursor: "pointer", fontSize: "0.8rem" }}>
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: "0.5rem", textTransform: "uppercase" }}>{t("permissions")}</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              <div>
                <p style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>MAGAZIN</p>
                {MAG_MODULES.map((m) => (
                  <label key={m} style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.8rem", marginBottom: "0.25rem", cursor: "pointer" }}>
                    <input type="checkbox" checked={!!form.modulePermissions[m]} onChange={() => toggleModule(m)} />
                    {m}
                  </label>
                ))}
              </div>
              <div>
                <p style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>COSTUMES</p>
                {COS_MODULES.map((m) => (
                  <label key={m} style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.8rem", marginBottom: "0.25rem", cursor: "pointer" }}>
                    <input type="checkbox" checked={!!form.modulePermissions[m]} onChange={() => toggleModule(m)} />
                    {m}
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
            <Button variant="ghost" onClick={() => setFormOpen(false)}>Annuler</Button>
            <Button variant="primary" onClick={handleSave} loading={isPending}>Enregistrer</Button>
          </div>
        </div>
      </Modal>

      {/* PIN Display Modal */}
      <Modal isOpen={!!pinModal} onClose={() => setPinModal(null)} title={t("pinGenerated")}>
        {pinModal && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem", alignItems: "center", padding: "1rem", minWidth: "280px" }}>
            <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>{pinModal.name}</p>
            <div style={{ fontSize: "2.5rem", fontWeight: 700, letterSpacing: "0.4em", color: "var(--primary)", fontVariantNumeric: "tabular-nums", padding: "0.5rem 1rem", background: "var(--surface-2)", borderRadius: "8px", border: "1px solid var(--border)" }}>
              {pinModal.pin}
            </div>
            <p style={{ color: "var(--warning)", fontSize: "0.8rem", textAlign: "center" }}>{t("pinWarning")}</p>
            <Button variant="primary" onClick={() => setPinModal(null)}>OK, noté</Button>
          </div>
        )}
      </Modal>
    </div>
  )
}