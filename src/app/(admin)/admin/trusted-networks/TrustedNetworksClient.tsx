"use client"

import { useState } from "react"
import { Network, Plus, Save, Trash2, Wifi } from "lucide-react"
import { toast } from "sonner"
import { ConfirmModal } from "@/components/ui/confirm-modal"

type TrustedNetwork = { id: number; name: string; description: string | null; cidrs: string[]; enabled: boolean }

export default function TrustedNetworksClient({ initialNetworks }: { initialNetworks: TrustedNetwork[] }) {
  const [networks, setNetworks] = useState(initialNetworks)
  const [draft, setDraft] = useState({ name: "", description: "", cidrs: "" })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<TrustedNetwork | null>(null)

  async function createNetwork() {
    setSaving(true)
    const response = await fetch("/api/admin/trusted-networks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft) })
    const body = await response.json().catch(() => ({}))
    setSaving(false)
    if (!response.ok) return toast.error(body.error ?? "Could not save network")
    setNetworks((current) => [...current, body].sort((a, b) => a.name.localeCompare(b.name)))
    setDraft({ name: "", description: "", cidrs: "" })
    toast.success("Trusted network added")
  }

  async function toggle(network: TrustedNetwork) {
    const response = await fetch(`/api/admin/trusted-networks/${network.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...network, cidrs: network.cidrs.join("\n"), enabled: !network.enabled }) })
    if (!response.ok) return toast.error("Could not update network")
    setNetworks((current) => current.map((item) => item.id === network.id ? { ...item, enabled: !item.enabled } : item))
  }

  async function remove() {
    if (!deleting) return
    const response = await fetch(`/api/admin/trusted-networks/${deleting.id}`, { method: "DELETE" })
    if (!response.ok) { toast.error("This network may still be assigned to an assessment"); return }
    setNetworks((current) => current.filter((item) => item.id !== deleting.id))
    setDeleting(null)
    toast.success("Trusted network deleted")
  }

  return <div className="mx-auto max-w-6xl space-y-6 px-6 py-7">
    <ConfirmModal open={!!deleting} title="Delete trusted network?" description="Assessments using this network will no longer enforce it. This cannot be undone." confirmText="Delete network" isDestructive onConfirm={remove} onCancel={() => setDeleting(null)} />
    <div><p className="text-xs font-semibold uppercase tracking-wider text-primary">Access control</p><h1 className="mt-1 text-2xl font-semibold text-slate-900">Trusted campus networks</h1><p className="mt-1 text-sm text-muted-foreground">Approve the public IP addresses used by campus Wi-Fi. Lecturers can only enable network enforcement when an active network exists.</p></div>
    <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
      <section className="h-fit rounded-lg border bg-white p-5 shadow-sm"><div className="mb-4 flex items-center gap-2 font-semibold"><Plus size={16}/> Add network</div><div className="space-y-3">
        <label className="block text-xs font-medium">Network name<input className="mt-1 h-10 w-full rounded-md border px-3 text-sm" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Main campus Wi-Fi" /></label>
        <label className="block text-xs font-medium">Description<input className="mt-1 h-10 w-full rounded-md border px-3 text-sm" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="Optional student guidance" /></label>
        <label className="block text-xs font-medium">Public IP addresses or CIDRs<textarea className="mt-1 min-h-28 w-full rounded-md border p-3 font-mono text-xs" value={draft.cidrs} onChange={(e) => setDraft({ ...draft, cidrs: e.target.value })} placeholder={"203.0.113.24\n203.0.113.0/24"} /></label>
        <p className="text-[11px] leading-relaxed text-muted-foreground">Ask campus IT for the outbound public IPv4 ranges. Wi-Fi names cannot be read by web browsers.</p>
        <button onClick={createNetwork} disabled={saving} className="flex h-10 w-full items-center justify-center gap-2 rounded-md bg-primary text-sm font-semibold text-white disabled:opacity-50"><Save size={14}/>{saving ? "Saving…" : "Save network"}</button>
      </div></section>
      <section className="space-y-3">{networks.length === 0 ? <div className="rounded-lg border border-dashed bg-white p-12 text-center"><Network className="mx-auto mb-3 text-muted-foreground"/><p className="font-medium">No trusted networks configured</p><p className="mt-1 text-sm text-muted-foreground">Network enforcement will remain unavailable to lecturers.</p></div> : networks.map((network) => <div key={network.id} className="flex items-start justify-between gap-4 rounded-lg border bg-white p-5 shadow-sm"><div className="flex gap-3"><div className={`rounded-lg p-2 ${network.enabled ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}><Wifi size={18}/></div><div><div className="flex items-center gap-2"><h2 className="font-semibold">{network.name}</h2><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${network.enabled ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{network.enabled ? "ACTIVE" : "DISABLED"}</span></div>{network.description && <p className="mt-1 text-sm text-muted-foreground">{network.description}</p>}<div className="mt-2 flex flex-wrap gap-1.5">{network.cidrs.map((cidr) => <code key={cidr} className="rounded bg-slate-100 px-2 py-1 text-xs">{cidr}</code>)}</div></div></div><div className="flex gap-2"><button onClick={() => toggle(network)} className="rounded-md border px-3 py-1.5 text-xs font-medium">{network.enabled ? "Disable" : "Enable"}</button><button onClick={() => setDeleting(network)} className="rounded-md border border-rose-200 p-2 text-rose-600"><Trash2 size={14}/></button></div></div>)}</section>
    </div>
  </div>
}
