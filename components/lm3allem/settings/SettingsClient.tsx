"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { toast } from "@/hooks/useToast"
import { updateSystemSettings, type SerializedSettings } from "@/lib/actions/lm3allem/settings"
import { PORTAL_MODULES, type ModulePermissions } from "@/lib/permissions"
import React from "react"

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

interface Props { settings: SerializedSettings }

export function SettingsClient({ settings }: Props) {
  const t = useTranslations("lm3allem.settings")
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [maintenanceMode, setMaintenanceMode] = useState(settings.maintenanceMode)
  const [msgAr, setMsgAr] = useState(settings.maintenanceMessage_ar ?? "")
  // { portal: { module: boolean } } - the same shape every permission check reads
  const [perms, setPerms] = useState<ModulePermissions>(settings.defaultStaffPermissions)

  function togglePerm(portal: EditablePortal, module: string) {
    setPerms((p) => ({ ...p, [portal]: { ...(p[portal] ?? {}), [module]: !p[portal]?.[module] } }))
  }

  function handleSave() {
    startTransition(async () => {
      const res = await updateSystemSettings({
        id: settings.id,
        maintenanceMode,
        maintenanceMessage_ar: msgAr || null,
        defaultStaffPermissions: perms,
      })
      if (!res.ok) { toast(res.message || t("saveError"), "error"); return }
      toast(t("saved"), "success")
      router.refresh()
    })
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 32, maxWidth: "640px" }}>

      <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)",margin: 0 }}>
        {t("title")}
      </h1>

      {/* Maintenance */}
      <section style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "8px", padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <p style={{ margin: 0, fontWeight: 600 }}>{t("maintenanceMode")}</p>
            <p style={{ margin: "2px 0 0", fontSize: 13, color: "var(--text-muted)" }}>{t("maintenanceModeDesc")}</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={maintenanceMode}
            aria-label={t("maintenanceMode")}
            onClick={() => setMaintenanceMode((v) => !v)}
            style={{
              width: "58px", height: "32px", borderRadius: "16px", border: "none", cursor: "pointer",
              background: maintenanceMode ? "var(--danger)" : "color-mix(in srgb, var(--text-muted) 40%, transparent)",
              position: "relative", transition: "background 150ms",
            }}
          >
            <span style={{
              position: "absolute", top: "3px", insetInlineStart: maintenanceMode ? "calc(100% - 29px)" : "3px",
              width: "26px", height: "26px", borderRadius: "50%", background: "#fff",
              transition: "inset-inline-start 150ms",
            }} />
          </button>
        </div>
        {maintenanceMode && (
          <p style={{ padding: "0.5rem 0.75rem", background: "color-mix(in srgb, var(--warning) 10%, transparent)", border: "1px solid var(--warning)", borderRadius: "6px", fontSize: 13, color: "var(--warning)", margin: 0 }}>
            {t("maintenanceWarning")}
          </p>
        )}
        <Input label={t("maintenanceMessageAr")} value={msgAr} onChange={(e) => setMsgAr(e.target.value)} dir="rtl" />
      </section>

      {/* Default Staff Permissions */}
      <section style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "8px", padding: 20 }}>
        <p style={{ margin: "0 0 4px", fontWeight: 600 }}>{t("defaultStaffPermissions")}</p>
        <p style={{ margin: "0 0 16px", fontSize: 12, color: "var(--text-muted)" }}>{t("defaultStaffPermissionsDesc")}</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
          {(Object.keys(PORTAL_MODULES) as EditablePortal[]).map((portal) => (
            <div key={portal}>
              <p style={{ fontSize: 12, fontWeight: 700,color: "var(--text-muted)", margin: "0 0 8px" }}>{PORTAL_LABELS[portal]}</p>
              {PORTAL_MODULES[portal].map((m) => (
                <label key={m} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, marginBottom: 8, cursor: "pointer" }}>
                  <input type="checkbox" checked={!!perms[portal]?.[m]} onChange={() => togglePerm(portal, m)} />
                  {MODULE_LABELS[portal][m]}
                </label>
              ))}
            </div>
          ))}
        </div>
      </section>

      <Button variant="primary" onClick={handleSave} loading={isPending} style={{ alignSelf: "flex-end" }}>
        {t("save")}
      </Button>
    </div>
  )
}
