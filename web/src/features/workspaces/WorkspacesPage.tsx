import { useEffect, useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api, type PingPoint, type Workspace } from "@/api"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { FolderGit2, Plus, RefreshCw, ScrollText, Trash2, Pencil, Loader2, Monitor, Apple, Laptop, HardDrive, Radio } from "lucide-react"

type WsStatus = "connected" | "unreachable" | "unknown" | "local"

const STATUS_STYLE: Record<WsStatus, { dot: string; text: string; label: string }> = {
  connected: { dot: "bg-emerald-400", text: "text-emerald-300", label: "connected" },
  unreachable: { dot: "bg-red-400", text: "text-red-300", label: "unreachable" },
  unknown: { dot: "bg-neutral-500", text: "text-neutral-400", label: "not pinged" },
  local: { dot: "bg-sky-400", text: "text-sky-300", label: "local" },
}

// known SSH hosts for the transport select in the form
const SSH_PRESETS: Record<string, { path: string; name: string; os: string }> = {
  "mac-tailscale": { path: "/Users/adityahimawan/Development", name: "Mac Dev", os: "mac" },
  "windows-tailscale": { path: "C:\\Users\\user", name: "Windows Dev", os: "windows" },
}

const OS_OPTIONS = [
  { value: "mac", label: "macOS" },
  { value: "windows", label: "Windows" },
  { value: "linux", label: "Linux" },
]

function platformBadge(w: Workspace): { label: string; Icon: typeof Monitor; tint: string } {
  const os = (w.os || "").toLowerCase()
  const path = (w.path || "").toLowerCase()
  const host = (w.host || "").toLowerCase()
  if (os === "windows" || host.includes("windows") || path.startsWith("c:\\") || path.includes(":\\")) {
    return { label: "windows", Icon: Laptop, tint: "border-sky-500/30 bg-sky-500/10 text-sky-300" }
  }
  if (os === "mac" || host.includes("mac") || path.startsWith("/users/aditya") || path.includes("/users/")) {
    return { label: "mac", Icon: Apple, tint: "border-neutral-700 bg-[#0b0e14] text-neutral-300" }
  }
  if (!host || host === "localhost" || host === "127.0.0.1" || os === "linux") {
    return { label: "vps", Icon: Monitor, tint: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" }
  }
  return { label: "linux", Icon: HardDrive, tint: "border-amber-500/30 bg-amber-500/10 text-amber-300" }
}

// EkgTrace: heart-rate monitor style ping indicator driven by REAL ping data.
// The trace is a polyline of the last N ping latencies (ms), min-max normalized
// per window so variation reads like a heartbeat. Failing pings flatline at the
// baseline. A glowing accent dot rides the same generated path via CSS
// offset-path, 2.4s linear infinite sweep (ekg-sweep keyframes in index.css).
function EkgTrace({ points, live, ok }: { points: PingPoint[] | undefined; live: boolean; ok: boolean }) {
  const boxRef = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(0)
  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setW(el.clientWidth))
    ro.observe(el)
    setW(el.clientWidth)
    return () => ro.disconnect()
  }, [])

  const pts = (points ?? []).slice(-30)
  const last = pts[pts.length - 1]
  const accent = ok ? "#10e0dd" : "#f87171"
  const H = 36, BASE = 30, TOP = 6

  const good = pts.filter((p) => p.ok && p.ms != null).map((p) => p.ms!)
  const min = good.length ? Math.min(...good) : 0
  const max = good.length ? Math.max(...good) : 0
  const yOf = (p: PingPoint) => {
    if (!p.ok || p.ms == null) return BASE // fail -> flatline
    if (max - min < 1) return BASE - (BASE - TOP) / 2 // flat data -> mid line
    return BASE - ((p.ms - min) / (max - min)) * (BASE - TOP)
  }

  let d = ""
  if (w > 0 && pts.length >= 2) {
    d = pts
      .map((p, i) => {
        const x = (i / (pts.length - 1)) * (w - 2) + 1
        return `${i ? "L" : "M"}${x.toFixed(1)} ${yOf(p).toFixed(1)}`
      })
      .join(" ")
  } else if (w > 0) {
    d = `M1 ${BASE} H${w - 1}`
  }

  return (
    <div
      ref={boxRef}
      className={`relative h-9 w-full overflow-hidden rounded-md border border-[#1e2430] bg-[#0b0e14] ${live ? "shadow-[inset_0_0_12px_rgba(16,224,221,0.05)]" : ""}`}
      title={last
        ? `${last.ok ? "ok" : "fail"} ${last.ms != null ? Math.round(last.ms) + "ms" : ""} · ${good.length ? `${Math.round(min)}–${Math.round(max)}ms` : ""}`
        : "no pings yet"}
    >
      {w > 0 && (
        <svg viewBox={`0 0 ${w} ${H}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
          <path d={d} fill="none" stroke={accent} strokeOpacity="0.28" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
        </svg>
      )}
      {live && d && (
        <span
          className="absolute left-0 top-0 size-[7px] rounded-full"
          style={{
            offsetPath: `path("${d}")`,
            offsetRotate: "0deg",
            background: accent,
            boxShadow: `0 0 6px 2px ${accent}99, 0 0 12px 4px ${accent}44`,
            animation: "ekg-sweep 2.4s linear infinite",
          }}
        />
      )}
      {!live && (
        <span className="absolute inset-0 flex items-center justify-center text-[10px] text-neutral-600">
          {pts.length ? "offline" : "no pings yet"}
        </span>
      )}
    </div>
  )
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
  const initialTransport = initial ? (initial.host ? "ssh" : "local") : "local"
  const [transport, setTransport] = useState(initialTransport)
  const [id, setId] = useState(initial?.id ?? "")
  const [name, setName] = useState(initial?.name ?? "")
  const [path, setPath] = useState(initial?.path ?? "")
  const [host, setHost] = useState(initial?.host ?? "")
  const [os, setOs] = useState(initial?.os ?? "")
  const [kind, setKind] = useState(initial?.kind ?? "dir")
  const [note, setNote] = useState(initial?.note ?? "")
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const editing = !!initial

  function pickTransport(v: string) {
    setTransport(v)
    if (v === "local") {
      setHost("")
      if (!editing) setOs("linux")
    } else if (!editing) {
      // prefill first preset host + its default path + OS
      const first = Object.entries(SSH_PRESETS)[0]
      setHost(first[0])
      setOs(first[1].os)
      if (!path.trim()) setPath(first[1].path)
    }
  }

  function pickHost(v: string) {
    setHost(v)
    const preset = SSH_PRESETS[v]
    if (preset) {
      setOs(preset.os)
      if (!editing && !path.trim()) setPath(preset.path)
    }
  }

  async function submit() {
    if (!id.trim()) { setErr("ID required"); return }
    if (!path.trim()) { setErr("Path required"); return }
    if (transport === "ssh" && !host.trim()) { setErr("SSH host required"); return }
    setBusy(true); setErr(null)
    try {
      await onSave({ id: id.trim().toLowerCase(), name: name.trim() || id.trim(), path: path.trim(), host: transport === "ssh" ? host.trim() : "", os, kind, note: note.trim() } as Workspace)
      onClose()
    } catch (e) { setErr((e as Error).message); setBusy(false) }
  }

  const inpCls = "border-[#1e2430] bg-[#0b0e14]"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-lg border border-[#1e2430] bg-[#11151f] p-4" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-sm font-semibold">{editing ? `Edit workspace ${initial?.id}` : "New workspace"}</h2>
        {!editing && (
          <>
            <Label className="mt-3 block text-xs text-neutral-400">ID</Label>
            <Input value={id} onChange={(e) => setId(e.target.value)} placeholder="mac-dev" className={`mt-1 ${inpCls}`} />
          </>
        )}
        <Label className="mt-3 block text-xs text-neutral-400">Transport</Label>
        <Select value={transport} onValueChange={pickTransport}>
          <SelectTrigger className={`mt-1 w-full text-sm data-[size=default]:h-9 ${inpCls}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="border-[#1e2430] bg-[#11151f]">
            <SelectItem value="local" className="text-sm">Local (VPS ini)</SelectItem>
            <SelectItem value="ssh" className="text-sm">SSH (remote host)</SelectItem>
          </SelectContent>
        </Select>
        {transport === "ssh" && (
          <>
            <Label className="mt-3 block text-xs text-neutral-400">SSH host</Label>
            <Select value={host} onValueChange={pickHost}>
              <SelectTrigger className={`mt-1 w-full text-sm data-[size=default]:h-9 ${inpCls}`}>
                <SelectValue placeholder="pilih host" />
              </SelectTrigger>
              <SelectContent className="border-[#1e2430] bg-[#11151f]">
                {Object.keys(SSH_PRESETS).map((h) => (
                  <SelectItem key={h} value={h} className="text-sm">{h}</SelectItem>
                ))}
                {host && !SSH_PRESETS[host] && <SelectItem value={host} className="text-sm">{host}</SelectItem>}
              </SelectContent>
            </Select>
          </>
        )}
        <Label className="mt-3 block text-xs text-neutral-400">Name</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Mac Dev" className={`mt-1 ${inpCls}`} />
        <Label className="mt-3 block text-xs text-neutral-400">OS</Label>
        <Select value={os || "__auto"} onValueChange={(v) => setOs(v === "__auto" ? "" : v)}>
          <SelectTrigger className={`mt-1 w-full text-sm data-[size=default]:h-9 ${inpCls}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="border-[#1e2430] bg-[#11151f]">
            {OS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value} className="text-sm">{o.label}</SelectItem>
            ))}
            <SelectItem value="__auto" className="text-sm text-neutral-400">Auto-detect (dari host/path)</SelectItem>
          </SelectContent>
        </Select>
        <Label className="mt-3 block text-xs text-neutral-400">Path (di host)</Label>
        <Input value={path} onChange={(e) => setPath(e.target.value)}
          placeholder={transport === "ssh" ? SSH_PRESETS[host]?.path ?? "/Users/... atau C:\\..." : "/home/adityahimaone/apps"}
          className={`mt-1 ${inpCls}`} />
        <Label className="mt-3 block text-xs text-neutral-400">Prequest / constraints</Label>
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          placeholder="Tech stack, requirements, limitasi agent di workspace ini… (mis. 'Next.js 15 + Tailwind, no new deps, pnpm only')"
          className={`mt-1 min-h-0 resize-y text-sm ${inpCls}`}
        />
        <Label className="mt-3 block text-xs text-neutral-400">Kind</Label>
        <Select value={kind} onValueChange={setKind}>
          <SelectTrigger className={`mt-1 w-full text-sm data-[size=default]:h-9 ${inpCls}`}>
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

const AUTO_PING_MS = 30_000

export default function WorkspacesPage() {
  const qc = useQueryClient()
  const [form, setForm] = useState<{ open: boolean; edit: Workspace | null }>({ open: false, edit: null })
  const [logsFor, setLogsFor] = useState<Workspace | null>(null)
  const [pinging, setPinging] = useState<string | null>(null)
  const [autoPing, setAutoPing] = useState(true)
  const pingingRef = useRef(false)

  const workspaces = useQuery({
    queryKey: ["workspaces"],
    queryFn: () => api<Workspace[]>("/api/workspaces"),
    refetchInterval: 60_000,
  })

  // background auto-ping: probe all workspaces every 30s without user trigger,
  // then merge statuses into the query cache
  useEffect(() => {
    if (!autoPing) return
    let stop = false
    const tick = async () => {
      if (stop || pingingRef.current || document.hidden) return
      pingingRef.current = true
      try {
        const updated = await api<Workspace[]>("/api/workspaces/ping", { method: "POST" })
        if (!stop) qc.setQueryData<Workspace[]>(["workspaces"], updated)
      } catch { /* keep stale */ }
      pingingRef.current = false
    }
    tick()
    const iv = setInterval(tick, AUTO_PING_MS)
    return () => { stop = true; clearInterval(iv); pingingRef.current = false }
  }, [autoPing, qc])

  const pingHistories = useQuery({
    queryKey: ["ws-ping-history"],
    queryFn: async () => {
      const ids = (workspaces.data ?? []).map((w) => w.id)
      const entries = await Promise.all(
        ids.map(async (id) => [id, await api<PingPoint[]>(`/api/workspaces/${id}/history`)] as const),
      )
      return Object.fromEntries(entries) as Record<string, PingPoint[]>
    },
    enabled: (workspaces.data?.length ?? 0) > 0,
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
      qc.invalidateQueries({ queryKey: ["ws-ping-history"] })
    } catch { /* leave stale */ }
    setPinging(null)
  }

  async function pingAll() {
    setPinging("__all__")
    try {
      const updated = await api<Workspace[]>("/api/workspaces/ping", { method: "POST" })
      qc.setQueryData<Workspace[]>(["workspaces"], updated)
      qc.invalidateQueries({ queryKey: ["ws-ping-history"] })
    } catch { /* keep stale */ }
    setPinging(null)
  }

  return (
    <div className="mx-auto w-full max-w-5xl p-4">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-semibold tracking-tight">Workspaces</h1>
        <span className="rounded bg-[#0b0e14] px-1.5 py-0.5 text-[10px] text-neutral-400">
          {workspaces.data?.length ?? 0}
        </span>
        <div className="ml-auto flex gap-2">
          <Button
            variant={autoPing ? "default" : "outline"} size="sm"
            onClick={() => setAutoPing((v) => !v)}
            className={autoPing ? "bg-[#10e0dd] text-black hover:bg-[#10e0dd]/90" : ""}
            title="Auto ping semua workspace tiap 30 detik"
          >
            <Radio className={`size-3.5 ${autoPing ? "animate-pulse" : ""}`} /> Auto 30s
          </Button>
          <Button variant="outline" size="sm" onClick={pingAll} disabled={pinging != null}>
            <RefreshCw className={`size-3.5 ${pinging === "__all__" ? "animate-spin" : ""}`} /> Ping all
          </Button>
          <Button size="sm" onClick={() => setForm({ open: true, edit: null })} className="bg-[#10e0dd] text-black hover:bg-[#10e0dd]/90">
            <Plus className="size-3.5" /> New workspace
          </Button>
        </div>
      </div>
      <p className="mt-1 text-xs text-neutral-500">
        Shared source of truth: <code className="text-neutral-400">~/.hermes/workspaces.json</code> — tiap ping tersimpan di history (wave) + workspace logs.
      </p>

      {workspaces.isLoading ? (
        <p className="mt-6 text-sm text-neutral-400">Loading…</p>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          {(workspaces.data ?? []).map((ws) => {
            const plat = platformBadge(ws)
            const isSsh = !!ws.host && ws.host !== "localhost" && ws.host !== "127.0.0.1"
            const live = ws.status === "connected" || ws.status === "local"
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
                      {isSsh && (
                        <Badge variant="outline" className="border-violet-500/30 bg-violet-500/10 text-[10px] text-violet-300">
                          ssh
                        </Badge>
                      )}
                      <Badge variant="outline" className={`gap-1 text-[10px] ${plat.tint}`}>
                        <plat.Icon className="size-3" /> {plat.label}
                      </Badge>
                    </div>
                    <p className="mt-0.5 truncate font-mono text-[11px] text-neutral-400" title={ws.path}>{ws.path}</p>
                    <p className="mt-0.5 text-[11px] text-neutral-500">
                      host: <span className="font-mono">{ws.host || "localhost"}</span> · kind: {ws.kind}
                    </p>
                    {ws.note && (
                      <p className="mt-1 line-clamp-2 whitespace-pre-wrap break-words rounded border border-[#1e2430]/60 bg-[#0b0e14] px-2 py-1 text-[10px] leading-relaxed text-neutral-400" title={ws.note}>
                        {ws.note}
                      </p>
                    )}
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

                <div className="mt-3">
                  <EkgTrace points={pingHistories.data?.[ws.id]} live={live} ok={ws.status === "connected"} />
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  <Button variant="outline" size="sm" onClick={() => pingOne(ws)} disabled={pinging != null}>
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
                {/* green pulse ring on the whole card when connected */}
                <span className={`pointer-events-none absolute inset-0 rounded-lg ${live ? "ring-1 ring-emerald-400/20" : ""}`} />
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
