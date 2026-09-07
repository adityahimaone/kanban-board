import { useRef, useState } from "react"
import type { Profile, Workspace } from "../../api"
import { api } from "../../api"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sparkles, Loader2 } from "lucide-react"

function isRemoteWorkspace(w: Workspace): boolean {
  if (w.host && w.host !== "localhost" && w.host !== "127.0.0.1") return true
  if (/^[A-Za-z]:[\\/]/.test(w.path)) return true
  if (w.path.startsWith("/Users/")) return true
  return false
}

function isSshWorkspace(w: Workspace): boolean {
  return !!w.host && w.host !== "localhost" && w.host !== "127.0.0.1"
}

function isLive(w: Workspace): boolean {
  return w.status === "connected" || w.status === "local"
}

function defaultWorkspacePath(workspaces: Workspace[]): string {
  if (workspaces.length === 0) return ""
  const local = workspaces.find((w) => !isRemoteWorkspace(w))
  return local?.path ?? workspaces[0].path
}

export default function TaskDialog({
  workspaces,
  profiles,
  onClose,
  onCreate,
}: {
  workspaces: Workspace[]
  profiles: Profile[]
  onClose: () => void
  onCreate: (p: Record<string, unknown>) => Promise<unknown>
}) {
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [ws, setWs] = useState(() => defaultWorkspacePath(workspaces))
  const [assignee, setAssignee] = useState(profiles[0]?.name ?? "default")
  const [priority, setPriority] = useState("0")
  const [busy, setBusy] = useState(false)
  const [aiBusy, setAiBusy] = useState(false)
  const [aiMode, setAiMode] = useState<"fast" | "deep" | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const improveCache = useRef(new Map<string, string>())

  async function improveBody(mode: "fast" | "deep") {
    if (!body.trim()) return
    const cacheKey = `${title.trim()}::${body.trim()}::${mode}`
    const cached = improveCache.current.get(cacheKey)
    if (cached) {
      setBody(cached)
      return
    }
    if (aiBusy) return
    setAiBusy(true); setAiMode(mode); setErr(null)
    const requestBody = body.trim()
    const requestTitle = title.trim()
    try {
      if (mode === "deep") {
        // Show deterministic structure while model works. User sees useful output now.
        const fast = await api<{ improved: string }>("/api/ai/improve-prompt", {
          method: "POST",
          body: JSON.stringify({ title: requestTitle, body: requestBody, mode: "fast" }),
        })
        setBody(fast.improved)
      }
      const res = await api<{ improved: string }>("/api/ai/improve-prompt", {
        method: "POST",
        body: JSON.stringify({ title: requestTitle, body: requestBody, mode }),
      })
      improveCache.current.set(cacheKey, res.improved)
      setBody(res.improved)
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setAiBusy(false); setAiMode(null)
    }
  }

  async function submit() {
    if (!title.trim()) { setErr("Title required"); return }
    setBusy(true); setErr(null)
    try {
      await onCreate({
        title: title.trim(),
        body: body.trim(),
        workspace_path: ws,
        assignee,
        priority: Number(priority),
        status: "todo",
      })
    } catch (e) { setErr((e as Error).message); setBusy(false) }
  }

  const selCls = "w-full border-[#1e2430] bg-[#0b0e14] text-sm data-[size=default]:h-9"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-lg border border-[#1e2430] bg-[#11151f] p-4" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-sm font-semibold">New Task</h2>
        <Label className="mt-3 block text-xs text-neutral-400">Title</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Judul task"
          className="mt-1 border-[#1e2430] bg-[#0b0e14]" />
        <div className="mt-3 flex items-center justify-between">
          <Label className="text-xs text-neutral-400">Body</Label>
          <div className="flex items-center gap-1">
            <Button
              variant="outline" size="sm"
              disabled={aiBusy || !body.trim()}
              onClick={() => improveBody("fast")}
              className="h-6 gap-1 border-[#10e0dd]/40 px-2 text-[11px] text-[#10e0dd] hover:bg-[#10e0dd]/10 hover:text-[#10e0dd]"
              title="Improve instan pakai template (tanpa AI call)"
            >
              <Sparkles className="size-3" />
              Fast
            </Button>
            <Button
              variant="outline" size="sm"
              disabled={aiBusy || !body.trim()}
              onClick={() => improveBody("deep")}
              className="h-6 gap-1 border-[#1e2430] px-2 text-[11px] text-neutral-300 hover:bg-[#10e0dd]/10 hover:text-[#10e0dd]"
              title="Improve pakai AI model (lebih lambat, hasil lebih kontekstual)"
            >
              {aiMode === "deep" ? <Loader2 className="size-3 animate-spin" /> : <Sparkles className="size-3" />}
              {aiMode === "deep" ? "Improving…" : "Deep"}
            </Button>
          </div>
        </div>
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5} placeholder="Deskripsi (opsional) — klik AI improve biar prompt-nya dirapikan"
          className="mt-1 border-[#1e2430] bg-[#0b0e14] text-sm" />
        <Label className="mt-3 block text-xs text-neutral-400">Agent Profile</Label>
        <Select value={assignee} onValueChange={setAssignee}>
          <SelectTrigger className={`mt-1 ${selCls}`}>
            <SelectValue placeholder="profile" />
          </SelectTrigger>
          <SelectContent className="border-[#1e2430] bg-[#11151f]">
            {profiles.map((p) => (
              <SelectItem key={p.name} value={p.name} disabled={!p.valid} className="text-sm">
                {p.name}{p.model ? ` — ${p.model}` : ""}{p.active ? " (active)" : ""}{!p.valid ? " (broken config)" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="min-w-0">
            <Label className="block text-xs text-neutral-400">Workspace</Label>
            <Select value={ws || "__scratch"} onValueChange={(v) => setWs(v === "__scratch" ? "" : v)}>
              <SelectTrigger className={`mt-1 ${selCls} min-w-0 [&>span]:truncate`}>
                <SelectValue placeholder="workspace" />
              </SelectTrigger>
              <SelectContent className="max-w-[22rem] border-[#1e2430] bg-[#11151f]">
                {workspaces.map((w) => {
                  const ssh = isSshWorkspace(w)
                  const live = isLive(w)
                  const os = (w.os || "").toLowerCase()
                  const osLabel = os === "mac" ? "mac" : os === "windows" ? "win" : os === "linux" ? "linux" : ""
                  return (
                    <SelectItem key={w.id} value={w.path} className="text-sm" title={`${w.name} — ${w.path}${w.host ? ` (${w.host})` : ""}${w.status ? ` · ${w.status}` : ""}`}>
                      <span className="flex min-w-0 items-center gap-1.5">
                        {live && <span className="size-1.5 shrink-0 animate-pulse rounded-full bg-emerald-400" title={w.status === "local" ? "local" : `connected ${w.ping_ms != null ? Math.round(w.ping_ms) + "ms" : ""}`} />}
                        <span className="min-w-0 flex-1 truncate">{w.name}</span>
                        {ssh && <Badge variant="outline" className="shrink-0 border-violet-500/30 bg-violet-500/10 px-1 py-0 text-[9px] leading-none text-violet-300">ssh</Badge>}
                        {osLabel && <Badge variant="outline" className="shrink-0 border-[#1e2430] bg-[#0b0e14] px-1 py-0 text-[9px] leading-none text-neutral-400">{osLabel}</Badge>}
                      </span>
                    </SelectItem>
                  )
                })}
                <SelectItem value="__scratch" className="text-sm">(no workspace — scratch)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="block text-xs text-neutral-400">Priority</Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger className={`mt-1 ${selCls}`}>
                <SelectValue placeholder="priority" />
              </SelectTrigger>
              <SelectContent className="border-[#1e2430] bg-[#11151f]">
                <SelectItem value="0" className="text-sm">0 — normal</SelectItem>
                <SelectItem value="1" className="text-sm">1</SelectItem>
                <SelectItem value="2" className="text-sm">2 — high</SelectItem>
                <SelectItem value="3" className="text-sm">3 — urgent</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {err && <p className="mt-3 text-xs text-red-400">{err}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={busy} className="bg-[#10e0dd] text-black hover:bg-[#10e0dd]/90">
            {busy ? "…" : "Create"}
          </Button>
        </div>
      </div>
    </div>
  )
}
