import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { api, COLUMNS, type Profile, type Status, type Task, type TaskComment, type TaskEvent, type Workspace } from "../../api"
import { parseEventCards, TONE_BORDER, TONE_DOT, TONE_TEXT } from "./eventCards"
import { ArrowLeft, Loader2, Send, Square } from "lucide-react"
import { AgentTaskStatus, splitAgentResult } from "./AgentStatus"

const STATUS_CHIP: Record<string, string> = {
  done: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  running: "border-sky-500/40 bg-sky-500/10 text-sky-300",
  blocked: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  review: "border-violet-500/40 bg-violet-500/10 text-violet-300",
  archived: "border-[var(--color-line)] bg-[var(--color-inset)] text-neutral-400",
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

  // @mention chips: insert "@name " into draft
  function mention(name: string) {
    setDraft((d) => (d.endsWith(" ") || d === "" ? `${d}@${name} ` : `${d} @${name} `))
  }

  return (
    <div className="glass-inset-card rounded-lg p-3">
      <div className="flex items-center gap-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">Reply to agent</h3>
        <div className="ml-auto flex flex-wrap gap-1">
          {profiles.filter((p) => p.valid).map((p) => (
            <button
              key={p.name}
              onClick={() => mention(p.name)}
              className={`rounded-full border px-1.5 py-0.5 text-[10px] ${task.assignee === p.name ? "border-[var(--color-accent)]/50 bg-[var(--color-accent)]/10 text-[var(--color-accent)]" : "border-[var(--color-line)] text-neutral-400 hover:border-[var(--color-accent)]/40 hover:text-[var(--color-accent)]"}`}
              title={`tag @${p.name}`}
            >
              @{p.name}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-2 max-h-32 space-y-1.5 overflow-y-auto">
        {(comments.data ?? []).map((c) => (
          <div key={c.id} className="rounded border border-[var(--color-line)] bg-[var(--color-surface)] px-2 py-1.5">
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
        rows={3}
        placeholder={`Tulis balasan… tag @${task.assignee || "agent"} buat minta dia respond`}
        className="mt-2 min-h-0 resize-none border-[var(--color-line)] bg-[var(--color-surface)] text-xs"
      />
      {err && <p className="mt-1 text-[11px] text-red-400">{err}</p>}
      <div className="mt-1.5 flex justify-end">
        <Button
          size="sm"
          disabled={!draft.trim() || post.isPending}
          onClick={() => { setErr(null); post.mutate(draft.trim()) }}
          className="gap-1 bg-[var(--color-accent)] text-black hover:bg-[var(--color-accent)]/90"
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

function ReviewSection({ slug, task, onDone }: { slug: string; task: Task; onDone: () => void }) {
  const qc = useQueryClient()
  const [action, setAction] = useState<"done" | "commit" | "commit_push" | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const diff = useQuery({
    queryKey: ["diff", slug, task.id],
    queryFn: () => api<{ stat: string; diff: string; clean: boolean }>(`/api/boards/${slug}/tasks/${task.id}/diff`),
    enabled: task.status === "review",
    retry: false,
  })

  const approve = useMutation({
    mutationFn: (a: "done" | "commit" | "commit_push") =>
      api<{ status: string }>(`/api/boards/${slug}/tasks/${task.id}/approve`, {
        method: "POST",
        body: JSON.stringify({ action: a }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks", slug] })
      qc.invalidateQueries({ queryKey: ["events", slug, task.id] })
      onDone()
    },
    onError: (e: Error) => setErr(e.message),
  })

  if (task.status !== "review") return null

  return (
    <div className="glass-inset-card rounded-lg border border-violet-500/40 p-3">
      <div className="flex items-center gap-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-violet-300">Review changes</h3>
        {diff.isLoading && <Loader2 className="size-3 animate-spin text-violet-300" />}
        {diff.data && <span className="text-[10px] text-neutral-500">{diff.data.stat.split("\n").filter(Boolean).length} files</span>}
        <div className="ml-auto flex items-center gap-1.5">
          {diff.data?.clean ? <span className="text-[10px] text-neutral-500">No changes</span> : (
            <Select value={action ?? ""} onValueChange={(v) => setAction(v as "commit" | "commit_push")}>
              <SelectTrigger className="h-7 w-[150px] border-[var(--color-line)] bg-[var(--color-surface)] text-[11px]"><SelectValue placeholder="Pilih aksi…" /></SelectTrigger>
              <SelectContent className="border-[var(--color-line)] bg-[var(--color-surface)]"><SelectItem value="commit" className="text-xs">Commit</SelectItem><SelectItem value="commit_push" className="text-xs">Commit & Push</SelectItem></SelectContent>
            </Select>
          )}
          <Button
            size="sm"
            disabled={(!action && !diff.data?.clean) || approve.isPending}
            onClick={() => { setErr(null); approve.mutate(diff.data?.clean ? "done" : action!) }}
            className="gap-1 bg-violet-500 text-white hover:bg-violet-400"
          >
            {approve.isPending ? <Loader2 className="size-3 animate-spin" /> : null}
            {diff.data?.clean ? "Mark done" : "Approve"}
          </Button>
        </div>
      </div>
      {err && <p className="mt-1 text-[11px] text-red-400">{err}</p>}
      <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap break-all rounded border border-[var(--color-line)] bg-[var(--color-surface)] p-2 font-mono text-[10px] leading-relaxed text-neutral-300">
        {diff.isLoading ? "Loading diff…" : diff.error ? `Gagal load diff: ${(diff.error as Error).message}` : diff.data ? `${diff.data.stat}\n\n${diff.data.diff}` : "—"}
      </pre>
    </div>
  )
}

export default function TaskDetailPage({
  slug,
  task,
  profiles,
  workspaces,
  onBack,
  onMove,
  onStop,
  onReassign,
}: {
  slug: string
  task: Task
  profiles: Profile[]
  workspaces: Workspace[]
  onBack: () => void
  onMove: (s: Status) => Promise<void>
  onStop: () => Promise<void>
  onReassign: (a: string) => Promise<void>
}) {
  const events = useQuery({
    queryKey: ["events", slug, task.id],
    queryFn: () => api<TaskEvent[]>(`/api/boards/${slug}/tasks/${task.id}/events`),
    refetchInterval: task.status === "running" ? 5_000 : false,
  })
  const profile = profiles.find((p) => p.name === task.assignee)
  const ws = workspaces.find((w) => w.path === task.workspace_path)
  const groups = events.data ? parseEventCards(events.data) : []
  const [showWorking, setShowWorking] = useState(false)
  const resultSplit = task.result ? splitAgentResult(task.result) : null

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
      {/* top bar: back + title */}
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={onBack} className="gap-1 border-[var(--color-line)] bg-[var(--color-surface)] text-neutral-300">
          <ArrowLeft className="size-3.5" /> Board
        </Button>
        <h1 className="truncate text-base font-semibold">{task.title}</h1>
      </div>

      {/* header card */}
      <div className="mt-3 rounded-lg border border-[var(--color-line)] bg-[var(--color-bg)] p-3">
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-neutral-500">
          <Badge variant="outline" className="px-1.5 py-0 font-mono text-[9px] leading-none text-neutral-400">{task.id}</Badge>
          <Badge variant="outline" className={`px-1.5 py-0 text-[9px] leading-none ${STATUS_CHIP[task.status] ?? "border-[var(--color-line)] bg-[var(--color-inset)] text-neutral-300"}`}>{task.status}</Badge>
          {task.priority > 0 && (
            <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 px-1.5 py-0 text-[9px] leading-none text-amber-300">P{task.priority}</Badge>
          )}
          <span>dibuat {new Date(task.created_at * 1000).toLocaleString()}</span>
          {task.completed_at && <span>· selesai {new Date(task.completed_at * 1000).toLocaleString()}</span>}
        </div>
        <AgentTaskStatus task={task} events={events.data ?? []} />

        {/* meta grid */}
        <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
          <div className="glass-inset-card rounded-lg p-2.5">
            <label className="block text-[10px] uppercase tracking-wider text-neutral-500">Agent</label>
            <Select
              value={task.assignee || "unassigned"}
              onValueChange={(v) => onReassign(v === "unassigned" ? "" : v).catch((err: Error) => alert(err.message))}
              disabled={task.status === "running"}
            >
              <SelectTrigger className="mt-1 h-8 w-full border-[var(--color-line)] bg-[var(--color-bg)] text-xs disabled:opacity-50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-72 border-[var(--color-line)] bg-[var(--color-surface)]">
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
          <div className="min-w-0 rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] p-2.5">
            <label className="block text-[10px] uppercase tracking-wider text-neutral-500">Workspace</label>
            <p className="mt-1 truncate text-xs text-neutral-300" title={task.workspace_path || "scratch"}>
              {ws ? ws.name : task.workspace_path ? task.workspace_path.split(/[\\/]/).pop() : "scratch"}
            </p>
            <p className="mt-0.5 truncate font-mono text-[10px] text-neutral-500">{task.workspace_kind || "dir"}{ws?.host ? ` · ${ws.host}` : ""}</p>
            {task.consecutive_failures > 0 && (
              <p className="mt-0.5 text-[10px] text-red-400">{task.consecutive_failures} consecutive failures</p>
            )}
          </div>
        </div>

        {task.body && (
          <div className="glass-inset-card mt-2 max-h-28 overflow-y-auto rounded-lg p-2.5">
            <label className="block text-[10px] uppercase tracking-wider text-neutral-500">Deskripsi</label>
            <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-relaxed text-neutral-300">{task.body}</p>
          </div>
        )}
        {task.last_failure_error && (
          <p className="mt-2 rounded border border-red-500/30 bg-red-500/10 p-2 text-[11px] leading-relaxed text-red-300">{task.last_failure_error}</p>
        )}
        {resultSplit && resultSplit.working && (
          <div className="glass-inset-card mt-2 rounded-lg p-2.5">
            <button type="button" onClick={() => setShowWorking((v) => !v)} aria-expanded={showWorking}
              className="flex w-full items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-neutral-400 hover:text-neutral-200">
              <span className={`transition-transform duration-200 ${showWorking ? "rotate-90" : ""}`}>▸</span>
              Working log {showWorking ? "" : "(tap untuk buka)"}
            </button>
            {showWorking && (
              <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap break-words rounded border border-[var(--color-line)] bg-[var(--color-bg)] p-2 font-mono text-[10px] leading-relaxed text-neutral-400">{resultSplit.working}</pre>
            )}
          </div>
        )}
        {resultSplit && (
          <div className="mt-2 rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-3">
            <label className="block text-[10px] font-medium uppercase tracking-wider text-emerald-300">Result</label>
            <pre className="mt-1.5 max-h-[28rem] overflow-auto whitespace-pre-wrap break-words rounded border border-emerald-500/20 bg-[var(--color-bg)] p-2.5 font-mono text-xs leading-relaxed text-emerald-100/90">{resultSplit.final || resultSplit.working}</pre>
          </div>
        )}

        {/* status moves */}
        <div className="mt-2 flex flex-wrap gap-1.5">
          {task.status === "running" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onStop().catch((e: Error) => alert(e.message))}
              className="h-6 gap-1 rounded border-red-500/40 px-2 text-[10px] text-red-300 hover:bg-red-500/10 hover:text-red-200"
            >
              <Square className="size-2.5 fill-current" /> Stop task
            </Button>
          )}
          {task.status !== "running" && COLUMNS.filter((s) => s !== task.status).map((s) => (
            <Button
              key={s}
              variant="outline"
              size="sm"
              onClick={() => onMove(s).catch((e: Error) => alert(e.message))}
              className="h-6 rounded px-2 text-[10px] text-neutral-400 hover:border-[var(--color-accent)]/50 hover:text-[var(--color-accent)]"
            >
              → {s}
            </Button>
          ))}
        </div>
      </div>

      {/* review gate: diff + approve */}
      <ReviewSection slug={slug} task={task} onDone={onBack} />

      {/* reply */}
      <div className="mt-3">
        <CommentSection slug={slug} task={task} profiles={profiles} />
      </div>

      {/* history — grouped columns */}
      <h3 className="mt-4 text-xs font-semibold uppercase tracking-wider text-neutral-400">
        History {events.data ? `· ${events.data.length} event` : ""}
      </h3>
      <div className="mt-2 grid grid-cols-1 gap-3 pb-4 lg:grid-cols-3">
        {events.isLoading ? (
          <p className="text-xs text-neutral-500">Loading…</p>
        ) : !events.data?.length ? (
          <p className="text-xs text-neutral-500">No events</p>
        ) : (
          groups.map((g) => (
            <section key={g.title} className="glass-inset-card min-w-0 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <span className={`size-2 rounded-full ${TONE_DOT[g.tone]}`} />
                <h4 className={`text-[11px] font-semibold uppercase tracking-wider ${TONE_TEXT[g.tone]}`}>
                  {g.title}
                </h4>
                <span className="h-px flex-1 bg-[var(--color-line)]" />
                <span className="text-[10px] text-neutral-600">{g.cards.length}</span>
              </div>
              <div className="mt-2 space-y-1.5">
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
          ))
        )}
      </div>
    </div>
  )
}
