import type { Profile, Status, Task } from "../../api"

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

export default function TaskCard({ task, profiles, onOpen, onMove, onReassign }: {
  task: Task
  profiles: Profile[]
  onOpen: () => void
  onMove: (s: Status) => void
  onReassign: (a: string) => void
}) {
  const targets = STATUS_TARGETS[task.status] ?? []
  const profile = profiles.find((p) => p.name === task.assignee)
  return (
    <article className="rounded-md border border-[#1e2430] bg-[#0b0e14] p-2.5 text-sm hover:border-[#10e0dd]/40">
      <button onClick={onOpen} className="block w-full text-left font-medium leading-snug">
        {task.title}
      </button>
      {task.result && (
        <p className="mt-1 line-clamp-2 text-xs text-neutral-400">{task.result}</p>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
        <select
          value={task.assignee || ""}
          onChange={(e) => onReassign(e.target.value)}
          title={profile ? `${profile.name} — ${profile.model}` : "Agent profile"}
          onClick={(e) => e.stopPropagation()}
          className="max-w-32 rounded border border-[#1e2430] bg-[#11151f] px-1 py-0.5 text-[11px] text-neutral-300 outline-none"
        >
          <option value="">unassigned</option>
          {profiles.map((p) => (
            <option key={p.name} value={p.name}>{p.name}</option>
          ))}
        </select>
        {task.workspace_path && (
          <span className="truncate rounded border border-[#1e2430] bg-[#11151f] px-1.5 py-0.5 text-neutral-500" title={task.workspace_path}>
            {task.workspace_path.split("/").pop()}
          </span>
        )}
        {task.priority > 0 && (
          <span className="rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-amber-300">
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
