import type { FlowTask } from "./useFlowTasks"

export default function DoneTray({ tasks }: { tasks: FlowTask[] }) {
  if (!tasks.length) return null
  return (
    <div className="flex w-40 shrink-0 flex-col gap-1.5 overflow-y-auto p-2">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-[#6b7280]">Completed</span>
      {tasks.map((t) => {
        const ok = t.stage === "done"
        return (
          <div
            key={t.task_id}
            className="rounded-lg border px-2 py-1.5 text-[11px]"
            style={{
              background: ok ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)",
              borderColor: ok ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)",
              color: ok ? "#22c55e" : "#ef4444",
            }}
          >
            <div className="truncate font-medium">{t.task_id}</div>
            <div className="text-[10px] opacity-60">{t.node_id || t.stage}</div>
          </div>
        )
      })}
    </div>
  )
}
