import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api, type Profile, type ProfileDetail } from "@/api"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Bot, Plus, Trash2, Pencil, ShieldAlert, ShieldCheck } from "lucide-react"

const PROVIDERS = [
  "custom", "auto", "anthropic", "openai", "openrouter", "google",
  "groq", "deepseek", "mistral", "xai", "ollama",
]

function ProfileForm({
  initial,
  onClose,
  onSave,
}: {
  initial?: ProfileDetail | null
  onClose: () => void
  onSave: (data: Record<string, unknown>) => Promise<unknown>
}) {
  const editing = !!initial
  const [name, setName] = useState(initial?.name ?? "")
  const [model, setModel] = useState(initial?.model ?? "")
  const [provider, setProvider] = useState(initial?.provider || "custom")
  const [prompt, setPrompt] = useState(initial?.system_prompt ?? "")
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function submit() {
    if (!editing && !/^[a-z0-9_-]{1,32}$/.test(name.trim())) {
      setErr("Name: lowercase, angka, - atau _ (max 32)")
      return
    }
    setBusy(true); setErr(null)
    try {
      if (editing) {
        await onSave({ model: model.trim(), provider, system_prompt: prompt })
      } else {
        await onSave({ name: name.trim(), model: model.trim(), provider, system_prompt: prompt })
      }
      onClose()
    } catch (e) { setErr((e as Error).message); setBusy(false) }
  }

  const field = "w-full rounded-md border border-[#1e2430] bg-[#0b0e14] px-3 py-2 text-sm outline-none focus:border-[#10e0dd]/50"
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-lg border border-[#1e2430] bg-[#11151f] p-4" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-sm font-semibold">{editing ? `Edit profile ${initial?.name}` : "New agent profile"}</h2>
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          {!editing && (
            <>
              <label className="mt-3 block text-xs text-neutral-400">Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="karina" className={`mt-1 ${field}`} />
            </>
          )}
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-neutral-400">Model</label>
              <input value={model} onChange={(e) => setModel(e.target.value)} placeholder="codex" className={`mt-1 ${field}`} />
            </div>
            <div>
              <label className="block text-xs text-neutral-400">Provider</label>
              <select value={provider} onChange={(e) => setProvider(e.target.value)} className={`mt-1 ${field}`}>
                {PROVIDERS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <label className="mt-3 block text-xs text-neutral-400">
            System prompt <span className="text-neutral-600">(SOUL.md)</span>
          </label>
          <textarea
            value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={8}
            placeholder="You are an expert full-stack developer…"
            className={`mt-1 min-h-40 w-full ${field} font-mono text-xs leading-relaxed`}
          />
          {editing && (
            <p className="mt-2 text-[11px] text-neutral-500">
              Skills ({initial?.skills.length ?? 0}) dikelola via hermes CLI (read-only di sini):{" "}
              <span className="text-neutral-400">{initial?.skills.join(", ") || "—"}</span>
            </p>
          )}
          {err && <p className="mt-3 text-xs text-red-400">{err}</p>}
        </div>
        <Separator className="my-3" />
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" disabled={busy} onClick={submit} className="bg-[#10e0dd] text-black hover:bg-[#10e0dd]/90">
            {busy ? "…" : editing ? "Save" : "Create"}
          </Button>
        </div>
      </div>
    </div>
  )
}

export default function ProfilesPage() {
  const qc = useQueryClient()
  const [form, setForm] = useState<{ open: boolean; edit: ProfileDetail | null }>({ open: false, edit: null })

  const profiles = useQuery({
    queryKey: ["profiles-full"],
    queryFn: () => api<(Profile & Partial<ProfileDetail>)[]>("/api/profiles-full"),
  })
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["profiles-full"] })
    qc.invalidateQueries({ queryKey: ["profiles"] })
  }

  const save = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      form.edit
        ? api(`/api/profiles/${form.edit.name}`, { method: "PUT", body: JSON.stringify(data) })
        : api("/api/profiles", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: invalidate,
  })
  const del = useMutation({
    mutationFn: (name: string) => api(`/api/profiles/${name}`, { method: "DELETE" }),
    onSuccess: invalidate,
  })

  async function openEdit(name: string) {
    const detail = await api<ProfileDetail>(`/api/profiles/${name}`)
    setForm({ open: true, edit: detail })
  }

  return (
    <div className="mx-auto w-full max-w-5xl p-4">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-semibold tracking-tight">Agent Profiles</h1>
        <span className="rounded bg-[#0b0e14] px-1.5 py-0.5 text-[10px] text-neutral-400">
          {profiles.data?.length ?? 0}
        </span>
        <Button size="sm" onClick={() => setForm({ open: true, edit: null })}
          className="ml-auto bg-[#10e0dd] text-black hover:bg-[#10e0dd]/90">
          <Plus className="size-3.5" /> New profile
        </Button>
      </div>
      <p className="mt-1 text-xs text-neutral-500">
        Sumber: <code className="text-neutral-400">~/.hermes/profiles/&lt;name&gt;/</code> — config.yaml (model), SOUL.md (system prompt), skills/.
      </p>

      {profiles.isLoading ? (
        <p className="mt-6 text-sm text-neutral-400">Loading…</p>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          {(profiles.data ?? []).map((p) => (
            <article key={p.name} className="rounded-lg border border-[#1e2430] bg-[#11151f] p-3.5">
              <div className="flex items-start gap-2">
                <div className="flex aspect-square size-8 shrink-0 items-center justify-center rounded-lg bg-[#161b27]">
                  <Bot className="size-4 text-[#10e0dd]" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate text-sm font-semibold">{p.name}</h3>
                    {p.active && <span className="rounded bg-[#10e0dd]/15 px-1.5 py-0.5 text-[10px] text-[#10e0dd]">active</span>}
                    {p.valid === false ? (
                      <span className="inline-flex items-center gap-1 rounded border border-red-500/30 bg-red-500/10 px-1.5 py-0.5 text-[10px] text-red-300">
                        <ShieldAlert className="size-3" /> broken config
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] text-emerald-300">
                        <ShieldCheck className="size-3" /> valid
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-[11px] text-neutral-400">
                    model: <span className="font-mono text-neutral-300">{p.model || "—"}</span> · provider:{" "}
                    <span className="font-mono text-neutral-300">{p.provider || "—"}</span>
                  </p>
                  {"skills" in p && (
                    <p className="mt-0.5 truncate text-[11px] text-neutral-500" title={p.skills?.join(", ")}>
                      {p.skills?.length ?? 0} skills
                    </p>
                  )}
                </div>
              </div>
              <div className="mt-3 flex gap-1.5">
                <Button variant="outline" size="sm" onClick={() => openEdit(p.name)}>
                  <Pencil className="size-3.5" /> Edit
                </Button>
                <Button
                  variant="outline" size="sm" disabled={p.active}
                  className="ml-auto border-red-500/30 text-red-300 hover:bg-red-500/10 hover:text-red-200"
                  onClick={() => { if (confirm(`Delete profile "${p.name}"?`)) del.mutate(p.name) }}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}

      {form.open && (
        <ProfileForm
          initial={form.edit}
          onClose={() => setForm({ open: false, edit: null })}
          onSave={save.mutateAsync}
        />
      )}
    </div>
  )
}
