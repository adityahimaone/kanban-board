import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar, type Page } from "@/components/AppSidebar"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { api, COLUMNS, type Board, type Profile, type Status, type Task, type Workspace } from "./api"
import TaskCard from "./features/board/TaskCard"
import TaskDialog from "./features/board/TaskDialog"
import TaskDetail from "./features/board/TaskDetail"
import WorkspacesPage from "./features/workspaces/WorkspacesPage"
import ProfilesPage from "./features/profiles/ProfilesPage"
import ProvidersPage from "./features/providers/ProvidersPage"
import { Plus } from "lucide-react"

export default function App() {
  const [page, setPage] = useState<Page>("board")
  const [slug, setSlug] = useState("f8-saas")
  const [creating, setCreating] = useState(false)
  const [detail, setDetail] = useState<Task | null>(null)
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
  const byCol = (s: Status) => (tasks.data ?? []).filter((t) => t.status === s)
  const pageTitle = page === "workspaces" ? "Workspaces" : page === "profiles" ? "Agent Profiles" : page === "providers" ? "Providers" : "Kanban Board"

  return (
    <SidebarProvider>
      <AppSidebar
        page={page}
        boards={active}
        slug={slug}
        onSelectPage={setPage}
        onSelectBoard={(s) => { setSlug(s); setPage("board") }}
      />
      <SidebarInset className="bg-[#0b0e14]">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-[#1e2430] bg-[#11151f] px-4">
          <SidebarTrigger className="-ml-1 text-neutral-300 hover:text-[#10e0dd]" />
          <Separator orientation="vertical" className="mr-1 h-5" />
          <h1 className="text-sm font-semibold tracking-tight">{pageTitle}</h1>

          {page === "board" && (
            <>
              {/* board switcher moved to top bar */}
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
                {tasks.data?.length ?? 0} tasks
              </span>
              {/* New Task moved to top bar */}
              <Button size="sm" onClick={() => setCreating(true)}
                className="ml-auto bg-[#10e0dd] text-black hover:bg-[#10e0dd]/90">
                <Plus className="size-3.5" /> New Task
              </Button>
            </>
          )}
        </header>

        {page === "workspaces" && <WorkspacesPage />}
        {page === "profiles" && <ProfilesPage />}
        {page === "providers" && <ProvidersPage />}

        {page === "board" && (
          tasks.isLoading ? (
            <p className="p-6 text-sm text-neutral-400">Loading…</p>
          ) : tasks.isError ? (
            <p className="p-6 text-sm text-red-400">Gagal load tasks: {(tasks.error as Error).message}</p>
          ) : (
            <main className="flex flex-1 gap-3 overflow-x-auto p-3">
              {COLUMNS.map((col) => (
                <section key={col} className="flex w-72 shrink-0 flex-col rounded-lg border border-[#1e2430] bg-[#11151f]">
                  <h2 className="flex items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-wider text-neutral-400">
                    {col}
                    <span className="rounded bg-[#0b0e14] px-1.5 py-0.5 text-[10px]">{byCol(col).length}</span>
                  </h2>
                  <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2">
                    {byCol(col).map((t) => (
                      <TaskCard
                        key={t.id}
                        task={t}
                        onOpen={() => setDetail(t)}
                        onMove={(s) => move.mutate({ id: t.id, status: s })}
                        onReassign={(a) => reassign.mutate({ id: t.id, assignee: a })}
                        profiles={profiles.data ?? []}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </main>
          )
        )}
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
