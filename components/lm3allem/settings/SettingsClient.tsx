"use client"

import { useState, useTransition } from "react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { toast } from "@/hooks/useToast"
import { updateSystemSettings, type SerializedSettings } from "@/lib/actions/lm3allem/settings"
import React from "react"

const MAG_MODULES = ["pos", "inventory", "caisse", "credits", "requests"]
const COS_MODULES = ["pos", "inventory", "clients", "rentals", "caisse"]

interface Props { settings: SerializedSettings; role: string }

export function SettingsClient({ settings, role }: Props) {
  const t = useTranslations("lm3allem.settings")
  const [isPending, startTransition] = useTransition()

  const [maintenanceMode, setMaintenanceMode] = useState(settings.maintenanceMode)
  const [msgAr, setMsgAr] = useState(settings.maintenanceMessage_ar ?? "")
  const [perms, setPerms] = useState<Record<string, unknown>>(settings.defaultStaffPermissions)

  function togglePerm(module: string) {
    setPerms((p) => ({ ...p, [module]: !p[module] }))
  }

  function handleSave() {
    startTransition(async () => {
      try {
        await updateSystemSettings({
          id: settings.id,
          maintenanceMode,
          maintenanceMessage_ar: msgAr || null,
          defaultStaffPermissions: perms,
        })
        toast(t("saved"), "success")
      } catch {
        toast(t("saveError"), "error")
      }
    })
  }

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 32, maxWidth: "640px" }}>

      <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.02em", margin: 0 }}>
        {t("title")}
      </h1>

      {/* Maintenance - superadmin only */}
      {role === "superadmin" && <section style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "8px", padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <p style={{ margin: 0, fontWeight: 600 }}>{t("maintenanceMode")}</p>
            <p style={{ margin: "2px 0 0", fontSize: 13, color: "var(--text-muted)" }}>{t("maintenanceModeDesc")}</p>
          </div>
          <button
            onClick={() => setMaintenanceMode((v) => !v)}
            style={{
              width: "48px", height: "26px", borderRadius: "13px", border: "none", cursor: "pointer",
              background: maintenanceMode ? "var(--danger)" : "color-mix(in srgb, var(--text-muted) 40%, transparent)",
              position: "relative", transition: "background 150ms",
            }}
          >
            <span style={{
              position: "absolute", top: "3px", insetInlineStart: maintenanceMode ? "calc(100% - 23px)" : "3px",
              width: "20px", height: "20px", borderRadius: "50%", background: "#fff",
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
      </section>}

      {/* Default Staff Permissions */}
      <section style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "8px", padding: 20 }}>
        <p style={{ margin: "0 0 16px", fontWeight: 600 }}>{t("defaultStaffPermissions")}</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)", margin: "0 0 8px" }}>MAGAZIN</p>
            {MAG_MODULES.map((m) => (
              <label key={m} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, marginBottom: 8, cursor: "pointer" }}>
                <input type="checkbox" checked={!!perms[m]} onChange={() => togglePerm(m)} />
                {m}
              </label>
            ))}
          </div>
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)", margin: "0 0 8px" }}>COSTUMES</p>
            {COS_MODULES.map((m) => (
              <label key={m} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, marginBottom: 8, cursor: "pointer" }}>
                <input type="checkbox" checked={!!perms[m]} onChange={() => togglePerm(m)} />
                {m}
              </label>
            ))}
          </div>
        </div>
      </section>

      <Button variant="primary" onClick={handleSave} loading={isPending} style={{ alignSelf: "flex-end" }}>
        {t("save")}
      </Button>
    </div>
  )
}