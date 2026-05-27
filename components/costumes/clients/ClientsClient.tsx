"use client"

import { useState, useEffect } from "react"
import { useRouter }           from "next/navigation"
import { PencilLine, Plus, Users } from "lucide-react"
import { DataTable, type Column } from "@/components/ui/DataTable"
import { Button }              from "@/components/ui/Button"
import { Modal }               from "@/components/ui/Modal"
import { Input }               from "@/components/ui/Input"
import { Textarea }            from "@/components/ui/Textarea"
import { toast }               from "@/hooks/useToast"
import { createClient, updateClient } from "@/lib/actions/costumes/clients"
import type { ClientForList, ClientInput } from "@/lib/actions/costumes/clients"

// ── Types ──────────────────────────────────────────────────────
interface Props {
  clients: ClientForList[]
  role:    string
  locale:  string
}

// ── Component ──────────────────────────────────────────────────
export function ClientsClient({ clients, role }: Props) {
  const router    = useRouter()
  const isAdmin   = role === "admin" || role === "superadmin"
  const [editing,  setEditing]  = useState<ClientForList | null>(null)
  const [creating, setCreating] = useState(false)

  const columns: Column<ClientForList>[] = [
    {
      key: "name", label: "Client", sortable: true,
      render: (_, row) => (
        <div>
          <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", margin: 0 }}>{row.name}</p>
          <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "2px 0 0" }}>{row.phone}</p>
        </div>
      ),
    },
    { key: "address", label: "Adresse", render: (_, row) => <span style={{ fontSize: 13, color: row.address ? "var(--text)" : "var(--text-muted)" }}>{row.address ?? "—"}</span> },
    { key: "rentalCount", label: "Locations", sortable: true, render: (_, row) => <span style={{ fontWeight: 600 }}>{row.rentalCount}</span> },
    {
      key: "createdAt", label: "Inscrit le", sortable: true,
      render: (_, row) => <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{new Date(row.createdAt).toLocaleDateString("fr-MA")}</span>,
    },
    {
      key: "id", label: "", width: 40,
      render: (_, row) => (
        <button onClick={() => setEditing(row)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4 }}>
          <PencilLine size={15} />
        </button>
      ),
    },
  ]

  return (
    <div style={{ padding: 8 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.02em", margin: 0 }}>Clients</h1>
        <Button size="sm" icon={<Plus size={14} />} onClick={() => setCreating(true)}>Nouveau client</Button>
      </div>

      {clients.length === 0 ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, paddingTop: 80 }}>
          <Users size={40} style={{ color: "var(--border)" }} />
          <p style={{ color: "var(--text-muted)", fontSize: 14, margin: 0 }}>Aucun client enregistré</p>
          <Button size="sm" onClick={() => setCreating(true)}>Ajouter le premier client</Button>
        </div>
      ) : (
        <DataTable columns={columns} data={clients} searchable searchKeys={["name", "phone"]} emptyMessage="Aucun résultat." />
      )}

      <ClientFormModal
        isOpen={creating || !!editing}
        mode={editing ? "edit" : "create"}
        client={editing}
        onClose={() => { setCreating(false); setEditing(null) }}
        onSuccess={() => { setCreating(false); setEditing(null); router.refresh() }}
      />
    </div>
  )
}

// ── Form modal ─────────────────────────────────────────────────
interface FormModalProps {
  isOpen:   boolean
  mode:     "create" | "edit"
  client:   ClientForList | null
  onClose:  () => void
  onSuccess: () => void
}

function ClientFormModal({ isOpen, mode, client, onClose, onSuccess }: FormModalProps) {
  const isEdit = mode === "edit"

  const [name,    setName]    = useState("")
  const [phone,   setPhone]   = useState("")
  const [address, setAddress] = useState("")
  const [notes,   setNotes]   = useState("")
  const [loading, setLoading] = useState(false)
  const [errors,  setErrors]  = useState<Record<string, string>>({})

  useEffect(() => {
    if (!isOpen) return
    if (isEdit && client) {
      setName(client.name); setPhone(client.phone)
      setAddress(client.address ?? ""); setNotes(client.notes ?? "")
    } else {
      setName(""); setPhone(""); setAddress(""); setNotes("")
    }
    setErrors({})
  }, [isOpen])

  const handleSave = async () => {
    const e: Record<string, string> = {}
    if (!name.trim())  e.name  = "Requis"
    if (!phone.trim()) e.phone = "Requis"
    setErrors(e)
    if (Object.keys(e).length) return

    setLoading(true)
    const input: ClientInput = { name, phone, address: address || undefined, notes: notes || undefined }

    try {
      if (isEdit && client) await updateClient(client.id, input)
      else                   await createClient(input)
      toast(isEdit ? "Client mis à jour" : "Client créé", "success")
      onSuccess()
    } catch (err: any) {
      // P2002 = unique constraint (phone)
      if (err.message?.includes("Unique") || err.message?.includes("phone")) {
        setErrors({ phone: "Ce numéro est déjà utilisé par un autre client" })
      } else {
        toast(err.message ?? "Erreur", "error")
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? "Modifier le client" : "Nouveau client"} size="md">
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Input label="Nom complet" value={name} onChange={e => setName(e.target.value)} error={errors.name} />
        <Input label="Téléphone" type="tel" value={phone} onChange={e => setPhone(e.target.value)} error={errors.phone} />
        <Input label="Adresse (optionnel)" value={address} onChange={e => setAddress(e.target.value)} />
        <Textarea label="Notes (optionnel)" value={notes} onChange={e => setNotes(e.target.value)} rows={3} />
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <Button variant="secondary" onClick={onClose}>Annuler</Button>
          <Button onClick={handleSave} loading={loading}>{isEdit ? "Enregistrer" : "Créer"}</Button>
        </div>
      </div>
    </Modal>
  )
}