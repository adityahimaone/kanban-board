import type { FlowStage, FlowTask } from "./useFlowTasks"
import { channelPath } from "./layout"
import { colorForTask } from "./color"

const STAGE_LABEL: Record<FlowStage, string> = {
  dispatched: "Dikirim",
  running: "Berjalan",
  done: "Selesai",
  failed: "Gagal",
}

/** Legend table under the graph — one row per tracked task; swatch color
 *  matches the traveling dot (same deterministic colorForTask). */
export function FlowLegendTable({ tasks }: { tasks: FlowTask[] }) {
  if (tasks.length === 0) return null
  return (
    <div className="shrink-0 overflow-y-auto rounded-xl border border-[#1e2430] bg-[#0d1017]/60 px-3 py-1">
      <table className="w-full border-collapse font-mono text-[11px]">
        <thead>
          <tr className="border-b border-[#1e2430] text-left text-neutral-500">
            <th className="w-6 py-1.5"></th>
            <th className="py-1.5 pr-4 font-medium">Task</th>
            <th className="py-1.5 pr-4 font-medium">Board</th>
            <th className="py-1.5 pr-4 font-medium">Posisi</th>
            <th className="py-1.5 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((t) => (
            <tr key={t.task_id} className="border-b border-[#1e2430]/60 last:border-0">
              <td className="py-1.5">
                <span className="inline-block size-2 rounded-full" style={{ background: colorForTask(t.task_id) }} />
              </td>
              <td className="py-1.5 pr-4 text-neutral-200" title={t.title}>{t.task_id}</td>
              <td className="py-1.5 pr-4 text-neutral-500">{t.board}</td>
              <td className="py-1.5 pr-4 text-neutral-500">
                {channelPath(t.stage, t.node_id).join(" → ") || "—"}
              </td>
              <td className="py-1.5">
                <span className={
                  t.stage === "failed" ? "text-red-400" : t.stage === "done" ? "text-emerald-400" : "text-neutral-300"
                }>
                  {STAGE_LABEL[t.stage]}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
