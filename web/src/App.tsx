import { useEffect, useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { AppShell } from "@/components/app-shell"
import { AppHeader } from "@/components/app-header"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { api, COLUMNS, type Board, type Profile, type Status, type Task, type Workspace } from "./api"
import TaskCard from "./features/board/TaskCard"
import TaskDialog from "./features/board/TaskDialog"
import TaskDetail from "./features/board/TaskDetail"
import TaskDetailPage from "./features/board/TaskDetailPage"
import WorkspacesPage from "./features/workspaces/WorkspacesPage"
import ProfilesPage from "./features/profiles/ProfilesPage"
import ProvidersPage from "./features/providers/ProvidersPage"
import LogsPage from "./features/logs/LogsPage"
import SkillsPage from "./features/skills/SkillsPage"
import MemoryPage from "./features/memory/MemoryPage"
import SettingsPage from "./features/settings/SettingsPage"
import OverviewPage from "./features/overview/OverviewPage"
import AgentMappingPage from "./features/flow/AgentMappingPage"
import { Archive, Plus, Pencil, Search, X } from "lucide-react"
import { useSettings } from "./hooks/useSettings"
import LoadingState from "./components/LoadingState"
import { pagePath, parseRoute } from "./lib/routes"
import { SIDEBAR_ITEMS, type Page } from "./lib/sidebar-preferences"

const BOARD_COLUMNS: Status[] = [...COLUMNS, "archived"]

const PROFILE_OPTIONS = [{ value: "__all", label: "Semua agent" }]
const WORKSPACE_OPTIONS = [{ value: "__all", label: "Semua workspace" }]

function labelForPage(page: Page): string {
  const item = SIDEBAR_ITEMS.find((i) => i.id === page)
  if (item) return item.label
  if (page === "settings") return "Settings"
  return page
}

export default function App() {
  const initialRoute = useMemo(() => parseRoute(window.location.pathname), [])
  const [page, setPage] = useState<Page>(initialRoute.page)
  const [slug, setSlug] = useState(initialRoute.slug ?? "f8-saas")
  const [creating, setCreating] = useState(false)
  const [creatingBoard, setCreatingBoard] = useState(false)
  const [editingBoard, setEditingBoard] = useState(false)
  const [detail, setDetail] = useState<Task | null>(null)
  const [detailId, setDetailId] = useState<string | null>(initialRoute.taskId ?? null)
  const [filtersOpen, setFiltersOpen] = useState(true)
  const [q, setQ] = useState("")
  const [fStatus, setFStatus] = useState("__all")
  const [fAgent, setFAgent] = useState("__all")
  const [fWorkspace, setFWorkspace] = useState("__all")
  const [fPriority, setFPriority] = useState("__all")
  const { refreshMs } = useSettings()
  const qc = useQueryClient()

  const boards = useQuery({ queryKey: ["boards"], queryFn: () => api<Board[]>("/api/boards") })
  const tasks = useQuery({ queryKey: ["tasks", slug], queryFn: () => api<Task[]>(`/api/boards/${slug}/tasks`), enabled: page === "board", refetchInterval: refreshMs > 0 ? refreshMs : false })
  const workspaces = useQuery({ queryKey: ["workspaces"], queryFn: () => api<Workspace[]>("/api/workspaces") })
  const profiles = useQuery({ queryKey: ["profiles"], queryFn: () => api<Profile[]>("/api/profiles") })

  const detailPage = detailId ? (tasks.data ?? []).find((task) => task.id === detailId) ?? null : null

  useEffect(() => {
    if (window.location.pathname === "/") {
      window.history.replaceState({}, "", pagePath(initialRoute.page, initialRoute.slug ?? "f8-saas", initialRoute.taskId))
    }
    const onPopState = () => {
      const route = parseRoute(window.location.pathname)
      setPage(route.page)
      setSlug(route.slug ?? "f8-saas")
      setDetailId(route.taskId ?? null)
      setDetail(null)
    }
    window.addEventListener("popstate", onPopState)
    return () => window.removeEventListener("popstate", onPopState)
  }, [])

  function go(path: string) {
    window.history.pushState({}, "", path)
  }

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

  const stop = useMutation({
    mutationFn: (id: string) =>
      api(`/api/boards/${slug}/tasks/${id}/stop`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks", slug] }),
  })

  const active = (boards.data ?? []).filter((b) => b.slug !== "archived")
  const currentBoard = active.find((b) => b.slug === slug) ?? null

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

  const breadcrumb =
    detailPage
      ? { title: detailPage.title }
      : { title: page === "board" ? "Task Board" : labelForPage(page) }

  function handleSelectPage(p: Page) {
    if (p === "board") {
      if (detailId) { setDetail(null); setDetailId(null); setPage("board"); go(pagePath("board", slug)); return }
      if (page === "board") { setFiltersOpen((v) => !v); return }
      setDetail(null); setPage("board"); go(pagePath("board", slug))
      return
    }
    setDetail(null)
    setDetailId(null)
    setPage(p)
    go(pagePath(p, slug))
  }

  const boardBody =
    tasks.isLoading ? (
      <LoadingState variant="board" label="Memuat kanban" />
    ) : tasks.isError ? (
      <p className="p-6 text-sm text-red-400">Gagal load tasks: {(tasks.error as Error).message}</p>
    ) : (
      <main className="flex min-h-0 flex-1 gap-3 overflow-x-auto overflow-y-hidden p-3">
        {BOARD_COLUMNS.map((col) => {
          const cards = byCol(col)
          return (
          <section key={col} className={`flex h-full shrink-0 flex-col overflow-hidden rounded-xl border border-line/70 bg-surface/60 backdrop-blur supports-[backdrop-filter]:bg-surface/60 ${col === "archived" ? "w-60 opacity-90" : "w-72"}`}>
            <h2 className="flex shrink-0 items-center justify-between px-3 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-400">
              <span className="flex items-center gap-1.5">
                {col === "archived" && <Archive className="size-3" />}
                {col}
              </span>
              <span className="rounded bg-[var(--color-bg)] px-1.5 py-0.5 text-[10px]">{cards.length}</span>
            </h2>
            <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-2 py-2">
              {cards.map((t) => (
                <TaskCard
                  key={t.id}
                  task={t}
                  onOpen={() => setDetail(t)}
                  onOpenPage={() => { setDetail(null); setDetailId(t.id); go(pagePath("board", slug, t.id)) }}
                  onMove={(s) => move.mutate({ id: t.id, status: s })}
                  onStop={() => { stop.mutate(t.id) }}
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

  const filterRail = page === "board" && !detailId && filtersOpen && (
    <aside className="glass-panel flex h-full w-72 shrink-0 flex-col rounded-none border-y-0 border-l-0">
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-[var(--color-line)] px-3">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">Filters</span>
        {filtersActive && <span className="size-2 rounded-full bg-[var(--color-accent)]" />}
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-300">{filtered.length} / {tasks.data?.length ?? 0} match</span>
            {filtersActive && (
              <Button variant="ghost" size="sm" className="h-6 gap-1 px-2 text-[11px] text-neutral-400" onClick={clearFilters}>
                <X className="size-3" /> reset
              </Button>
            )}
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-neutral-500" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari judul / body / id / result…"
              className="h-8 border-[var(--color-line)] bg-[var(--color-bg)] pl-7 text-xs" />
          </div>
          <div>
            <label className="mb-1 block text-[11px] text-neutral-500">Status</label>
            <Select value={fStatus} onValueChange={setFStatus}>
              <SelectTrigger size="sm" className="w-full border-[var(--color-line)] bg-[var(--color-bg)] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent className="border-[var(--color-line)] bg-[var(--color-surface)]">
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
              <SelectTrigger size="sm" className="w-full border-[var(--color-line)] bg-[var(--color-bg)] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent className="border-[var(--color-line)] bg-[var(--color-surface)]">
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
              <SelectTrigger size="sm" className="w-full border-[var(--color-line)] bg-[var(--color-bg)] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent className="border-[var(--color-line)] bg-[var(--color-surface)]">
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
              <SelectTrigger size="sm" className="w-full border-[var(--color-line)] bg-[var(--color-bg)] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent className="border-[var(--color-line)] bg-[var(--color-surface)]">
                <SelectItem value="__all" className="text-xs">Semua</SelectItem>
                <SelectItem value="0" className="text-xs">P0 normal</SelectItem>
                <SelectItem value="1" className="text-xs">P1</SelectItem>
                <SelectItem value="2" className="text-xs">P2 high</SelectItem>
                <SelectItem value="3" className="text-xs">P3 urgent</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
    </aside>
  )

  const headerControls = page === "board" && !detailId ? (
    <div className="flex min-w-0 items-center gap-2">
      <Select value={slug} onValueChange={(next) => { setSlug(next); go(pagePath("board", next)) }}>
        <SelectTrigger size="sm" className="w-auto gap-1.5 border-[var(--color-line)] bg-[var(--color-bg)] text-xs">
          <SelectValue placeholder="board" />
        </SelectTrigger>
        <SelectContent className="border-[var(--color-line)] bg-[var(--color-surface)]">
          {active.map((b) => (
            <SelectItem key={b.slug} value={b.slug} className="text-xs">
              {b.icon ? `${b.icon} ` : ""}{b.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button variant="outline" size="sm" onClick={() => setCreatingBoard(true)} className="gap-1 border-[var(--color-line)] bg-[var(--color-surface)] text-neutral-300">
        <Plus className="size-3.5" /> New Board
      </Button>
      <Button variant="outline" size="sm" onClick={() => setEditingBoard(true)} disabled={!currentBoard} className="gap-1 border-[var(--color-line)] bg-[var(--color-surface)] text-neutral-300 disabled:opacity-40">
        <Pencil className="size-3.5" /> Edit
      </Button>
      <Separator orientation="vertical" className="h-5" />
      <span className="rounded bg-[var(--color-bg)] px-1.5 py-0.5 text-[10px] text-neutral-400">
        {filtersActive ? `${filtered.length}/${tasks.data?.length ?? 0}` : `${tasks.data?.length ?? 0}`} tasks
      </span>
      <Button size="sm" onClick={() => setCreating(true)}
        className="bg-[var(--color-accent)] text-black hover:bg-[var(--color-accent)]/90">
        <Plus className="size-3.5" /> New Task
      </Button>
    </div>
  ) : detailId ? (
    <span className="rounded bg-[var(--color-bg)] px-1.5 py-0.5 font-mono text-[10px] text-neutral-400">{detailId}</span>
  ) : null

  return (
    <AppShell
      page={page}
      onSelectPage={handleSelectPage}
      header={
        <AppHeader
          breadcrumb={breadcrumb}
          right={headerControls}
          onSettings={() => handleSelectPage("settings")}
        />
      }
    >
      {filterRail}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {page === "workspaces" && <div className="flex-1 overflow-y-auto"><WorkspacesPage /></div>}
        {page === "profiles" && <div className="flex-1 overflow-y-auto"><ProfilesPage /></div>}
        {page === "providers" && <div className="flex-1 overflow-y-auto"><ProvidersPage /></div>}
        {page === "logs" && <div className="flex min-h-0 flex-1 flex-col"><LogsPage /></div>}
        {page === "skills" && <div className="flex min-h-0 flex-1 flex-col overflow-hidden"><SkillsPage /></div>}
        {page === "memory" && <div className="flex-1 overflow-y-auto"><MemoryPage /></div>}
        {page === "overview" && <div className="flex min-h-0 flex-1 flex-col overflow-hidden"><OverviewPage /></div>}
        {page === "settings" && <div className="flex min-h-0 flex-1 flex-col overflow-hidden"><SettingsPage /></div>}
        {page === "agent-mapping" && <div className="flex min-h-0 flex-1 overflow-hidden"><AgentMappingPage /></div>}
        {page === "board" && detailId && detailPage && (
          <TaskDetailPage
            slug={slug}
            task={detailPage}
            profiles={profiles.data ?? []}
            workspaces={workspaces.data ?? []}
            onBack={() => { setDetailId(null); go(pagePath("board", slug)) }}
            onMove={(s) => move.mutateAsync({ id: detailPage.id, status: s }).then(() => undefined)}
            onStop={() => stop.mutateAsync(detailPage.id).then(() => undefined)}
            onReassign={(a) => reassign.mutateAsync({ id: detailPage.id, assignee: a }).then(() => undefined)}
          />
        )}
        {page === "board" && detailId && !detailPage && (tasks.isLoading ? <LoadingState variant="detail" label="Memuat detail task" /> : <div className="flex flex-1 items-center justify-center p-6 text-sm text-red-400">Task `{detailId}` tidak ditemukan di board ini.</div>)}
        {page === "board" && !detailId && boardBody}
      </div>

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
      {editingBoard && currentBoard && (
        <EditBoardDialog
          board={currentBoard}
          onClose={() => setEditingBoard(false)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["boards"] })
            setEditingBoard(false)
          }}
        />
      )}
      {detail && !detailId && (
        <TaskDetail
          slug={slug}
          task={detail}
          profiles={profiles.data ?? []}
          workspaces={workspaces.data ?? []}
          onClose={() => setDetail(null)}
          onMove={(s) => move.mutateAsync({ id: detail.id, status: s }).then(() => setDetail({ ...detail, status: s }))}
          onStop={() => stop.mutateAsync(detail.id).then(() => setDetail({ ...detail, status: "blocked" }))}
          onReassign={(a) =>
            reassign.mutateAsync({ id: detail.id, assignee: a }).then(() => setDetail({ ...detail, assignee: a }))
          }
          onOpenPage={() => { const t = detail; setDetail(null); setDetailId(t.id); go(pagePath("board", slug, t.id)) }}
        />
      )}
    </AppShell>
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
      <div className="glass-panel-raised w-full max-w-sm rounded-xl p-4" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-sm font-semibold">New Board</h2>
        <label className="mt-3 block text-xs text-neutral-400">Slug</label>
        <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="f8-gadjian"
          className="mt-1 border-[var(--color-line)] bg-[var(--color-bg)]" />
        <label className="mt-3 block text-xs text-neutral-400">Name</label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="F8 Gadjian"
          className="mt-1 border-[var(--color-line)] bg-[var(--color-bg)]" />
        <label className="mt-3 block text-xs text-neutral-400">Icon (emoji)</label>
        <Input value={icon} onChange={(e) => setIcon(e.target.value)} className="mt-1 w-20 border-[var(--color-line)] bg-[var(--color-bg)]" />
        {err && <p className="mt-3 text-xs text-red-400">{err}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" disabled={busy} onClick={submit} className="bg-[var(--color-accent)] text-black hover:bg-[var(--color-accent)]/90">
            {busy ? "…" : "Create"}
          </Button>
        </div>
      </div>
    </div>
  )
}

function EditBoardDialog({ board, onClose, onSaved }: { board: Board; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(board.name)
  const [icon, setIcon] = useState(board.icon)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function submit() {
    if (!name.trim()) { setErr("Name required"); return }
    setBusy(true); setErr(null)
    try {
      await api(`/api/boards/${board.slug}`, {
        method: "PATCH",
        body: JSON.stringify({ name: name.trim(), icon }),
      })
      onSaved()
    } catch (e) { setErr((e as Error).message); setBusy(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="glass-panel-raised w-full max-w-sm rounded-xl p-4" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-sm font-semibold">Edit Board · {board.slug}</h2>
        <label className="mt-3 block text-xs text-neutral-400">Slug (read-only)</label>
        <Input value={board.slug} disabled className="mt-1 border-[var(--color-line)] bg-[var(--color-bg)] opacity-60" />
        <label className="mt-3 block text-xs text-neutral-400">Name</label>
        <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 border-[var(--color-line)] bg-[var(--color-bg)]" />
        <label className="mt-3 block text-xs text-neutral-400">Icon (emoji)</label>
        <Input value={icon} onChange={(e) => setIcon(e.target.value)} className="mt-1 w-20 border-[var(--color-line)] bg-[var(--color-bg)]" />
        {err && <p className="mt-3 text-xs text-red-400">{err}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" disabled={busy} onClick={submit} className="bg-[var(--color-accent)] text-black hover:bg-[var(--color-accent)]/90">
            {busy ? "…" : "Save"}
          </Button>
        </div>
      </div>
    </div>
  )
}
