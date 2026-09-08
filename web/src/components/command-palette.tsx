import { useEffect, useMemo, useState } from "react"
import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import type { Board, Task } from "@/api"
import type { Page } from "@/lib/sidebar-preferences"

export default function CommandPalette({
  board,
  boards,
  tasks,
  page,
  onPage,
  onNewTask,
  onToggleFilters,
  onOpenTask,
  onOpenBoard,
}: {
  board: Board | null
  boards?: Board[]
  tasks: Task[]
  page: Page
  onPage: (page: Page) => void
  onNewTask: () => void
  onToggleFilters: () => void
  onOpenTask?: (taskId: string) => void
  onOpenBoard?: (slug: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState("")
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen(true); setQ("") }
      if (e.key === "Escape") setOpen(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])
  const needle = q.trim().toLowerCase()
  const actions = useMemo(() => {
    const all = [
      { label: `New task${board ? ` in ${board.name}` : ""}`, run: onNewTask },
      { label: `Open ${page === "board" ? "overview" : "board"}`, run: () => onPage(page === "board" ? "overview" : "board") },
      { label: "Open settings", run: () => onPage("settings") },
      { label: "Toggle filters", run: onToggleFilters },
    ]
    if (!needle) return all
    return all.filter((x) => x.label.toLowerCase().includes(needle))
  }, [board, page, onPage, onNewTask, onToggleFilters, needle])
  const matchedTasks = useMemo(() => {
    if (!needle) return []
    return tasks.filter((t) => t.title.toLowerCase().includes(needle) || t.id.toLowerCase().includes(needle)).slice(0, 8)
  }, [tasks, needle])
  const matchedBoards = useMemo(() => {
    if (!needle || !boards?.length) return []
    return boards.filter((b) => b.name.toLowerCase().includes(needle) || b.slug.toLowerCase().includes(needle)).slice(0, 6)
  }, [boards, needle])
  if (!open) return null
  const empty = !actions.length && !matchedTasks.length && !matchedBoards.length
  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center bg-black/50 p-4 pt-[15vh]" onClick={() => setOpen(false)}>
      <div className="w-full max-w-lg rounded-xl border border-[var(--color-line)] bg-[var(--color-surface-raised)] p-3 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-neutral-500" />
          <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Type command, task title/id, or board…" className="h-9 pl-8" />
        </div>
        <div className="mt-2 max-h-[50vh] space-y-3 overflow-y-auto">
          {actions.length > 0 && (
            <div className="space-y-1">
              <p className="px-2 text-[10px] uppercase tracking-wider text-neutral-500">Commands</p>
              {actions.map((a) => (
                <Button key={a.label} variant="ghost" size="sm" className="w-full justify-start text-xs" onClick={() => { a.run(); setOpen(false) }}>
                  {a.label}
                </Button>
              ))}
            </div>
          )}
          {matchedBoards.length > 0 && (
            <div className="space-y-1">
              <p className="px-2 text-[10px] uppercase tracking-wider text-neutral-500">Boards · {matchedBoards.length}</p>
              {matchedBoards.map((b) => (
                <Button key={b.slug} variant="ghost" size="sm" className="w-full justify-start gap-1.5 text-xs" onClick={() => { onOpenBoard?.(b.slug); setOpen(false) }}>
                  <span>{b.icon}</span>
                  <span className="truncate">{b.name}</span>
                  <span className="ml-auto font-mono text-[10px] text-neutral-500">{b.slug}</span>
                </Button>
              ))}
            </div>
          )}
          {matchedTasks.length > 0 && (
            <div className="space-y-1">
              <p className="px-2 text-[10px] uppercase tracking-wider text-neutral-500">Tasks · {matchedTasks.length}</p>
              {matchedTasks.map((t) => (
                <Button key={t.id} variant="ghost" size="sm" className="w-full justify-start gap-2 text-xs" onClick={() => { if (onOpenTask) onOpenTask(t.id); else onPage("board"); setOpen(false) }}>
                  <span className="min-w-0 flex-1 truncate text-left">{t.title}</span>
                  <span className="shrink-0 font-mono text-[10px] text-neutral-500">{t.id.slice(0, 8)}</span>
                  <span className="shrink-0 text-[10px] text-neutral-600">{t.status}</span>
                </Button>
              ))}
            </div>
          )}
          {empty && <p className="p-3 text-xs text-neutral-500">No matching commands</p>}
        </div>
      </div>
    </div>
  )
}
