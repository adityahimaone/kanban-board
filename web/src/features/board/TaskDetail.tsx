import { useQuery } from "@tanstack/react-query"
import { api, COLUMNS, type Status, type Task, type TaskEvent } from "../../api"

export default function TaskDetail({
  slug,
  task,
  onClose,
  onMove,
}: {
  slug: string
  task: Task
  onClose: () => void
  onMove: (s: Status) => Promise<void>
}) {
  const events = useQuery({
    queryKey: ["events", slug, task.id],
    queryFn: () => api<TaskEvent[]>(`/api/boards/${slug}/tasks/${task.id}/events`),
  })

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <aside
        className="flex h-full w-full max-w-md flex-col border-l border-[#1e2430] bg-[#11151f] p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-sm font-semibold leading-snug">{task.title}</h2>
          <button onClick={onClose} className="shrink-0 rounded border border-[#1e2430] px-2 py-1 text-xs">✕</button>
        </div>
        <p className="mt-1 text-xs text-neutral-500">{task.id} · {task.status}</p>
        {task.body && <p className="mt-3 whitespace-pre-wrap text-sm text-neutral-300">{task.body}</p>}
        {task.last_failure_error && (
          <p className="mt-2 rounded border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-300">{task.last_failure_error}</p>
        )}
        <div className="mt-4 flex flex-wrap gap-1.5">
          {COLUMNS.filter((s) => s !== task.status).map((s) => (
            <button
              key={s}
              onClick={() => onMove(s).catch((e: Error) => alert(e.message))}
              className="rounded border border-[#1e2430] px-2 py-1 text-xs hover:border-[#10e0dd]/50 hover:text-[#10e0dd]"
            >
              → {s}
            </button>
          ))}
        </div>

        <h3 className="mt-6 text-xs font-semibold uppercase tracking-wider text-neutral-400">Events</h3>
        <div className="mt-2 flex-1 overflow-y-auto rounded border border-[#1e2430] bg-[#0b0e14] p-2">
          {events.isLoading ? (
            <p className="text-xs text-neutral-500">Loading…</p>
          ) : !events.data?.length ? (
            <p className="text-xs text-neutral-500">No events</p>
          ) : (
            <ol className="space-y-1">
              {events.data.map((e) => (
                <li key={e.id} className="rounded bg-[#11151f] px-2 py-1.5 text-xs">
                  <span className="font-medium text-neutral-300">{e.kind}</span>
                  <span className="ml-2 text-neutral-500">{new Date(e.created_at * 1000).toLocaleString()}</span>
                  {e.payload && <pre className="mt-1 whitespace-pre-wrap break-all text-[11px] text-neutral-400">{e.payload}</pre>}
                </li>
              ))}
            </ol>
          )}
        </div>
      </aside>
    </div>
  )
}
