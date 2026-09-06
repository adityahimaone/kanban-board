import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { api, COLUMNS, type Profile, type Status, type Task, type TaskComment, type TaskEvent } from "../../api"
import { parseEventCards, TONE_BORDER, TONE_DOT, TONE_TEXT, type EventTone } from "./eventCards"
import { Loader2, Send } from "lucide-react"

const TONE_CHIP: Record<EventTone, string> = {
  accent: "border-[#10e0dd]/40 bg-[#10e0dd]/10 text-[#10e0dd]",
  success: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  warning: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  danger: "border-red-500/40 bg-red-500/10 text-red-300",
  neutral: "border-[#1e2430] bg-[#161b27] text-neutral-300",
  info: "border-sky-500/40 bg-sky-500/10 text-sky-300",
}

function CommentSection({ slug, task, profiles }: { slug: string; task: Task; profiles: Profile[] }) {
  const qc = useQueryClient()
  const [draft, setDraft] = useState("")
  const [err, setErr] = useState<string | null>(null)

  const comments = useQuery({
    queryKey: ["comments", slug, task.id],
    queryFn: () => api<TaskComment[]>(`/api/boards/${slug}/tasks/${task.id}/comments`),
    refetchInterval: 10_000,
  })

  const post = useMutation({
    mutationFn: (body: string) =>
      api(`/api/boards/${slug}/tasks/${task.id}/comments`, {
        method: "POST",
        body: JSON.stringify({ body, author: "board-ui" }),
      }),
    onSuccess: () => {
      setDraft("")
      qc.invalidateQueries({ queryKey: ["comments", slug, task.id] })
      qc.invalidateQueries({ queryKey: ["events", slug, task.id] })
      qc.invalidateQueries({ queryKey: ["tasks", slug] })
    },
    onError: (e: Error) => setErr(e.message),
  })

  // @mention chips: insert "@name " at cursor position
  function mention(name: string) {
    setDraft((d) => (d.endsWith(" ") || d === "" ? `${d}@${name} ` : `${d} @${name} `))
  }

  return (
    <div className="mt-3 shrink-0 rounded-lg border border-[#1e2430] bg-[#0b0e14] p-2.5">
      <div className="flex items-center gap-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">Reply to agent</h3>
        <div className="ml-auto flex flex-wrap gap-1">
          {profiles.filter((p) => p.valid).slice(0, 5).map((p) => (
            <button
              key={p.name}
              onClick={() => mention(p.name)}
              className={`rounded-full border px-1.5 py-0.5 text-[10px] ${task.assignee === p.name ? "border-[#10e0dd]/50 bg-[#10e0dd]/10 text-[#10e0dd]" : "border-[#1e2430] text-neutral-400 hover:border-[#10e0dd]/40 hover:text-[#10e0dd]"}`}
              title={`tag @${p.name}`}
            >
              @{p.name}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-2 max-h-28 space-y-1.5 overflow-y-auto">
        {(comments.data ?? []).slice(-5).map((c) => (
          <div key={c.id} className="rounded border border-[#1e2430] bg-[#11151f] px-2 py-1.5">
            <p className="text-[10px] text-neutral-500">
              <span className="font-medium text-neutral-300">{c.author}</span> · {new Date(c.created_at * 1000).toLocaleString()}
            </p>
            <p className="mt-0.5 whitespace-pre-wrap break-words text-[11px] leading-relaxed text-neutral-300">{c.body}</p>
          </div>
        ))}
        {comments.isLoading && <p className="text-[11px] text-neutral-600">Loading comments…</p>}
        {!comments.isLoading && !(comments.data ?? []).length && (
          <p className="text-[11px] text-neutral-600">Belum ada komentar — tag agent buat ngobrol.</p>
        )}
      </div>
      <Textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={2}
        placeholder={`Tulis balasan… tag @${task.assignee || "agent"} buat minta dia respond`}
        className="mt-2 min-h-0 resize-none border-[#1e2430] bg-[#11151f] text-xs"
      />
      {err && <p className="mt-1 text-[11px] text-red-400">{err}</p>}
      <div className="mt-1.5 flex justify-end">
        <Button
          size="sm"
          disabled={!draft.trim() || post.isPending}
          onClick={() => { setErr(null); post.mutate(draft.trim()) }}
          className="h-7 gap-1 bg-[#10e0dd] text-black hover:bg-[#10e0dd]/90"
        >
          {post.isPending ? <Loader2 className="size-3 animate-spin" /> : <Send className="size-3" />}
          Send
        </Button>
      </div>
      <p className="mt-1 text-[10px] text-neutral-600">
        Komen masuk ke worker context — kalau task done/blocked dan tag assignee, task auto balik ke todo biar agent respawn & bales.
      </p>
    </div>
  )
}

export default function TaskDetail({
  slug,
  task,
  profiles,
  onClose,
  onMove,
  onReassign,
}: {
  slug: string
  task: Task
  profiles: Profile[]
  onClose: () => void
  onMove: (s: Status) => Promise<void>
  onReassign: (a: string) => Promise<void>
}) {
  const events = useQuery({
    queryKey: ["events", slug, task.id],
    queryFn: () => api<TaskEvent[]>(`/api/boards/${slug}/tasks/${task.id}/events`),
  })
  const profile = profiles.find((p) => p.name === task.assignee)
  const groups = events.data ? parseEventCards(events.data) : []

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <aside
        className="flex h-full w-full max-w-xl flex-col border-l border-[#1e2430] bg-[#11151f] p-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* header card */}
        <div className="shrink-0 rounded-lg border border-[#1e2430] bg-[#0b0e14] p-3">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-sm font-semibold leading-snug">{task.title}</h2>
            <Button variant="outline" size="sm" className="shrink-0 px-2" onClick={onClose}>✕</Button>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-neutral-500">
            <Badge variant="outline" className="px-1.5 py-0 font-mono text-[9px] leading-none text-neutral-400">{task.id}</Badge>
            <Badge variant="outline" className={`px-1.5 py-0 text-[9px] leading-none ${
              task.status === "done" ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
              : task.status === "running" ? "border-sky-500/40 bg-sky-500/10 text-sky-300"
              : task.status === "blocked" ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
              : "border-[#1e2430] bg-[#161b27] text-neutral-300"}`}>{task.status}</Badge>
            {task.priority > 0 && (
              <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 px-1.5 py-0 text-[9px] leading-none text-amber-300">P{task.priority}</Badge>
            )}
            <span>dibuat {new Date(task.created_at * 1000).toLocaleString()}</span>
            {task.completed_at && <span>· selesai {new Date(task.completed_at * 1000).toLocaleString()}</span>}
          </div>
        </div>

        {/* meta card: assignee + workspace */}
        <div className="mt-2 grid shrink-0 grid-cols-2 gap-2">
          <div className="rounded-lg border border-[#1e2430] bg-[#0b0e14] p-2.5">
            <label className="block text-[10px] uppercase tracking-wider text-neutral-500">Agent</label>
            <Select
              value={task.assignee || "unassigned"}
              onValueChange={(v) => onReassign(v === "unassigned" ? "" : v).catch((err: Error) => alert(err.message))}
              disabled={task.status === "running"}
            >
              <SelectTrigger className="mt-1 h-8 w-full border-[#1e2430] bg-[#11151f] text-xs disabled:opacity-50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-72 border-[#1e2430] bg-[#11151f]">
                <SelectItem value="unassigned" className="text-xs">unassigned</SelectItem>
                {profiles.map((p) => (
                  <SelectItem key={p.name} value={p.name} disabled={!p.valid} className="text-xs">
                    {p.name}{p.active ? " (active)" : ""}{!p.valid ? " (broken)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {profile && (
              <p className="mt-1 truncate text-[10px] text-neutral-500" title={`${profile.model || "—"} · ${profile.provider || "—"}`}>
                {profile.model || "—"} · {profile.provider || "—"}
              </p>
            )}
            {profile && !profile.valid && (
              <p className="mt-0.5 text-[10px] text-red-400">Provider invalid — worker bakal crash.</p>
            )}
          </div>
          <div className="min-w-0 rounded-lg border border-[#1e2430] bg-[#0b0e14] p-2.5">
            <label className="block text-[10px] uppercase tracking-wider text-neutral-500">Workspace</label>
            <p className="mt-1 truncate font-mono text-xs text-neutral-300" title={task.workspace_path || "scratch"}>
              {task.workspace_path ? task.workspace_path.split(/[\\/]/).pop() : "scratch"}
            </p>
            <p className="mt-0.5 truncate text-[10px] text-neutral-500">{task.workspace_kind || "dir"}</p>
            {task.consecutive_failures > 0 && (
              <p className="mt-0.5 text-[10px] text-red-400">{task.consecutive_failures} consecutive failures</p>
            )}
          </div>
        </div>

        {/* body */}
        {task.body && (
          <div className="mt-2 max-h-24 shrink-0 overflow-y-auto rounded-lg border border-[#1e2430] bg-[#0b0e14] p-2.5">
            <label className="block text-[10px] uppercase tracking-wider text-neutral-500">Deskripsi</label>
            <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-relaxed text-neutral-300">{task.body}</p>
          </div>
        )}
        {task.last_failure_error && (
          <p className="mt-2 shrink-0 rounded border border-red-500/30 bg-red-500/10 p-2 text-[11px] leading-relaxed text-red-300">{task.last_failure_error}</p>
        )}
        {task.result && (
          <div className="mt-2 max-h-28 shrink-0 overflow-y-auto rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-2.5">
            <label className="block text-[10px] font-medium uppercase tracking-wider text-emerald-300">Result</label>
            <p className="mt-1 whitespace-pre-wrap break-words text-[11px] leading-relaxed text-emerald-100/90">{task.result}</p>
          </div>
        )}

        {/* status moves */}
        <div className="mt-2 flex shrink-0 flex-wrap gap-1.5">
          {COLUMNS.filter((s) => s !== task.status).map((s) => (
            <Button
              key={s}
              variant="outline"
              size="sm"
              onClick={() => onMove(s).catch((e: Error) => alert(e.message))}
              className="h-6 rounded px-2 text-[10px] text-neutral-400 hover:border-[#10e0dd]/50 hover:text-[#10e0dd]"
            >
              → {s}
            </Button>
          ))}
        </div>

        {/* reply box */}
        <CommentSection slug={slug} task={task} profiles={profiles} />

        {/* history — grouped columns */}
        <h3 className="mt-3 shrink-0 text-xs font-semibold uppercase tracking-wider text-neutral-400">
          History {events.data ? `· ${events.data.length} event` : ""}
        </h3>
        <div className="mt-1.5 min-h-0 flex-1 overflow-y-auto rounded-lg border border-[#1e2430] bg-[#0b0e14] p-3">
          {events.isLoading ? (
            <p className="text-xs text-neutral-500">Loading…</p>
          ) : !events.data?.length ? (
            <p className="text-xs text-neutral-500">No events</p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {groups.map((g) => (
                <section key={g.title} className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`size-2 rounded-full ${TONE_DOT[g.tone]}`} />
                    <h4 className={`text-[11px] font-semibold uppercase tracking-wider ${TONE_TEXT[g.tone]}`}>
                      {g.title}
                    </h4>
                    <span className="h-px flex-1 bg-[#1e2430]" />
                    <span className="text-[10px] text-neutral-600">{g.cards.length}</span>
                  </div>
                  <div className="mt-2 grid grid-cols-1 gap-1.5">
                    {g.cards.map((c) => (
                      <article key={`${c.kind}-${c.at}-${c.fields.map((f) => f.value).join("|")}`}
                        className={`rounded-md border p-2 ${TONE_BORDER[c.tone]}`}>
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{c.icon}</span>
                          <span className={`text-xs font-medium ${TONE_TEXT[c.tone]}`}>{c.label}</span>
                          <span className="ml-auto text-[10px] text-neutral-500">
                            {new Date(c.at * 1000).toLocaleTimeString()}
                          </span>
                        </div>
                        {c.note && (
                          <p className="mt-1 break-words font-mono text-[11px] leading-relaxed text-neutral-300">{c.note}</p>
                        )}
                        {c.fields.length > 0 && (
                          <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-2.5 gap-y-1">
                            {c.fields.map((f, i) => (
                              <div key={i} className="col-span-2 grid grid-cols-subgrid">
                                <dt className="text-[11px] text-neutral-500">{f.label}</dt>
                                <dd className={`break-all text-[11px] ${f.mono ? "font-mono" : ""} ${
                                  f.tone === "danger" ? "text-red-300" : f.tone === "warning" ? "text-amber-300" : "text-neutral-200"
                                }`}>
                                  {f.value}
                                </dd>
                              </div>
                            ))}
                          </dl>
                        )}
                      </article>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
        <span className="hidden" data-tone={Object.keys(TONE_CHIP).join(",")} />
      </aside>
    </div>
  )
}
