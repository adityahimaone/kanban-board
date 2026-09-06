import { useQuery } from "@tanstack/react-query"
import { api, COLUMNS, type Profile, type Status, type Task, type TaskEvent } from "../../api"
import { parseEventCards, TONE_BORDER, TONE_DOT, TONE_TEXT, type EventTone } from "./eventCards"

const TONE_CHIP: Record<EventTone, string> = {
  accent: "border-[#10e0dd]/40 bg-[#10e0dd]/10 text-[#10e0dd]",
  success: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  warning: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  danger: "border-red-500/40 bg-red-500/10 text-red-300",
  neutral: "border-[#1e2430] bg-[#161b27] text-neutral-300",
  info: "border-sky-500/40 bg-sky-500/10 text-sky-300",
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
        className="flex h-full w-full max-w-md flex-col border-l border-[#1e2430] bg-[#11151f] p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-sm font-semibold leading-snug">{task.title}</h2>
          <button onClick={onClose} className="shrink-0 rounded border border-[#1e2430] px-2 py-1 text-xs">✕</button>
        </div>
        <p className="mt-1 text-xs text-neutral-500">{task.id} · {task.status}</p>

        <div className="mt-3">
          <label className="block text-xs text-neutral-400">Agent Profile</label>
          <select
            value={task.assignee || ""}
            onChange={(e) => onReassign(e.target.value).catch((err: Error) => alert(err.message))}
            disabled={task.status === "running"}
            className="mt-1 w-full rounded-md border border-[#1e2430] bg-[#0b0e14] px-2 py-2 text-sm disabled:opacity-50"
          >
            <option value="">unassigned</option>
            {profiles.map((p) => (
              <option key={p.name} value={p.name} disabled={!p.valid}>
                {p.name}{p.model ? ` — ${p.model}` : ""}{p.active ? " (active)" : ""}{!p.valid ? " (broken config)" : ""}
              </option>
            ))}
          </select>
          {task.status === "running" && (
            <p className="mt-1 text-[11px] text-amber-400/80">Running — reclaim dulu buat reassign.</p>
          )}
          {profile && !profile.valid && (
            <p className="mt-1 text-[11px] text-red-400">
              Provider invalid: {profile.provider || "—"} — worker bakal crash. Fix profile config dulu.
            </p>
          )}
          {profile && <p className="mt-1 text-[11px] text-neutral-500">model: {profile.model || "—"} · provider: {profile.provider || "—"}</p>}
        </div>

        {task.body && <p className="mt-3 whitespace-pre-wrap text-sm text-neutral-300">{task.body}</p>}
        {task.last_failure_error && (
          <p className="mt-2 rounded border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-300">{task.last_failure_error}</p>
        )}
        {task.result && (
          <div className="mt-3 rounded-md border border-emerald-500/40 bg-emerald-500/5 p-2.5">
            <p className="text-[11px] font-medium uppercase tracking-wider text-emerald-300">Result</p>
            <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-emerald-100/90">{task.result}</p>
          </div>
        )}
        <div className="mt-4 flex flex-wrap gap-1.5">
          {COLUMNS.filter((s) => s !== task.status).map((s) => (
            <button
              key={s}
              onClick={() => onMove(s).catch((e: Error) => alert(e.message))}
              className="rounded border border-[#1e2430] px-2 py-1 text-xs hover:border-[#10e0dd]/50 hover:text-[#10e0dd]"
            >
              → {s}
            </button>
          ))}
        </div>

        <h3 className="mt-6 text-xs font-semibold uppercase tracking-wider text-neutral-400">
          History {events.data ? `· ${events.data.length} event` : ""}
        </h3>
        <div className="mt-2 flex-1 space-y-4 overflow-y-auto rounded border border-[#1e2430] bg-[#0b0e14] p-3">
          {events.isLoading ? (
            <p className="text-xs text-neutral-500">Loading…</p>
          ) : !events.data?.length ? (
            <p className="text-xs text-neutral-500">No events</p>
          ) : (
            groups.map((g) => (
              <section key={g.title}>
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
            ))
          )}
        </div>
        {/* TONE_CHIP kept for future chips */}
        <span className="hidden" data-tone={Object.keys(TONE_CHIP).join(",")} />
      </aside>
    </div>
  )
}
