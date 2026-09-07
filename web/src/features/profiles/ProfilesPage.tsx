import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api, type Profile, type ProfileDetail } from "@/api"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Bot, Plus, Trash2, Pencil, ShieldAlert, ShieldCheck, Activity } from "lucide-react"

const FALLBACK_PROVIDERS = [
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
  const [modelQ, setModelQ] = useState("")
  const providersQ = useQuery({
    queryKey: ["providers"],
    queryFn: () => api<{ name: string; base_url: string; default_model: string; models: string[] }[]>("/api/providers"),
  })
  // Provider select: registry allowlist only — custom_providers names are
  // endpoints, not valid `provider:` values (hermes rejects them at boot).
  const providerNames = FALLBACK_PROVIDERS
  const providerRoster = providersQ.data ?? []
  // Model picker: roster of the endpoint matching this profile's base_url.
  // Fallback: roster whose default_model == current model, else the
  // default endpoint (first roster) so "New profile" still shows models.
  const activeProvider =
    providerRoster.find((p) => p.base_url && p.base_url === initial?.base_url) ??
    providerRoster.find((p) => p.default_model === model) ??
    providerRoster.find((p) => p.base_url === "https://9router.adityahimaone.space/v1") ??
    providerRoster[0]
  const modelOptions: string[] = activeProvider?.models?.length ? [...activeProvider.models].sort() : []
  const filteredModels = modelQ ? modelOptions.filter((m) => m.toLowerCase().includes(modelQ.toLowerCase())).slice(0, 80) : modelOptions.slice(0, 80)

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-lg border border-[#1e2430] bg-[#11151f] p-4" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-sm font-semibold">{editing ? `Edit profile ${initial?.name}` : "New agent profile"}</h2>
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          {!editing && (
            <>
              <Label className="mt-3 block text-xs text-neutral-400">Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="karina" className="mt-1 border-[#1e2430] bg-[#0b0e14]" />
            </>
          )}
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <Label className="block text-xs text-neutral-400">Provider</Label>
              <Select value={provider} onValueChange={setProvider}>
                <SelectTrigger className="mt-1 w-full border-[#1e2430] bg-[#0b0e14] text-sm data-[size=default]:h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-[#1e2430] bg-[#11151f] max-h-72">
                  {providerNames.map((p) => <SelectItem key={p} value={p} className="text-sm">{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="block text-xs text-neutral-400">Model</Label>
              {modelOptions.length > 0 ? (
                <>
                  <Input
                    value={model} onChange={(e) => { setModel(e.target.value); setModelQ(e.target.value) }}
                    onFocus={() => setModelQ(model)} placeholder={activeProvider?.default_model || "codex"}
                    className="mt-1 border-[#1e2430] bg-[#0b0e14]" list="model-options"
                  />
                  <div className="mt-1 max-h-28 overflow-y-auto rounded-md border border-[#1e2430] bg-[#0b0e14]">
                    {filteredModels.map((m) => (
                      <button key={m} onClick={() => { setModel(m); setModelQ("") }}
                        className={`block w-full px-2 py-1 text-left font-mono text-[11px] hover:bg-[#1e2430] ${m === model ? "bg-[#1e2430] text-[#10e0dd]" : "text-neutral-400"}`}>
                        {m}
                      </button>
                    ))}
                    {!filteredModels.length && <p className="px-2 py-1 text-[11px] text-neutral-600">No match</p>}
                  </div>
                </>
              ) : (
                <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder="codex" className="mt-1 border-[#1e2430] bg-[#0b0e14]" />
              )}
            </div>
          </div>
          <Label className="mt-3 block text-xs text-neutral-400">
            System prompt <span className="text-neutral-600">(SOUL.md)</span>
          </Label>
          <Textarea
            value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={12}
            placeholder="You are an expert full-stack developer…"
            className="mt-1 h-64 min-h-40 resize-y overflow-y-auto border-[#1e2430] bg-[#0b0e14] font-mono text-xs leading-relaxed"
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
            <Card key={p.name} className={`border-[#1e2430] bg-[#11151f] transition-colors hover:border-[#10e0dd]/35 ${p.active ? "border-[#10e0dd]/55" : ""}`}>
              <CardContent className="p-4">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-[#10e0dd]/15 bg-[#161b27]">
                    <Bot className="size-4 text-[#10e0dd]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-sm font-semibold leading-5" title={p.name}>{p.name}</h3>
                        <p className="mt-0.5 truncate font-mono text-[11px] text-neutral-400" title={`${p.model || "—"} · ${p.provider || "—"}`}>
                          {p.model || "—"} · {p.provider || "—"}
                        </p>
                      </div>
                      {p.active && (
                        <Badge className="shrink-0 gap-1 bg-[#10e0dd]/15 text-[10px] text-[#10e0dd] hover:bg-[#10e0dd]/15">
                          <Activity className="size-3" /> active
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex items-end justify-between gap-3">
                  {"skills" in p ? (
                    <div title={p.skills?.join(", ") || undefined}>
                      <p className="font-mono text-xl font-semibold leading-none text-neutral-100">{p.skills?.length ?? 0}</p>
                      <p className="mt-1 text-[10px] uppercase tracking-wider text-neutral-500">skills</p>
                    </div>
                  ) : <span />}
                  {p.valid === false ? (
                    <span className="flex shrink-0 items-center gap-1 text-[11px] text-red-300"><ShieldAlert className="size-3.5" /> broken config</span>
                  ) : (
                    <span className="flex shrink-0 items-center gap-1 text-[11px] text-emerald-300"><ShieldCheck className="size-3.5" /> valid</span>
                  )}
                </div>
                <Separator className="my-3" />
                <div className="flex gap-1.5">
                  <Button variant="outline" size="sm" onClick={() => openEdit(p.name)}>
                    <Pencil className="size-3.5" /> Edit
                  </Button>
                  <Button
                    variant="outline" size="sm" disabled={p.active} aria-label={`Delete profile ${p.name}`} title={p.active ? "Active profile cannot be deleted" : `Delete ${p.name}`}
                    className="ml-auto border-red-500/30 text-red-300 hover:bg-red-500/10 hover:text-red-200"
                    onClick={() => { if (confirm(`Delete profile "${p.name}"?`)) del.mutate(p.name) }}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
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
