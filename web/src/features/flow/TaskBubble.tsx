import type { FlowTask } from "./useFlowTasks"

const DOT_COLORS: Record<string, string> = {
  dispatched: "#f09a2f",
  running: "#10e0dd",
  done: "#22c55e",
  failed: "#ef4444",
}

export default function TaskBubble({ task, x, y }: { task: FlowTask; x: number; y: number }) {
  const dot = DOT_COLORS[task.stage] || "#6b7280"
  return (
    <div
      className="group pointer-events-auto absolute flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-[left,top] duration-500 ease-in-out"
      style={{
        left: x, top: y,
        background: "#11151f", borderColor: "#1e2430", color: "#e5e7eb",
        transform: "translate(-50%, -50%)",
      }}
      title={task.title || task.task_id}
    >
      <span
        className="inline-block size-2 shrink-0 rounded-full animate-pulse"
        style={{ background: dot, boxShadow: `0 0 6px ${dot}` }}
      />
      <span className="max-w-[80px] truncate">{task.task_id}</span>
      {task.title && (
        <span className="pointer-events-none absolute bottom-full left-1/2 mb-1.5 hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-[#1e2430] bg-[#11151f] px-2 py-1 text-[10px] font-normal text-neutral-300 shadow-lg group-hover:block">
          {task.title}
        </span>
      )}
    </div>
  )
}
