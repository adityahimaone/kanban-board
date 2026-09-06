import type { Profile, Status, Task, Workspace } from "../../api"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Apple, Laptop, Monitor, HardDrive } from "lucide-react"

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

function isSshPath(path: string): boolean {
  return /^[A-Za-z]:[\\/]/.test(path) || path.startsWith("/Users/")
}

function OsBadge({ ws }: { ws?: Workspace }) {
  const os = (ws?.os || "").toLowerCase()
  const path = ws?.path || ""
  const host = (ws?.host || "").toLowerCase()
  let label = ""
  let Icon = Monitor
  let tint = ""
  if (os === "windows" || host.includes("windows") || /^[A-Za-z]:[\\/]/.test(path)) {
    label = "windows"; Icon = Laptop; tint = "border-sky-500/30 bg-sky-500/10 text-sky-300"
  } else if (os === "mac" || host.includes("mac") || path.startsWith("/Users/")) {
    label = "mac"; Icon = Apple; tint = "border-neutral-700 bg-[#0b0e14] text-neutral-300"
  } else if (os === "linux" || ws) {
    label = "linux"; Icon = HardDrive; tint = "border-amber-500/30 bg-amber-500/10 text-amber-300"
  } else {
    return null
  }
  return (
    <Badge variant="outline" className={`gap-0.5 px-1 py-0 text-[9px] leading-none ${tint}`}>
      <Icon className="size-2.5" /> {label}
    </Badge>
  )
}

export default function TaskCard({ task, profiles, workspaces, onOpen, onMove, onReassign }: {
  task: Task
  profiles: Profile[]
  workspaces?: Workspace[]
  onOpen: () => void
  onMove: (s: Status) => void
  onReassign: (a: string) => void
}) {
  const targets = STATUS_TARGETS[task.status] ?? []
  const profile = profiles.find((p) => p.name === task.assignee)
  const ws = (workspaces ?? []).find((w) => w.path === task.workspace_path)
  const wsIsSsh = ws ? !!ws.host && ws.host !== "localhost" && ws.host !== "127.0.0.1" : isSshPath(task.workspace_path || "")
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
          <Badge
            variant="outline"
            className={`max-w-24 px-1 py-0 font-normal text-[9px] leading-none ${wsIsSsh ? "border-violet-500/30 bg-violet-500/10 text-violet-300" : "border-[#1e2430] bg-[#11151f] text-neutral-500"}`}
            title={task.workspace_path}
          >
            {wsIsSsh && "ssh · "}<span className="truncate">{task.workspace_path.split(/[\\/]/).pop()}</span>
          </Badge>
        )}
        <OsBadge ws={ws} />
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
