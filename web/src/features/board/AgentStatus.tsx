import { useEffect, useMemo, useState } from "react"
import type { Task, TaskEvent } from "../../api"

const CHEVRON = Array.from({ length: 9 }, (_, i) => {
  const row = Math.floor(i / 3)
  const column = i % 3
  return (column + Math.abs(row - 1)) * 90
})

const EVENT_LABELS: Record<string, string> = {
  created: "Task created",
  updated: "Task updated",
  assigned: "Agent assigned",
  unassigned: "Agent unassigned",
  promoted: "Moved to ready",
  demoted: "Moved to todo",
  scheduled: "Scheduled",
  claimed: "Worker claimed task",
  spawned: "Worker started",
  heartbeat: "Heartbeat",
  reclaimed: "Worker reclaimed",
  completed: "Completed",
  failed: "Failed",
  spawn_failed: "Spawn failed",
  blocked: "Blocked",
  gave_up: "Stopped",
  protocol_violation: "Protocol violation",
  status_changed: "Status changed",
}

export function useElapsed(startedAt?: number | null, endAt?: number | null, active = true) {
  const [now, setNow] = useState(() => Date.now())
  const fallbackStart = useState(() => Date.now())[0]

  useEffect(() => {
    if (!active || endAt) return
    const timer = window.setInterval(() => setNow(Date.now()), 100)
    return () => window.clearInterval(timer)
  }, [active, endAt])

  const baseMs = startedAt ? startedAt * 1000 : active ? fallbackStart : null
  if (baseMs == null) return "0.0s"
  const finishMs = endAt ? endAt * 1000 : now
  const seconds = Math.max(0, (finishMs - baseMs) / 1000)
  if (seconds < 60) return `${seconds.toFixed(1)}s`
  return `${Math.floor(seconds / 60)}m ${(seconds % 60).toFixed(1)}s`
}

export function LoaderGrid() {
  return (
    <span aria-hidden className="grid shrink-0 grid-cols-[repeat(3,4px)] gap-[1.5px]">
      {CHEVRON.map((delay, index) => (
        <span key={index} className="size-1 rounded-[1px] bg-[#10e0dd]" style={{ opacity: 0.18, animation: `pixel-on 650ms ease-in-out ${delay}ms infinite` }} />
      ))}
    </span>
  )
}

export function RunningIndicator({ startedAt, endAt, compact = false }: { startedAt?: number | null; endAt?: number | null; compact?: boolean }) {
  const elapsed = useElapsed(startedAt, endAt, !endAt)
  return (
    <span role="status" aria-label={`Running for ${elapsed}`} className={`inline-flex items-center ${compact ? "gap-2" : "gap-2.5"}`}>
      <LoaderGrid />
      <span className="font-mono text-[11px] tabular-nums text-neutral-400">{elapsed}</span>
    </span>
  )
}

export function splitAgentResult(result: string) {
  const markers = [...result.matchAll(/╭─\s*C:\\>\s*HERMES\s*─+/g)]
  if (markers.length < 2) return { working: result.trim(), final: "" }
  const finalStart = markers[markers.length - 1].index ?? 0
  return { working: result.slice(0, finalStart).trim(), final: result.slice(finalStart).trim() }
}

function eventLabel(event: TaskEvent) {
  return EVENT_LABELS[event.kind] ?? event.kind.replaceAll("_", " ")
}

function eventSummary(event: TaskEvent) {
  if (!event.payload) return ""
  try {
    const payload = JSON.parse(event.payload) as Record<string, unknown>
    const value = payload.new_status ?? payload.status ?? payload.reason ?? payload.error ?? payload.summary
    return value == null ? "" : String(value)
  } catch {
    return event.payload.length > 120 ? `${event.payload.slice(0, 120)}…` : event.payload
  }
}

function eventTone(event: TaskEvent) {
  if (event.kind.includes("fail") || event.kind === "blocked" || event.kind === "gave_up" || event.kind === "protocol_violation") return "text-red-300"
  if (event.kind === "completed") return "text-emerald-300"
  if (event.kind === "claimed" || event.kind === "spawned") return "text-sky-300"
  return "text-neutral-300"
}

export function AgentTaskStatus({ task, events }: { task: Task; events: TaskEvent[] }) {
  const [expanded, setExpanded] = useState(false)
  const startedEvent = events.find((event) => event.kind === "claimed" || event.kind === "spawned")
  const finishedEvent = [...events].reverse().find((event) => ["completed", "failed", "blocked", "gave_up"].includes(event.kind))
  const startedAt = task.started_at ?? startedEvent?.created_at
  const completedAt = task.completed_at ?? finishedEvent?.created_at
  const elapsed = useElapsed(startedAt, completedAt, task.status === "running")
  const rows = useMemo(() => [...events].sort((a, b) => a.created_at - b.created_at), [events])
  const visibleRows = expanded ? rows : rows.slice(-6)
  const remote = /^\/Users\//.test(task.workspace_path) || /^[A-Za-z]:[\\/]/.test(task.workspace_path)
  const live = task.status === "running" && !completedAt

  return (
    <section className="rounded-lg border border-sky-500/30 bg-sky-500/5 p-2.5" aria-label="Live agent task status">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          {live ? <LoaderGrid /> : <span className={`size-2 rounded-full ${task.status === "done" || task.status === "review" ? "bg-emerald-400" : "bg-neutral-500"}`} />}
          <h3 className="truncate text-[10px] font-semibold uppercase tracking-wider text-sky-300">Live agent status</h3>
        </div>
        <span className="font-mono text-[11px] tabular-nums text-neutral-400">{elapsed}</span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] text-neutral-500">
        <span className="rounded border border-[#1e2430] bg-[#0b0e14] px-1.5 py-0.5">{task.status}</span>
        {task.assignee && <span>agent: {task.assignee}</span>}
        {remote && <span>node: remote workspace</span>}
      </div>

      {rows.length > 0 ? (
        <div className="mt-2 max-h-48 overflow-y-auto pr-1">
          <div className="flex flex-col gap-1.5">
            {visibleRows.map((event, index) => {
              const failed = event.kind.includes("fail") || event.kind === "blocked" || event.kind === "gave_up" || event.kind === "protocol_violation"
              const current = index === visibleRows.length - 1 && live
              return (
                <div key={event.id} className="flex min-w-0 items-start gap-2 text-[11px]">
                  <span className={`mt-1.5 size-1.5 shrink-0 rounded-full ${current ? "bg-sky-400" : failed ? "bg-red-400" : event.kind === "completed" ? "bg-emerald-400" : "bg-neutral-500"}`} />
                  <div className="min-w-0 flex-1">
                    <div className={`flex items-baseline justify-between gap-2 ${eventTone(event)}`}>
                      <span className="capitalize">{eventLabel(event)}</span>
                      <span className="shrink-0 font-mono text-[10px] text-neutral-500">{new Date(event.created_at * 1000).toLocaleTimeString()}</span>
                    </div>
                    {eventSummary(event) && <p className="truncate font-mono text-[10px] text-neutral-500">{eventSummary(event)}</p>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : <p className="mt-2 text-[11px] text-neutral-500">Waiting for worker events…</p>}

      {rows.length > 6 && (
        <button type="button" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded} className="mt-2 text-[10px] text-sky-300 hover:text-sky-200">
          {expanded ? "Show latest 6" : `Show full timeline (${rows.length})`}
        </button>
      )}
    </section>
  )
}
