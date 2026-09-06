import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api, COLUMNS, type Board, type Profile, type Status, type Task, type Workspace } from "./api"
import TaskCard from "./features/board/TaskCard"
import TaskDialog from "./features/board/TaskDialog"
import TaskDetail from "./features/board/TaskDetail"

export default function App() {
  const [slug, setSlug] = useState("f8-saas")
  const [creating, setCreating] = useState(false)
  const [detail, setDetail] = useState<Task | null>(null)
  const qc = useQueryClient()

  const boards = useQuery({ queryKey: ["boards"], queryFn: () => api<Board[]>("/api/boards") })
  const tasks = useQuery({ queryKey: ["tasks", slug], queryFn: () => api<Task[]>(`/api/boards/${slug}/tasks`) })
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

  const active = boards.data?.filter((b) => !["default", "archived"].includes(b.slug)) ?? []
  const byCol = (s: Status) => (tasks.data ?? []).filter((t) => t.status === s)

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center gap-3 border-b border-[#1e2430] bg-[#11151f] px-4 py-3">
        <h1 className="text-lg font-semibold tracking-tight">🗂 Kanban Board</h1>
        <select
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          className="rounded-md border border-[#1e2430] bg-[#0b0e14] px-2 py-1.5 text-sm"
        >
          {active.map((b) => (
            <option key={b.slug} value={b.slug}>{b.icon} {b.name}</option>
          ))}
        </select>
        <button
          onClick={() => setCreating(true)}
          className="ml-auto rounded-md bg-[#10e0dd] px-3 py-1.5 text-sm font-medium text-black hover:opacity-90"
        >
          + New Task
        </button>
      </header>

      {tasks.isLoading ? (
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
      )}

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
    </div>
  )
}
