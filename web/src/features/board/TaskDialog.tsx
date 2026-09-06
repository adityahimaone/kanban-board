import { useState } from "react"
import type { Profile, Workspace } from "../../api"

export default function TaskDialog({
  workspaces,
  profiles,
  onClose,
  onCreate,
}: {
  workspaces: Workspace[]
  profiles: Profile[]
  onClose: () => void
  onCreate: (p: Record<string, unknown>) => Promise<void>
}) {
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [ws, setWs] = useState(workspaces[0]?.path ?? "")
  const [assignee, setAssignee] = useState(profiles[0]?.name ?? "default")
  const [priority, setPriority] = useState(0)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function submit() {
    if (!title.trim()) { setErr("Title required"); return }
    setBusy(true); setErr(null)
    try {
      await onCreate({
        title: title.trim(),
        body: body.trim(),
        workspace_path: ws,
        assignee,
        priority,
        status: "todo",
      })
    } catch (e) { setErr((e as Error).message); setBusy(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-lg border border-[#1e2430] bg-[#11151f] p-4" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-sm font-semibold">New Task</h2>
        <label className="mt-3 block text-xs text-neutral-400">Title</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Judul task"
          className="mt-1 w-full rounded-md border border-[#1e2430] bg-[#0b0e14] px-3 py-2 text-sm outline-none focus:border-[#10e0dd]/50" />
        <label className="mt-3 block text-xs text-neutral-400">Body</label>
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} placeholder="Deskripsi (opsional)"
          className="mt-1 w-full rounded-md border border-[#1e2430] bg-[#0b0e14] px-3 py-2 text-sm outline-none focus:border-[#10e0dd]/50" />
        <label className="mt-3 block text-xs text-neutral-400">Agent Profile</label>
        <select value={assignee} onChange={(e) => setAssignee(e.target.value)}
          className="mt-1 w-full rounded-md border border-[#1e2430] bg-[#0b0e14] px-2 py-2 text-sm">
          {profiles.map((p) => (
            <option key={p.name} value={p.name}>
              {p.name}{p.model ? ` — ${p.model}` : ""}{p.active ? " (active)" : ""}
            </option>
          ))}
        </select>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-neutral-400">Workspace</label>
            <select value={ws} onChange={(e) => setWs(e.target.value)}
              className="mt-1 w-full rounded-md border border-[#1e2430] bg-[#0b0e14] px-2 py-2 text-sm">
              {workspaces.map((w) => <option key={w.id} value={w.path}>{w.name} — {w.path}</option>)}
              {!workspaces.length && <option value="">(no workspace — scratch)</option>}
            </select>
          </div>
          <div>
            <label className="block text-xs text-neutral-400">Priority</label>
            <select value={priority} onChange={(e) => setPriority(Number(e.target.value))}
              className="mt-1 w-full rounded-md border border-[#1e2430] bg-[#0b0e14] px-2 py-2 text-sm">
              <option value={0}>0 — normal</option>
              <option value={1}>1</option>
              <option value={2}>2 — high</option>
              <option value={3}>3 — urgent</option>
            </select>
          </div>
        </div>
        {err && <p className="mt-3 text-xs text-red-400">{err}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border border-[#1e2430] px-3 py-1.5 text-sm">Cancel</button>
          <button onClick={submit} disabled={busy}
            className="rounded-md bg-[#10e0dd] px-4 py-1.5 text-sm font-medium text-black disabled:opacity-50">
            {busy ? "…" : "Create"}
          </button>
        </div>
      </div>
    </div>
  )
}
