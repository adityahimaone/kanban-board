import type { Profile, Status, Task } from "../../api"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"

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
        <Select value={task.assignee || "__none"} onValueChange={(v) => onReassign(v === "__none" ? "" : v)}>
          <SelectTrigger
            size="sm"
            title={profile ? `${profile.name} — ${profile.model}` : "Agent profile"}
            onClick={(e) => e.stopPropagation()}
            className="h-6 w-28 gap-1 border-[#1e2430] bg-[#11151f] px-1.5 text-[11px] text-neutral-300"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="border-[#1e2430] bg-[#11151f]">
            <SelectItem value="__none" className="text-[11px]">unassigned</SelectItem>
            {profiles.map((p) => (
              <SelectItem key={p.name} value={p.name} disabled={!p.valid} className="text-[11px]">{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {profile && !profile.valid && (
          <Badge variant="outline" className="border-red-500/30 bg-red-500/15 text-red-300" title={`provider ${profile.provider} invalid — worker crash`}>
            broken config
          </Badge>
        )}
        {task.workspace_path && (
          <Badge variant="outline" className="max-w-24 border-[#1e2430] bg-[#11151f] font-normal text-neutral-500" title={task.workspace_path}>
            <span className="truncate">{task.workspace_path.split("/").pop()}</span>
          </Badge>
        )}
        {task.priority > 0 && (
          <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-300">
            P{task.priority}
          </Badge>
        )}
        {task.consecutive_failures > 0 && (
          <Badge variant="outline" className="border-red-500/30 bg-red-500/15 text-red-300">
            {task.consecutive_failures} fails
          </Badge>
        )}
        {targets.map((s) => (
          <Button
            key={s}
            variant="outline" size="sm"
            onClick={() => onMove(s)}
            className="ml-auto h-5 rounded border-[#1e2430] px-1.5 text-[10px] font-normal text-neutral-400 hover:border-[#10e0dd]/50 hover:text-[#10e0dd] first:ml-0"
          >
            → {s}
          </Button>
        ))}
      </div>
    </article>
  )
}
