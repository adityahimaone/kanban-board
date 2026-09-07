import { useMemo, useState } from "react"
import { RefreshCw } from "lucide-react"
import { useFlowTasks } from "./useFlowTasks"
import FlowGraph from "./FlowGraph"
import { SessionMonitor } from "./SessionMonitor"

const STAGES = ["all", "dispatched", "running", "done", "failed"] as const

export default function FlowPage() {
  const { data: tasks = [], isLoading, isError, isFetching, dataUpdatedAt } = useFlowTasks()
  const [filter, setFilter] = useState<(typeof STAGES)[number]>("all")
  const [query, setQuery] = useState("")
  const [focused, setFocused] = useState<string | null>(null)
  const visible = useMemo(() => tasks.filter((t) => (filter === "all" || t.stage === filter) && (!query || `${t.task_id} ${t.title} ${t.board}`.toLowerCase().includes(query.toLowerCase()))), [tasks, filter, query])
  if (isLoading) return <div className="flex h-full items-center justify-center text-sm text-[#8b8e86]">Memuat agent flow…</div>
  if (isError) return <div className="flex h-full items-center justify-center text-sm text-[#ef6b73]">Gagal load agent flow.</div>
  return (
    <div className="flex h-full min-h-0 flex-col bg-[#10110f]">
      <div className="flex h-12 shrink-0 items-center gap-3 border-b border-white/10 px-4">
        <div>
          <h2 className="text-sm font-semibold text-[#e8e8e3]">Agent Flow</h2>
          <p className="text-[10px] text-[#8b8e86]">Live task routing and execution map</p>
        </div>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="search task" className="ml-auto h-7 w-44 rounded border border-white/10 bg-black/20 px-2 font-mono text-[11px] text-white outline-none focus:border-[#10e0dd]" />
        <div className="flex items-center gap-1 rounded border border-white/10 bg-black/20 p-0.5">
          {STAGES.map((s) => <button key={s} onClick={() => setFilter(s)} className={`h-6 rounded px-2 font-mono text-[10px] capitalize transition-colors ${filter === s ? "bg-[#10e0dd]/15 text-[#10e0dd]" : "text-[#8b8e86] hover:text-white"}`}>{s}</button>)}
        </div>
        <span className="font-mono text-[10px] text-[#8b8e86]">{visible.length} active</span>
        <span className="flex items-center gap-1 font-mono text-[10px] text-[#8b8e86]"><RefreshCw className={`size-3 ${isFetching ? "animate-spin" : ""}`} />{dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString() : "—"}</span>
      </div>
      <div className="flex min-h-0 flex-1 flex-col">
        <FlowGraph tasks={visible} focused={focused} onFocus={setFocused} />
        <SessionMonitor tasks={visible} focused={focused} onFocus={setFocused} />
      </div>
    </div>
  )
}
