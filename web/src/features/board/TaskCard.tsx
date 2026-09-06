import type { Profile, Status, Task, Workspace } from "../../api"
import { Button } from "@/components/ui/button"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Apple, ExternalLink, HardDrive, Laptop } from "lucide-react"

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

function OsInfo({ ws }: { ws?: Workspace }) {
  const os = (ws?.os || "").toLowerCase()
  const path = ws?.path || ""
  const host = (ws?.host || "").toLowerCase()
  if (os === "windows" || host.includes("windows") || /^[A-Za-z]:[\\/]/.test(path)) {
    return <span className="flex items-center gap-1"><Laptop className="size-3" />win</span>
  }
  if (os === "mac" || host.includes("mac") || path.startsWith("/Users/")) {
    return <span className="flex items-center gap-1"><Apple className="size-3" />mac</span>
  }
  if (os === "linux" || ws) {
    return <span className="flex items-center gap-1"><HardDrive className="size-3" />linux</span>
  }
  return null
}

export default function TaskCard({ task, profiles, workspaces, onOpen, onOpenPage, onMove, onReassign }: {
  task: Task
  profiles: Profile[]
  workspaces?: Workspace[]
  onOpen: () => void
  onOpenPage: () => void
  onMove: (s: Status) => void
  onReassign: (a: string) => void
}) {
  const targets = STATUS_TARGETS[task.status] ?? []
  const profile = profiles.find((p) => p.name === task.assignee)
  const ws = (workspaces ?? []).find((w) => w.path === task.workspace_path)
  const wsIsSsh = ws ? !!ws.host && ws.host !== "localhost" && ws.host !== "127.0.0.1" : isSshPath(task.workspace_path || "")
  const desc = task.result || task.body
  return (
    <article className="group relative rounded-lg border border-[#1e2430]/50 bg-[#0b0e14]/40 p-3.5 shadow-none transition-colors duration-150 hover:border-[#1e2430] hover:bg-[#161b27]/30">
      {/* title + open-page icon */}
      <div className="flex items-start justify-between gap-2">
        <button onClick={onOpen} className="min-w-0 flex-1 text-left">
          <h3 className="line-clamp-2 text-sm font-semibold leading-5 text-neutral-100">{task.title}</h3>
        </button>
        <button
          onClick={onOpenPage}
          title="Buka detail page"
          className="shrink-0 rounded p-1 text-neutral-600 opacity-0 transition-opacity hover:text-[#10e0dd] focus:opacity-100 group-hover:opacity-100"
        >
          <ExternalLink className="size-3.5" />
        </button>
      </div>

      {/* description */}
      {desc && (
        <p className="mt-1.5 line-clamp-2 text-xs leading-5 text-neutral-400">{desc}</p>
      )}

      {/* metadata row: assignee primary, env secondary, os + id subtle */}
      <div className="flex items-center gap-2 pt-2.5 text-xs text-neutral-500">
        <Select value={task.assignee || "__none"} onValueChange={(v) => onReassign(v === "__none" ? "" : v)}>
          <SelectTrigger
            size="sm"
            title={profile ? `${profile.name} — ${profile.model}` : "Agent profile"}
            className="h-7 w-auto max-w-28 gap-1 rounded-md border-none bg-transparent px-1.5 text-xs font-medium text-neutral-200 shadow-none hover:bg-[#161b27] focus-visible:ring-0"
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
          <span className="text-[10px] text-red-400" title={`provider ${profile.provider} invalid — worker crash`}>broken</span>
        )}
        {task.workspace_path && (
          <span className="truncate text-xs text-neutral-500/70" title={task.workspace_path}>
            {wsIsSsh && "ssh · "}{ws?.name ?? task.workspace_path.split(/[\\/]/).pop()}
          </span>
        )}
        {task.priority > 0 && (
          <span className="text-[10px] font-medium text-amber-300/90">P{task.priority}</span>
        )}
        {task.consecutive_failures > 0 && (
          <span className="text-[10px] text-red-400">{task.consecutive_failures} fails</span>
        )}
        <span className="ml-auto flex shrink-0 items-center gap-2 text-neutral-500/60">
          <OsInfo ws={ws} />
          <span className="font-mono text-[10px] text-neutral-500/50">{task.id}</span>
        </span>
      </div>

      {/* status moves — hover only */}
      {targets.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
          {targets.map((s) => (
            <Button
              key={s}
              variant="ghost" size="sm"
              onClick={() => onMove(s)}
              className="h-5 rounded px-1.5 text-[10px] font-normal text-neutral-400 hover:bg-[#161b27] hover:text-[#10e0dd]"
            >
              → {s}
            </Button>
          ))}
        </div>
      )}
    </article>
  )
}
