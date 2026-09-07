import { useEffect, useMemo, useState } from "react"
import type { Task, TaskEvent } from "../../api"

const CHEVRON = Array.from({ length: 9 }, (_, i) => {
  const row = Math.floor(i / 3)
  const column = i % 3
  return (column + Math.abs(row - 1)) * 90
})

const EVENT_LABELS: Record<string, string> = {
  claimed: "Claimed",
  spawned: "Worker started",
  heartbeat: "Heartbeat",
  completed: "Completed",
  failed: "Failed",
  spawn_failed: "Spawn failed",
  blocked: "Blocked",
  gave_up: "Stopped",
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

export function AgentTaskStatus({ task, events }: { task: Task; events: TaskEvent[] }) {
  const startedEvent = events.find((event) => event.kind === "claimed" || event.kind === "spawned")
  const finishedEvent = [...events].reverse().find((event) => event.kind === "completed" || event.kind === "failed" || event.kind === "blocked" || event.kind === "gave_up")
  const startedAt = task.started_at ?? startedEvent?.created_at
  const completedAt = task.completed_at ?? finishedEvent?.created_at
  const elapsed = useElapsed(startedAt, completedAt, task.status === "running")
  const rows = useMemo(() => events.filter((event) => EVENT_LABELS[event.kind]).slice(-6).reverse(), [events])
  const running = task.status === "running" && !completedAt

  return (
    <section className="rounded-lg border border-sky-500/30 bg-sky-500/5 p-2.5" aria-label="Live agent task status">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          {running ? <LoaderGrid /> : <span className={`size-2 rounded-full ${task.status === "done" || task.status === "review" ? "bg-emerald-400" : "bg-neutral-500"}`} />}
          <h3 className="truncate text-[10px] font-semibold uppercase tracking-wider text-sky-300">Live agent status</h3>
        </div>
        <span className="font-mono text-[11px] tabular-nums text-neutral-400">{elapsed}</span>
      </div>
      {rows.length > 0 ? (
        <div className="mt-2 flex flex-col gap-1.5">
          {rows.map((event, index) => {
            const failed = event.kind.includes("fail") || event.kind === "blocked"
            return (
              <div key={event.id} className="flex items-center gap-2 text-[11px]">
                <span className={`size-1.5 rounded-full ${index === 0 && running ? "bg-sky-400" : failed ? "bg-red-400" : "bg-emerald-400"}`} />
                <span className="capitalize text-neutral-300">{eventLabel(event)}</span>
                <span className="ml-auto font-mono text-[10px] text-neutral-500">{new Date(event.created_at * 1000).toLocaleTimeString()}</span>
              </div>
            )
          })}
        </div>
      ) : <p className="mt-2 text-[11px] text-neutral-500">Waiting for worker events…</p>}
    </section>
  )
}
