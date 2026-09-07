import { useCallback, useMemo, useRef, useState } from "react"
import { Brain, Database, Server, Radio, Laptop, AppWindow, Kanban, ZoomIn, ZoomOut, Maximize } from "lucide-react"
import { EDGES, NODES, nodeMap, type FlowNodeId, type Point, channelPath, stageNode } from "./layout"
import { elbowPath, pathLength } from "./elbow"
import { FlowNodeCard, CARD_H, CARD_W } from "./FlowNodeCard"
import { TravelingDot } from "./TravelingDot"
import type { FlowTask } from "./useFlowTasks"
import { colorForTask } from "./color"

const MIN_SCALE = .35
const MAX_SCALE = 2
const ICONS: Partial<Record<FlowNodeId, typeof Brain>> = { kanban: Kanban, orchestrator: Brain, memory: Database, "node-agent-server": Server, tailscale: Radio, mac: Laptop, windows: AppWindow, dispatcher: Server, review: Server }

function anchor(a: FlowNodeId, b: FlowNodeId): [Point, Point] {
  const from = nodeMap[a], to = nodeMap[b]
  const dx = to.x - from.x
  const dy = to.y - from.y
  if (Math.abs(dx) >= Math.abs(dy)) return [{ x: from.x + Math.sign(dx) * CARD_W / 2, y: from.y }, { x: to.x - Math.sign(dx) * CARD_W / 2, y: to.y }]
  return [{ x: from.x, y: from.y + Math.sign(dy) * CARD_H / 2 }, { x: to.x, y: to.y - Math.sign(dy) * CARD_H / 2 }]
}

export default function FlowGraph({ tasks, focused, onFocus }: { tasks: FlowTask[]; focused: string | null; onFocus: (id: string | null) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const [view, setView] = useState({ scale: .72, x: 20, y: 30 })
  const [selected, setSelected] = useState<FlowNodeId | null>(null)
  const [drag, setDrag] = useState<{ x: number; y: number; ox: number; oy: number } | null>(null)
  const bounds = { w: 940, h: 820 }
  const zoom = useCallback((factor: number, cx = 600, cy = 250) => setView((v) => { const scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, v.scale * factor)); const gx = (cx - v.x) / v.scale; const gy = (cy - v.y) / v.scale; return { scale, x: cx - gx * scale, y: cy - gy * scale } }), [])
  const fit = () => setView({ scale: .72, x: 20, y: 30 })
  const onWheel = (e: React.WheelEvent) => { if (!e.ctrlKey && !e.metaKey) return; e.preventDefault(); const r = ref.current?.getBoundingClientRect(); zoom(e.deltaY < 0 ? 1.12 : 1 / 1.12, e.clientX - (r?.left ?? 0), e.clientY - (r?.top ?? 0)) }
  const activeByNode = useMemo(() => { const m = new Map<FlowNodeId, FlowTask[]>(); for (const t of tasks) { const n = stageNode(t.stage, t.node_id); if (n) m.set(n, [...(m.get(n) ?? []), t]) } return m }, [tasks])
  const activeEdges = useMemo(() => { const m = new Map<string, FlowTask[]>(); for (const t of tasks) { const route = channelPath(t.stage, t.node_id); for (let i = 0; i < route.length - 1; i++) { const key = `${route[i]}-${route[i + 1]}`; const reverse = `${route[i + 1]}-${route[i]}`; m.set(key, [...(m.get(key) ?? []), t]); m.set(reverse, [...(m.get(reverse) ?? []), t]) } } return m }, [tasks])
  const edgeData = EDGES.map((e) => { const [from, to] = anchor(e.from, e.to); return { ...e, d: elbowPath(from, to, (from.x + to.x) / 2), active: activeEdges.get(`${e.from}-${e.to}`) ?? [] } })
  const routeFocus = focused ? channelPath(tasks.find((t) => t.task_id === focused)?.stage ?? "running", tasks.find((t) => t.task_id === focused)?.node_id ?? "") : null
  return <div className="relative min-h-0 flex-1 overflow-hidden" ref={ref} onWheel={onWheel} onPointerMove={(e) => drag && setView((v) => ({ ...v, x: drag.ox + e.clientX - drag.x, y: drag.oy + e.clientY - drag.y }))} onPointerUp={() => setDrag(null)} onPointerCancel={() => setDrag(null)}>
    <div className="absolute inset-0" style={{ backgroundColor: "#10110f", backgroundImage: "radial-gradient(rgba(255,255,255,.075) 1px, transparent 1px)", backgroundSize: "16px 16px", backgroundPosition: `${view.x}px ${view.y}px` }} onPointerDown={(e) => { if (e.target === e.currentTarget) setDrag({ x: e.clientX, y: e.clientY, ox: view.x, oy: view.y }) }}>
      <div className="absolute left-0 top-0 origin-top-left" style={{ width: bounds.w, height: bounds.h, transform: `translate(${view.x}px,${view.y}px) scale(${view.scale})` }}>
        <svg width={bounds.w} height={bounds.h} className="pointer-events-none absolute inset-0 overflow-visible">
          <defs><filter id="flow-blur"><feGaussianBlur stdDeviation="4" /></filter></defs>
          {edgeData.map((e) => { const hot = e.active.length > 0; return <g key={`${e.from}-${e.to}`} opacity={routeFocus && !routeFocus.includes(e.from) && !routeFocus.includes(e.to) ? .16 : 1}>
            <path d={e.d} fill="none" stroke={e.color} strokeWidth={hot ? 10 : 5} opacity={hot ? .3 : .2} filter="url(#flow-blur)" />
            <path d={e.d} fill="none" stroke={e.color} strokeWidth={hot ? 3 : 2} opacity={hot ? .95 : .7} strokeLinecap="round" />
            {e.active.map((t) => <path key={t.task_id} d={e.d} fill="none" stroke={colorForTask(t.task_id)} strokeWidth={focused === t.task_id ? 4 : 3} opacity={focused && focused !== t.task_id ? .55 : 1} strokeDasharray="8 5" strokeLinecap="round" />)}
          </g>})}
        </svg>
        {/* Idle signal: every physical edge keeps three ambient dots even with no tasks. */}
        {edgeData.flatMap((e, i) => [0, 1, 2].map((phase) => <TravelingDot key={`idle-${e.from}-${e.to}-${phase}`} taskId={`idle-${e.from}-${e.to}`} pathD={e.d} pathLen={Math.max(1, pathLength(e.d))} phaseRatio={(i * .17 + phase / 3) % 1} idle />))}
        {/* Active signals: four faster dots per route hop per task, following real connectors without jumps. */}
        {tasks.slice(0, 24).flatMap((t, taskIndex) => {
          const route = channelPath(t.stage, t.node_id)
          return route.slice(0, -1).flatMap((from, hop) => {
            const to = route[hop + 1]
            const [a, b] = anchor(from, to)
            const d = elbowPath(a, b, (a.x + b.x) / 2)
            return [0, 1, 2, 3].map((dot) => (
              <TravelingDot key={`${t.task_id}-${from}-${to}-${dot}`} taskId={t.task_id} pathD={d} pathLen={Math.max(1, pathLength(d))} phaseRatio={(taskIndex + hop + dot / 4) / Math.max(1, tasks.length + 4)} active />
            ))
          })
        })}
        {NODES.map((n) => { const Icon = ICONS[n.id] ?? Server; const nodeTasks = activeByNode.get(n.id) ?? []; return <div key={n.id} className="absolute" style={{ left: n.x, top: n.y, transform: "translate(-50%,-50%)" }}><FlowNodeCard label={n.label} sub={n.sub} Icon={Icon} hue={n.hue} activeCount={nodeTasks.length} latest={nodeTasks[0]} selected={selected === n.id} onClick={() => { setSelected(n.id); onFocus(null) }} /></div> })}
      </div>
    </div>
    <div className="absolute bottom-3 left-3 z-10 flex items-center gap-1 rounded-md border border-white/10 bg-[#171816] p-1"><button aria-label="Zoom in" title="Zoom in" onClick={() => zoom(1.2)} className="map-control"><ZoomIn className="size-3.5" /></button><button aria-label="Zoom out" title="Zoom out" onClick={() => zoom(1 / 1.2)} className="map-control"><ZoomOut className="size-3.5" /></button><button aria-label="Fit map" title="Fit map" onClick={fit} className="map-control"><Maximize className="size-3.5" /></button><span className="px-1 font-mono text-[10px] text-[#8b8e86]">{Math.round(view.scale * 100)}%</span></div>
    <div className="absolute bottom-3 right-3 z-10 hidden h-[104px] w-40 cursor-pointer rounded border border-white/10 bg-[#171816]/95 p-1 md:block" onClick={fit} title="Fit map"><div className="relative h-full w-full" style={{ transform: "scale(.105)", transformOrigin: "top left", width: bounds.w, height: bounds.h }}>{NODES.map((n) => <span key={n.id} className="absolute block rounded-sm" style={{ left: n.x - CARD_W / 2, top: n.y - CARD_H / 2, width: CARD_W, height: CARD_H, background: n.hue }} />)}<span className="absolute border-2 border-white" style={{ left: -view.x / view.scale, top: -view.y / view.scale, width: 900 / view.scale, height: 400 / view.scale }} /></div></div>
    {selected && <aside className="absolute right-3 top-3 z-10 w-72 max-w-[calc(100%-24px)] rounded-md border border-white/10 bg-[#171816]/95 p-3 shadow-xl backdrop-blur-sm"><div className="flex items-start justify-between"><div><p className="text-xs font-semibold text-[#e8e8e3]">{nodeMap[selected].label}</p><p className="mt-1 font-mono text-[10px] text-[#8b8e86]">{nodeMap[selected].group} · {activeByNode.get(selected)?.length ?? 0} active</p></div><button aria-label="Close inspector" onClick={() => setSelected(null)} className="text-[#8b8e86] hover:text-white">×</button></div><div className="mt-3 border-t border-white/10 pt-2 text-[10px] text-[#8b8e86]"><p>{nodeMap[selected].sub}</p><p className="mt-2 font-mono">{activeByNode.get(selected)?.map((t) => t.task_id).join(", ") || "No active task"}</p></div></aside>}
  </div>
}
