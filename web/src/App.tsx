import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar, type Page } from "@/components/AppSidebar"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { api, COLUMNS, type Board, type Profile, type Status, type Task, type Workspace } from "./api"
import TaskCard from "./features/board/TaskCard"
import TaskDialog from "./features/board/TaskDialog"
import TaskDetail from "./features/board/TaskDetail"
import WorkspacesPage from "./features/workspaces/WorkspacesPage"
import ProfilesPage from "./features/profiles/ProfilesPage"
import ProvidersPage from "./features/providers/ProvidersPage"
import LogsPage from "./features/logs/LogsPage"
import SkillsPage from "./features/skills/SkillsPage"
import MemoryPage from "./features/memory/MemoryPage"
import { Archive, Plus, Search, SlidersHorizontal, X } from "lucide-react"

// board columns + trailing archived column (collapsed by default content-wise)
const BOARD_COLUMNS: Status[] = [...COLUMNS, "archived"]

const PROFILE_OPTIONS = [
  { value: "__all", label: "Semua agent" },
]

const WORKSPACE_OPTIONS = [
  { value: "__all", label: "Semua workspace" },
]

export default function App() {
  const [page, setPage] = useState<Page>("board")
  const [slug, setSlug] = useState("f8-saas")
  const [creating, setCreating] = useState(false)
  const [creatingBoard, setCreatingBoard] = useState(false)
  const [detail, setDetail] = useState<Task | null>(null)
  // right filter rail: null = closed, true = expanded, false = collapsed-to-rail
  const [filtersOpen, setFiltersOpen] = useState<boolean | null>(null)
  const [q, setQ] = useState("")
  const [fStatus, setFStatus] = useState("__all")
  const [fAgent, setFAgent] = useState("__all")
  const [fWorkspace, setFWorkspace] = useState("__all")
  const [fPriority, setFPriority] = useState("__all")
  const qc = useQueryClient()

  const boards = useQuery({ queryKey: ["boards"], queryFn: () => api<Board[]>("/api/boards") })
  const tasks = useQuery({ queryKey: ["tasks", slug], queryFn: () => api<Task[]>(`/api/boards/${slug}/tasks`), enabled: page === "board" })
  const workspaces = useQuery({ queryKey: ["workspaces"], queryFn: () => api<Workspace[]>("/api/workspaces") })
  const profiles = useQuery({ queryKey: ["profiles"], queryFn: () => api<Profile[]>("/api/profiles") })

  const move = useMutation({
    mutationFn: ({ id, status }: { id: string; status: Status }) =>
      api(`/api/boards/${slug}/tasks/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks", slug] }),
  })

  const reassign = useMutation({
    mutationFn: ({ id, assignee }: { id: string; assignee: string }) =>
      api(`/api/boards/${slug}/tasks/${id}/assignee`, { method: "PATCH", body: JSON.stringify({ assignee }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks", slug] }),
  })

  const active = (boards.data ?? []).filter((b) => !["default", "archived"].includes(b.slug))

  const filtered = useMemo(() => {
    let list = tasks.data ?? []
    const needle = q.trim().toLowerCase()
    if (needle) {
      list = list.filter((t) =>
        t.title.toLowerCase().includes(needle) ||
        (t.body ?? "").toLowerCase().includes(needle) ||
        t.id.toLowerCase().includes(needle) ||
        (t.result ?? "").toLowerCase().includes(needle),
      )
    }
    if (fStatus !== "__all") list = list.filter((t) => t.status === fStatus)
    if (fAgent !== "__all") list = list.filter((t) => (t.assignee || "") === fAgent)
    if (fWorkspace !== "__all") list = list.filter((t) => t.workspace_path === fWorkspace)
    if (fPriority !== "__all") list = list.filter((t) => String(t.priority) === fPriority)
    return list
  }, [tasks.data, q, fStatus, fAgent, fWorkspace, fPriority])

  const filtersActive = q.trim() !== "" || fStatus !== "__all" || fAgent !== "__all" || fWorkspace !== "__all" || fPriority !== "__all"

  function clearFilters() {
    setQ(""); setFStatus("__all"); setFAgent("__all"); setFWorkspace("__all"); setFPriority("__all")
  }

  const byCol = (s: Status) => filtered.filter((t) => t.status === s)
  const pageTitle =
    page === "workspaces" ? "Workspaces"
    : page === "profiles" ? "Agent Profiles"
    : page === "providers" ? "Providers"
    : page === "logs" ? "Logs"
    : page === "skills" ? "Skills"
    : page === "memory" ? "Memory"
    : "Kanban Board"

  // header stays fixed, board scrolls horizontally, each column scrolls its cards internally
  const boardBody =
    tasks.isLoading ? (
      <p className="p-6 text-sm text-neutral-400">Loading…</p>
    ) : tasks.isError ? (
      <p className="p-6 text-sm text-red-400">Gagal load tasks: {(tasks.error as Error).message}</p>
    ) : (
      <main className="flex min-h-0 flex-1 gap-3 overflow-x-auto overflow-y-hidden p-3">
        {BOARD_COLUMNS.map((col) => {
          const cards = byCol(col)
          return (
          <section key={col} className={`flex h-full shrink-0 flex-col rounded-lg border border-[#1e2430] bg-[#11151f] ${col === "archived" ? "w-60 opacity-90" : "w-72"}`}>
            <h2 className="flex shrink-0 items-center justify-between border-b border-[#1e2430] px-3 py-2 text-xs font-semibold uppercase tracking-wider text-neutral-400">
              <span className="flex items-center gap-1.5">
                {col === "archived" && <Archive className="size-3" />}
                {col}
              </span>
              <span className="rounded bg-[#0b0e14] px-1.5 py-0.5 text-[10px]">{cards.length}</span>
            </h2>
            <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-2 py-2">
              {cards.map((t) => (
                <TaskCard
                  key={t.id}
                  task={t}
                  onOpen={() => setDetail(t)}
                  onMove={(s) => move.mutate({ id: t.id, status: s })}
                  onReassign={(a) => reassign.mutate({ id: t.id, assignee: a })}
                  profiles={profiles.data ?? []}
                  workspaces={workspaces.data ?? []}
                />
              ))}
              {!cards.length && (
                <p className="px-1 py-2 text-[11px] text-neutral-600">empty</p>
              )}
            </div>
          </section>
          )
        })}
      </main>
    )

  const filterRail = page === "board" && (
    <aside className={`flex h-full flex-col border-l border-[#1e2430] bg-[#11151f] transition-all ${filtersOpen === null ? "w-10" : filtersOpen ? "w-72" : "w-10"}`}>
      <div className="flex h-14 shrink-0 items-center justify-center border-b border-[#1e2430]">
        <button
          onClick={() => setFiltersOpen((v) => (v === null ? true : v ? false : true))}
          className="relative rounded p-1.5 text-neutral-300 hover:text-[#10e0dd]"
          title="Toggle filter panel"
        >
          <SlidersHorizontal className="size-4" />
          {filtersActive && (
            <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-[#10e0dd]" />
          )}
        </button>
      </div>
      {filtersOpen !== null && filtersOpen && (
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Filters</h2>
            {filtersActive && (
              <Button variant="ghost" size="sm" className="h-6 gap-1 px-2 text-[11px] text-neutral-400" onClick={clearFilters}>
                <X className="size-3" /> reset
              </Button>
            )}
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-neutral-500" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari judul / body / id / result…"
              className="h-8 border-[#1e2430] bg-[#0b0e14] pl-7 text-xs" />
          </div>
          <div>
            <label className="mb-1 block text-[11px] text-neutral-500">Status</label>
            <Select value={fStatus} onValueChange={setFStatus}>
              <SelectTrigger size="sm" className="w-full border-[#1e2430] bg-[#0b0e14] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent className="border-[#1e2430] bg-[#11151f]">
                <SelectItem value="__all" className="text-xs">Semua status</SelectItem>
                {BOARD_COLUMNS.map((s) => (
                  <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-[11px] text-neutral-500">Agent</label>
            <Select value={fAgent} onValueChange={setFAgent}>
              <SelectTrigger size="sm" className="w-full border-[#1e2430] bg-[#0b0e14] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent className="border-[#1e2430] bg-[#11151f]">
                {PROFILE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
                ))}
                {(profiles.data ?? []).map((p) => (
                  <SelectItem key={p.name} value={p.name} className="text-xs">{p.name}</SelectItem>
                ))}
                <SelectItem value="" className="text-xs">unassigned</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-[11px] text-neutral-500">Workspace</label>
            <Select value={fWorkspace} onValueChange={setFWorkspace}>
              <SelectTrigger size="sm" className="w-full border-[#1e2430] bg-[#0b0e14] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent className="border-[#1e2430] bg-[#11151f]">
                {WORKSPACE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
                ))}
                {(workspaces.data ?? []).map((w) => (
                  <SelectItem key={w.id} value={w.path} className="text-xs">{w.name}</SelectItem>
                ))}
                <SelectItem value="" className="text-xs">scratch (no path)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-[11px] text-neutral-500">Priority</label>
            <Select value={fPriority} onValueChange={setFPriority}>
              <SelectTrigger size="sm" className="w-full border-[#1e2430] bg-[#0b0e14] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent className="border-[#1e2430] bg-[#11151f]">
                <SelectItem value="__all" className="text-xs">Semua</SelectItem>
                <SelectItem value="0" className="text-xs">P0 normal</SelectItem>
                <SelectItem value="1" className="text-xs">P1</SelectItem>
                <SelectItem value="2" className="text-xs">P2 high</SelectItem>
                <SelectItem value="3" className="text-xs">P3 urgent</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="mt-auto text-[10px] text-neutral-600">
            {filtered.length} / {tasks.data?.length ?? 0} tasks match
          </div>
        </div>
      )}
      {filtersOpen === false && (
        <div className="flex flex-col items-center gap-2 py-3 text-[10px] text-neutral-600">
          {filtersActive && <Badge className="bg-[#10e0dd] text-black">on</Badge>}
        </div>
      )}
    </aside>
  )

  return (
    <SidebarProvider>
      <AppSidebar
        page={page}
        boards={active}
        slug={slug}
        onSelectPage={setPage}
        onSelectBoard={(s) => { setSlug(s); setPage("board") }}
        onNewBoard={() => setCreatingBoard(true)}
      />
      <SidebarInset className="flex h-dvh flex-col overflow-hidden bg-[#0b0e14]">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-[#1e2430] bg-[#11151f] px-4">
          <SidebarTrigger className="-ml-1 text-neutral-300 hover:text-[#10e0dd]" />
          <Separator orientation="vertical" className="mr-1 h-5" />
          <h1 className="text-sm font-semibold tracking-tight">{pageTitle}</h1>

          {page === "board" && (
            <>
              <Select value={slug} onValueChange={setSlug}>
                <SelectTrigger size="sm" className="w-auto gap-1.5 border-[#1e2430] bg-[#0b0e14] text-xs">
                  <SelectValue placeholder="board" />
                </SelectTrigger>
                <SelectContent className="border-[#1e2430] bg-[#11151f]">
                  {active.map((b) => (
                    <SelectItem key={b.slug} value={b.slug} className="text-xs">
                      {b.icon ? `${b.icon} ` : ""}{b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="rounded bg-[#0b0e14] px-1.5 py-0.5 text-[10px] text-neutral-400">
                {filtersActive ? `${filtered.length}/${tasks.data?.length ?? 0}` : `${tasks.data?.length ?? 0}`} tasks
              </span>
              <Button size="sm" onClick={() => setCreating(true)}
                className="ml-auto bg-[#10e0dd] text-black hover:bg-[#10e0dd]/90">
                <Plus className="size-3.5" /> New Task
              </Button>
            </>
          )}
        </header>

        <div className="flex min-h-0 flex-1 overflow-hidden">
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {page === "workspaces" && <div className="flex-1 overflow-y-auto"><WorkspacesPage /></div>}
            {page === "profiles" && <div className="flex-1 overflow-y-auto"><ProfilesPage /></div>}
            {page === "providers" && <div className="flex-1 overflow-y-auto"><ProvidersPage /></div>}
            {page === "logs" && <div className="flex min-h-0 flex-1 flex-col"><LogsPage /></div>}
            {page === "skills" && <div className="flex min-h-0 flex-1 flex-col overflow-hidden"><SkillsPage /></div>}
            {page === "memory" && <div className="flex-1 overflow-y-auto"><MemoryPage /></div>}
            {page === "board" && boardBody}
          </div>
          {filterRail}
        </div>
      </SidebarInset>

      {creating && (
        <TaskDialog
          workspaces={workspaces.data ?? []}
          profiles={profiles.data ?? []}
          onClose={() => setCreating(false)}
          onCreate={(payload) =>
            api(`/api/boards/${slug}/tasks`, { method: "POST", body: JSON.stringify(payload) }).then(() => {
              qc.invalidateQueries({ queryKey: ["tasks", slug] })
              setCreating(false)
            })
          }
        />
      )}
      {creatingBoard && (
        <NewBoardDialog
          onClose={() => setCreatingBoard(false)}
          onCreated={(b) => {
            qc.invalidateQueries({ queryKey: ["boards"] })
            if (b?.slug) setSlug(b.slug)
            setCreatingBoard(false)
          }}
        />
      )}
      {detail && (
        <TaskDetail
          slug={slug}
          task={detail}
          profiles={profiles.data ?? []}
          onClose={() => setDetail(null)}
          onMove={(s) => move.mutateAsync({ id: detail.id, status: s }).then(() => setDetail({ ...detail, status: s }))}
          onReassign={(a) =>
            reassign.mutateAsync({ id: detail.id, assignee: a }).then(() => setDetail({ ...detail, assignee: a }))
          }
        />
      )}
    </SidebarProvider>
  )
}

function NewBoardDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (b: Board | null) => void }) {
  const [slug, setSlug] = useState("")
  const [name, setName] = useState("")
  const [icon, setIcon] = useState("🗂")
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function submit() {
    if (!slug.trim()) { setErr("Slug required"); return }
    setBusy(true); setErr(null)
    try {
      const b = await api<Board>("/api/boards", {
        method: "POST",
        body: JSON.stringify({ slug: slug.trim().toLowerCase(), name: name.trim(), icon }),
      })
      onCreated(b)
    } catch (e) { setErr((e as Error).message); setBusy(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-lg border border-[#1e2430] bg-[#11151f] p-4" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-sm font-semibold">New Board</h2>
        <label className="mt-3 block text-xs text-neutral-400">Slug</label>
        <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="f8-gadjian"
          className="mt-1 border-[#1e2430] bg-[#0b0e14]" />
        <label className="mt-3 block text-xs text-neutral-400">Name</label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="F8 Gadjian"
          className="mt-1 border-[#1e2430] bg-[#0b0e14]" />
        <label className="mt-3 block text-xs text-neutral-400">Icon (emoji)</label>
        <Input value={icon} onChange={(e) => setIcon(e.target.value)} className="mt-1 w-20 border-[#1e2430] bg-[#0b0e14]" />
        {err && <p className="mt-3 text-xs text-red-400">{err}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" disabled={busy} onClick={submit} className="bg-[#10e0dd] text-black hover:bg-[#10e0dd]/90">
            {busy ? "…" : "Create"}
          </Button>
        </div>
      </div>
    </div>
  )
}
