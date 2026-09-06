import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api, type Workspace } from "@/api"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { FolderGit2, Plus, RefreshCw, ScrollText, Trash2, Pencil, Loader2, Monitor, Apple, Laptop, HardDrive } from "lucide-react"

type WsStatus = "connected" | "unreachable" | "unknown" | "local"

const STATUS_STYLE: Record<WsStatus, { dot: string; text: string; label: string }> = {
  connected: { dot: "bg-emerald-400", text: "text-emerald-300", label: "connected" },
  unreachable: { dot: "bg-red-400", text: "text-red-300", label: "unreachable" },
  unknown: { dot: "bg-neutral-500", text: "text-neutral-400", label: "not pinged" },
  local: { dot: "bg-sky-400", text: "text-sky-300", label: "local" },
}

function platformBadge(w: Workspace): { label: string; Icon: typeof Monitor; tint: string } {
  const path = (w.path || "").toLowerCase()
  const host = (w.host || "").toLowerCase()
  if (host.includes("windows") || path.startsWith("c:\\") || path.includes(":\\")) {
    return { label: "windows", Icon: Laptop, tint: "border-sky-500/30 bg-sky-500/10 text-sky-300" }
  }
  if (host.includes("mac") || path.startsWith("/users/aditya") || path.includes("/users/")) {
    return { label: "mac", Icon: Apple, tint: "border-neutral-700 bg-[#0b0e14] text-neutral-300" }
  }
  if (!host || host === "localhost" || host === "127.0.0.1") {
    return { label: "vps", Icon: Monitor, tint: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" }
  }
  // non-empty remote host that isn't mac → assume linux box (or generic SSH)
  return { label: "linux", Icon: HardDrive, tint: "border-amber-500/30 bg-amber-500/10 text-amber-300" }
}

function StatusChip({ ws }: { ws: Workspace }) {
  const s = STATUS_STYLE[(ws.status as WsStatus) ?? "unknown"] ?? STATUS_STYLE.unknown
  const live = ws.status === "connected" || ws.status === "local"
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border border-[#1e2430] px-2 py-0.5 text-[11px] ${s.text}`}
      style={{ background: "rgba(0,0,0,0.2)" }}>
      <span className={`size-2 rounded-full ${s.dot} ${live ? "animate-pulse" : ""}`} />
      {s.label}
      {ws.ping_ms != null && <span className="text-neutral-500">{Math.round(ws.ping_ms)}ms</span>}
    </span>
  )
}

function WorkspaceForm({
  initial,
  onClose,
  onSave,
}: {
  initial?: Workspace | null
  onClose: () => void
  onSave: (ws: Workspace) => Promise<unknown>
}) {
  const [id, setId] = useState(initial?.id ?? "")
  const [name, setName] = useState(initial?.name ?? "")
  const [path, setPath] = useState(initial?.path ?? "")
  const [host, setHost] = useState(initial?.host ?? "")
  const [kind, setKind] = useState(initial?.kind ?? "dir")
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const editing = !!initial

  async function submit() {
    if (!id.trim()) { setErr("ID required"); return }
    if (!path.trim()) { setErr("Path required"); return }
    setBusy(true); setErr(null)
    try {
      await onSave({ id: id.trim().toLowerCase(), name: name.trim() || id.trim(), path: path.trim(), host: host.trim(), kind } as Workspace)
      onClose()
    } catch (e) { setErr((e as Error).message); setBusy(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-lg border border-[#1e2430] bg-[#11151f] p-4" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-sm font-semibold">{editing ? `Edit workspace ${initial?.id}` : "New workspace"}</h2>
        {!editing && (
          <>
            <Label className="mt-3 block text-xs text-neutral-400">ID</Label>
            <Input value={id} onChange={(e) => setId(e.target.value)} placeholder="mac-dev" className="mt-1 border-[#1e2430] bg-[#0b0e14]" />
          </>
        )}
        <Label className="mt-3 block text-xs text-neutral-400">Name</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Mac Dev" className="mt-1 border-[#1e2430] bg-[#0b0e14]" />
        <Label className="mt-3 block text-xs text-neutral-400">Path (di host)</Label>
        <Input value={path} onChange={(e) => setPath(e.target.value)} placeholder="/Users/adityahimawan/Development" className="mt-1 border-[#1e2430] bg-[#0b0e14]" />
        <Label className="mt-3 block text-xs text-neutral-400">SSH host (kosong = lokal VPS)</Label>
        <Input value={host} onChange={(e) => setHost(e.target.value)} placeholder="mac-tailscale" className="mt-1 border-[#1e2430] bg-[#0b0e14]" />
        <Label className="mt-3 block text-xs text-neutral-400">Kind</Label>
        <Select value={kind} onValueChange={setKind}>
          <SelectTrigger className="mt-1 w-full border-[#1e2430] bg-[#0b0e14] text-sm data-[size=default]:h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="border-[#1e2430] bg-[#11151f]">
            <SelectItem value="dir" className="text-sm">dir</SelectItem>
            <SelectItem value="git" className="text-sm">git</SelectItem>
            <SelectItem value="scratch" className="text-sm">scratch</SelectItem>
          </SelectContent>
        </Select>
        {err && <p className="mt-3 text-xs text-red-400">{err}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" disabled={busy} onClick={submit} className="bg-[#10e0dd] text-black hover:bg-[#10e0dd]/90">
            {busy ? "…" : editing ? "Save" : "Create"}
          </Button>
        </div>
      </div>
    </div>
  )
}

function LogsDialog({ ws, onClose }: { ws: Workspace; onClose: () => void }) {
  const logs = useQuery({
    queryKey: ["ws-logs", ws.id],
    queryFn: () => api<string[]>(`/api/workspaces/${ws.id}/logs`),
  })
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="flex max-h-[70vh] w-full max-w-2xl flex-col rounded-lg border border-[#1e2430] bg-[#11151f] p-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold">Logs — {ws.name}</h2>
          <Button variant="ghost" size="sm" className="ml-auto" onClick={onClose}>✕</Button>
        </div>
        <Separator className="my-2" />
        <pre className="flex-1 overflow-auto whitespace-pre-wrap break-all rounded-md border border-[#1e2430] bg-[#0b0e14] p-3 font-mono text-[11px] leading-relaxed text-neutral-300">
          {logs.isLoading ? "Loading…" : logs.data?.length ? logs.data.join("\n") : "No activity matched this workspace."}
        </pre>
      </div>
    </div>
  )
}

export default function WorkspacesPage() {
  const qc = useQueryClient()
  const [form, setForm] = useState<{ open: boolean; edit: Workspace | null }>({ open: false, edit: null })
  const [logsFor, setLogsFor] = useState<Workspace | null>(null)
  const [pinging, setPinging] = useState<string | null>(null)

  const workspaces = useQuery({
    queryKey: ["workspaces"],
    queryFn: () => api<Workspace[]>("/api/workspaces"),
    refetchInterval: 30_000,
  })

  const save = useMutation({
    mutationFn: (ws: Workspace) =>
      form.edit
        ? api(`/api/workspaces/${form.edit.id}`, { method: "PUT", body: JSON.stringify(ws) })
        : api("/api/workspaces", { method: "POST", body: JSON.stringify(ws) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workspaces"] }),
  })
  const del = useMutation({
    mutationFn: (id: string) => api(`/api/workspaces/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workspaces"] }),
  })

  async function pingOne(ws: Workspace) {
    setPinging(ws.id)
    try {
      const updated = await api<Workspace>(`/api/workspaces/${ws.id}/ping`)
      qc.setQueryData<Workspace[]>(["workspaces"], (old) =>
        old ? old.map((w) => (w.id === ws.id ? { ...w, ...updated } : w)) : old)
    } catch { /* leave stale */ }
    setPinging(null)
  }

  async function pingAll() {
    const list = workspaces.data ?? []
    for (const ws of list) {
      await pingOne(ws)
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl p-4">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-semibold tracking-tight">Workspaces</h1>
        <span className="rounded bg-[#0b0e14] px-1.5 py-0.5 text-[10px] text-neutral-400">
          {workspaces.data?.length ?? 0}
        </span>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={pingAll} disabled={pinging != null}>
            <RefreshCw className={`size-3.5 ${pinging ? "animate-spin" : ""}`} /> Ping all
          </Button>
          <Button size="sm" onClick={() => setForm({ open: true, edit: null })} className="bg-[#10e0dd] text-black hover:bg-[#10e0dd]/90">
            <Plus className="size-3.5" /> New workspace
          </Button>
        </div>
      </div>
      <p className="mt-1 text-xs text-neutral-500">
        Shared source of truth: <code className="text-neutral-400">~/.hermes/workspaces.json</code> — host kosong berarti lokal VPS.
      </p>

      {workspaces.isLoading ? (
        <p className="mt-6 text-sm text-neutral-400">Loading…</p>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          {(workspaces.data ?? []).map((ws) => {
            const plat = platformBadge(ws)
            return (
            <Card key={ws.id} className="border-[#1e2430] bg-[#11151f]">
              <CardContent className="p-3.5">
                <div className="flex items-start gap-2">
                  <div className="flex aspect-square size-8 shrink-0 items-center justify-center rounded-lg bg-[#161b27]">
                    <FolderGit2 className="size-4 text-[#10e0dd]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <h3 className="truncate text-sm font-semibold">{ws.name}</h3>
                      <span className="rounded bg-[#0b0e14] px-1.5 py-0.5 text-[10px] text-neutral-500">{ws.id}</span>
                      <Badge variant="outline" className={`gap-1 text-[10px] ${plat.tint}`}>
                        <plat.Icon className="size-3" /> {plat.label}
                      </Badge>
                    </div>
                    <p className="mt-0.5 truncate font-mono text-[11px] text-neutral-400" title={ws.path}>{ws.path}</p>
                    <p className="mt-0.5 text-[11px] text-neutral-500">
                      host: <span className="font-mono">{ws.host || "localhost"}</span> · kind: {ws.kind}
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  <StatusChip ws={ws} />
                  {ws.status_message && (
                    <span className="max-w-48 truncate text-[10px] text-neutral-500" title={ws.status_message}>
                      {ws.status_message}
                    </span>
                  )}
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  <Button variant="outline" size="sm" onClick={() => pingOne(ws)} disabled={pinging === ws.id}>
                    {pinging === ws.id ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />} Ping
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setLogsFor(ws)}>
                    <ScrollText className="size-3.5" /> Logs
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setForm({ open: true, edit: ws })}>
                    <Pencil className="size-3.5" /> Edit
                  </Button>
                  <Button
                    variant="outline" size="sm"
                    className="ml-auto border-red-500/30 text-red-300 hover:bg-red-500/10 hover:text-red-200"
                    onClick={() => { if (confirm(`Delete workspace "${ws.name}"?`)) del.mutate(ws.id) }}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
                {del.isError && <p className="mt-2 text-xs text-red-400">{(del.error as Error).message}</p>}
              </CardContent>
            </Card>
            )
          })}
        </div>
      )}

      {form.open && (
        <WorkspaceForm
          initial={form.edit}
          onClose={() => setForm({ open: false, edit: null })}
          onSave={save.mutateAsync}
        />
      )}
      {logsFor && <LogsDialog ws={logsFor} onClose={() => setLogsFor(null)} />}
    </div>
  )
}
