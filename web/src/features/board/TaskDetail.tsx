import { useQuery } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { api, COLUMNS, type Profile, type Status, type Task, type TaskEvent } from "../../api"
import { ExternalLink } from "lucide-react"

const STATUS_CHIP: Record<string, string> = {
  done: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  running: "border-sky-500/40 bg-sky-500/10 text-sky-300",
  blocked: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  review: "border-violet-500/40 bg-violet-500/10 text-violet-300",
}

export default function TaskDetail({
  slug,
  task,
  profiles,
  onClose,
  onMove,
  onReassign,
  onOpenPage,
}: {
  slug: string
  task: Task
  profiles: Profile[]
  onClose: () => void
  onMove: (s: Status) => Promise<void>
  onReassign: (a: string) => Promise<void>
  onOpenPage: () => void
}) {
  const events = useQuery({
    queryKey: ["events", slug, task.id],
    queryFn: () => api<TaskEvent[]>(`/api/boards/${slug}/tasks/${task.id}/events`),
  })
  const profile = profiles.find((p) => p.name === task.assignee)

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <aside
        className="flex h-full w-full max-w-md flex-col gap-3 border-l border-[#1e2430] bg-[#11151f] p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-sm font-semibold leading-snug">{task.title}</h2>
          <Button variant="outline" size="sm" className="shrink-0 px-2" onClick={onClose}>✕</Button>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-neutral-500">
          <Badge variant="outline" className="px-1.5 py-0 font-mono text-[9px] leading-none text-neutral-400">{task.id}</Badge>
          <Badge variant="outline" className={`px-1.5 py-0 text-[9px] leading-none ${STATUS_CHIP[task.status] ?? "border-[#1e2430] bg-[#161b27] text-neutral-300"}`}>{task.status}</Badge>
          {task.priority > 0 && (
            <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 px-1.5 py-0 text-[9px] leading-none text-amber-300">P{task.priority}</Badge>
          )}
          <span>dibuat {new Date(task.created_at * 1000).toLocaleString()}</span>
        </div>

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
          {profile && !profile.valid && (
            <p className="mt-1 text-[10px] text-red-400">Provider invalid — worker bakal crash.</p>
          )}
        </div>

        {task.body && (
          <div className="max-h-24 overflow-y-auto rounded-lg border border-[#1e2430] bg-[#0b0e14] p-2.5">
            <p className="whitespace-pre-wrap break-words text-xs leading-relaxed text-neutral-300">{task.body}</p>
          </div>
        )}
        {task.result && (
          <div className="max-h-28 overflow-y-auto rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-2.5">
            <p className="whitespace-pre-wrap break-words text-[11px] leading-relaxed text-emerald-100/90">{task.result}</p>
          </div>
        )}

        <div className="flex flex-wrap gap-1.5">
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

        <div className="mt-auto space-y-1.5">
          <p className="text-[10px] text-neutral-600">{events.data?.length ?? 0} events tercatat — lihat lengkapnya di halaman detail.</p>
          <Button onClick={onOpenPage} className="w-full gap-1.5 bg-[#10e0dd] text-black hover:bg-[#10e0dd]/90">
            <ExternalLink className="size-3.5" /> Buka detail page
          </Button>
        </div>
      </aside>
    </div>
  )
}
