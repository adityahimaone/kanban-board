import { useEffect, useMemo, useState } from "react"
import { Crosshair, Maximize2, Minimize2, Pin } from "lucide-react"
import { channelPath } from "./layout"
import { colorForTask } from "./color"
import type { FlowTask } from "./useFlowTasks"

const LABELS = { dispatched: "Dispatched", running: "Running", done: "Done", failed: "Failed" } as const
const RETENTION_MS = 10 * 60 * 1000 // backend default; terminal retention remains bounded to 5-10m

function age(task: FlowTask, now: number) {
  const ms = Math.max(0, now - Date.parse(task.updated_at))
  if (task.stage === "done" || task.stage === "failed") return `${Math.floor(ms / 60000)}m ${Math.floor(ms / 1000) % 60}s ago`
  return `${Math.floor(ms / 1000)}s`
}

function expiry(task: FlowTask, now: number) {
  const left = Math.max(0, RETENTION_MS - (now - Date.parse(task.updated_at)))
  return `${String(Math.floor(left / 60000)).padStart(2, "0")}:${String(Math.floor(left / 1000) % 60).padStart(2, "0")}`
}

export function SessionMonitor({ tasks, focused, onFocus }: { tasks: FlowTask[]; focused: string | null; onFocus: (id: string | null) => void }) {
  const [now, setNow] = useState(Date.now())
  const [collapsed, setCollapsed] = useState(false)
  const [height, setHeight] = useState(210)
  const [query, setQuery] = useState("")
  const [pinned, setPinned] = useState<string | null>(null)
  useEffect(() => { const id = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(id) }, [])
  const visible = useMemo(() => tasks.filter((t) => !query || `${t.task_id} ${t.title} ${t.board}`.toLowerCase().includes(query.toLowerCase())), [tasks, query])
  return (
    <section className="relative shrink-0 border-t border-white/10 bg-[#11120f]" style={{ height: collapsed ? 38 : height }}>
      <div className="flex h-9 items-center gap-2 border-b border-white/10 px-3 text-[11px]">
        <span className="font-semibold text-[#e8e8e3]">Session Monitor</span>
        <span className="font-mono text-[#8b8e86]">{tasks.length} sessions</span>
        <span className="text-[#8b8e86]">· terminal expires in 10m</span>
        {!collapsed && <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="filter sessions" className="ml-auto h-6 w-40 rounded border border-white/10 bg-black/20 px-2 font-mono text-[10px] text-white outline-none focus:border-[#10e0dd]" />}
        <button aria-label={collapsed ? "Expand session monitor" : "Collapse session monitor"} title={collapsed ? "Expand" : "Collapse"} onClick={() => setCollapsed((v) => !v)} className="ml-1 text-[#8b8e86] hover:text-white">{collapsed ? <Maximize2 className="size-3.5" /> : <Minimize2 className="size-3.5" />}</button>
      </div>
      {!collapsed && <div className="overflow-auto" style={{ height: height - 38 }}>
        <table className="w-full table-fixed text-left font-mono text-[10px]">
          <thead className="sticky top-0 bg-[#11120f] text-[#8b8e86]"><tr><th className="w-24 px-3 py-1.5">State</th><th className="w-[25%] px-2 py-1.5">Session</th><th className="w-[35%] px-2 py-1.5">Route</th><th className="w-28 px-2 py-1.5">Age / ended</th><th className="w-24 px-2 py-1.5">Retention</th><th className="w-16 px-2 py-1.5">Action</th></tr></thead>
          <tbody>{visible.map((t) => { const active = focused === t.task_id; const terminal = t.stage === "done" || t.stage === "failed"; return <tr key={t.task_id} className={`border-t border-white/5 ${active ? "bg-white/[.05]" : ""}`}>
            <td className="px-3 py-2"><span className="mr-1.5 inline-block size-1.5 rounded-full" style={{ background: t.stage === "failed" ? "#ef6b73" : t.stage === "done" ? "#57d18d" : t.stage === "running" ? "#8fd14f" : "#f2c94c" }} />{LABELS[t.stage]}</td>
            <td className="min-w-0 truncate px-2 py-2 text-[#e8e8e3]" title={t.title}><span style={{ color: colorForTask(t.task_id) }}>{t.task_id}</span> <span className="text-[#8b8e86]">· {t.title || "untitled"}</span></td>
            <td className="truncate px-2 py-2 text-[#8b8e86]" title={channelPath(t.stage, t.node_id).join(" → ")}>{channelPath(t.stage, t.node_id).join(" → ")}</td>
            <td className="px-2 py-2 text-[#8b8e86]">{age(t, now)}</td><td className="px-2 py-2 text-[#8b8e86]">{terminal ? `expires ${expiry(t, now)}` : "—"}</td>
            <td className="px-2 py-2"><button aria-label={`Focus ${t.task_id}`} title="Focus route" onClick={() => onFocus(active ? null : t.task_id)} className={`mr-2 ${active ? "text-[#10e0dd]" : "text-[#8b8e86] hover:text-white"}`}><Crosshair className="inline size-3.5" /></button><button aria-label={`${pinned === t.task_id ? "Unpin" : "Pin"} ${t.task_id}`} title="Pin session" onClick={() => setPinned(pinned === t.task_id ? null : t.task_id)} className={pinned === t.task_id ? "text-[#10e0dd]" : "text-[#8b8e86] hover:text-white"}><Pin className="inline size-3.5" /></button></td>
          </tr> })}</tbody>
        </table>
      </div>}
      {!collapsed && <div className="absolute bottom-0 left-1/2 hidden h-1 w-16 -translate-x-1/2 cursor-row-resize rounded bg-white/20 md:block" onPointerDown={(e) => { const start = e.clientY; const initial = height; const move = (ev: PointerEvent) => setHeight(Math.max(120, Math.min(window.innerHeight * .5, initial + start - ev.clientY))); const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up) }; window.addEventListener("pointermove", move); window.addEventListener("pointerup", up) }} />}
    </section>
  )
}
