import type { Status, Task } from "../../api"

const STATUS_TARGETS: Record<Status, Status[]> = {
  triage: ["todo", "ready"],
  todo: ["ready", "blocked", "triage"],
  scheduled: ["ready", "todo"],
  ready: ["todo", "blocked"],
  running: ["blocked", "review", "done"],
  blocked: ["todo", "ready"],
  review: ["done", "blocked", "todo"],
  done: [],
  archived: [],
}

const BADGE: Record<string, string> = {
  running: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  done: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  blocked: "bg-red-500/15 text-red-300 border-red-500/30",
  review: "bg-amber-500/15 text-amber-300 border-amber-500/30",
}

export default function TaskCard({ task, onOpen, onMove }: {
  task: Task
  onOpen: () => void
  onMove: (s: Status) => void
}) {
  const targets = STATUS_TARGETS[task.status] ?? []
  return (
    <article className="rounded-md border border-[#1e2430] bg-[#0b0e14] p-2.5 text-sm hover:border-[#10e0dd]/40">
      <button onClick={onOpen} className="block w-full text-left font-medium leading-snug">
        {task.title}
      </button>
      {task.result && (
        <p className="mt-1 line-clamp-2 text-xs text-neutral-400">{task.result}</p>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
        {task.assignee && (
          <span className="rounded border border-[#1e2430] bg-[#11151f] px-1.5 py-0.5 text-neutral-300">
            @{task.assignee}
          </span>
        )}
        {task.workspace_path && (
          <span className="truncate rounded border border-[#1e2430] bg-[#11151f] px-1.5 py-0.5 text-neutral-500" title={task.workspace_path}>
            {task.workspace_path.split("/").pop()}
          </span>
        )}
        {task.priority > 0 && (
          <span className={`rounded border px-1.5 py-0.5 ${BADGE[task.status] ?? "border-[#1e2430] text-neutral-400"}`}>
            P{task.priority}
          </span>
        )}
        {task.consecutive_failures > 0 && (
          <span className="rounded border border-red-500/30 bg-red-500/15 px-1.5 py-0.5 text-red-300">
            {task.consecutive_failures} fails
          </span>
        )}
        {targets.map((s) => (
          <button
            key={s}
            onClick={() => onMove(s)}
            className="ml-auto first:ml-0 rounded border border-[#1e2430] px-1.5 py-0.5 text-neutral-400 hover:border-[#10e0dd]/50 hover:text-[#10e0dd]"
          >
            → {s}
          </button>
        ))}
      </div>
    </article>
  )
}
