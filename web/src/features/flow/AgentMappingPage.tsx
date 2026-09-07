import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { AppWindow, Brain, Database, Expand, Kanban, Laptop, Minimize2, Network, Radio, Search, Server, ZoomIn, ZoomOut, Maximize2, X } from "lucide-react"
import { NODES, EDGES, type FlowNodeId, type Point } from "./layout"
import { elbowPath, elbowPathV, pathLength } from "./elbow"
import { TravelingDot } from "./TravelingDot"
import { useFlowTasks, type FlowStage, type FlowTask } from "./useFlowTasks"

const CARD_W = 188
const CARD_H = 52
const GRAPH_W = 1360
const GRAPH_H = 700
const POS: Record<FlowNodeId, Point> = {
  kanban: { x: 120, y: 350 }, orchestrator: { x: 400, y: 220 }, memory: { x: 400, y: 480 },
  "node-agent-server": { x: 680, y: 220 }, tailscale: { x: 960, y: 220 }, mac: { x: 1240, y: 150 }, windows: { x: 1240, y: 350 },
}
const GROUP: Record<FlowNodeId, string> = {
  kanban: "TASK INTAKE", orchestrator: "CONTROL PLANE", memory: "CONTEXT", "node-agent-server": "DISPATCH",
  tailscale: "NETWORK", mac: "EXECUTION", windows: "EXECUTION",
}
const LABEL: Record<FlowNodeId, string> = {
  kanban: "Kanban Queue", orchestrator: "Hermes Orchestrator", memory: "Memory + Prequest", "node-agent-server": "Node Agent Gateway",
  tailscale: "Tailscale Tunnel", mac: "Mac Worker", windows: "Windows Worker",
}
const ICON: Record<FlowNodeId, typeof Brain> = { kanban: Kanban, orchestrator: Brain, memory: Database, "node-agent-server": Server, tailscale: Radio, mac: Laptop, windows: AppWindow }
const COLORS: Record<FlowNodeId, string> = { kanban: "#8f83ff", orchestrator: "#10e0dd", memory: "#8f83ff", "node-agent-server": "#f2c94c", tailscale: "#64b7ff", mac: "#57d18d", windows: "#57d18d" }
const STAGE_COLOR: Record<FlowStage, string> = { dispatched: "#f2c94c", running: "#8fd14f", done: "#57d18d", failed: "#ef6b73" }
type View = { x: number; y: number; scale: number }

function anchor(a: FlowNodeId, b: FlowNodeId, positions: Record<FlowNodeId, Point>): [Point, Point, string] {
  const from = positions[a], to = positions[b]
  if (from.y === to.y) return [{ x: from.x + CARD_W / 2, y: from.y }, { x: to.x - CARD_W / 2, y: to.y }, elbowPath({ x: from.x + CARD_W / 2, y: from.y }, { x: to.x - CARD_W / 2, y: to.y }, (from.x + to.x) / 2)]
  if (from.x === to.x) return [{ x: from.x, y: from.y + CARD_H / 2 }, { x: to.x, y: to.y - CARD_H / 2 }, elbowPathV({ x: from.x, y: from.y + CARD_H / 2 }, { x: to.x, y: to.y - CARD_H / 2 }, (from.y + to.y) / 2)]
  const left = to.x > from.x
  const p1 = { x: from.x + (left ? CARD_W / 2 : -CARD_W / 2), y: from.y }
  const p2 = { x: to.x - (left ? CARD_W / 2 : -CARD_W / 2), y: to.y }
  return [p1, p2, elbowPath(p1, p2, (p1.x + p2.x) / 2)]
}

function stageFor(node: FlowNodeId, tasks: FlowTask[]) { return tasks.find((t) => (t.node_id === node || (t.stage === "dispatched" && node === "node-agent-server"))) }

export default function AgentMappingPage() {
  const { data: tasks = [], isError } = useFlowTasks()
  const [query, setQuery] = useState("")
  const [stage, setStage] = useState<FlowStage | "all">("all")
  const [selected, setSelected] = useState<FlowNodeId | null>(null)
  const [view, setView] = useState<View | null>(null)
  const [overrides, setOverrides] = useState<Partial<Record<FlowNodeId, Point>>>({})
  const [dims, setDims] = useState({ w: 1000, h: 700 })
  const [pan, setPan] = useState<Point | null>(null)
  const [expanded, setExpanded] = useState(false)
  const canvasRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ x: number; y: number; px: number; py: number } | null>(null)
  const nodeDragRef = useRef<{ id: FlowNodeId; x: number; y: number; origin: Point } | null>(null)

  useLayoutEffect(() => {
    if (!canvasRef.current) return
    const ro = new ResizeObserver(([entry]) => setDims({ w: entry.contentRect.width, h: entry.contentRect.height }))
    ro.observe(canvasRef.current)
    return () => ro.disconnect()
  }, [])
  useEffect(() => {
    const onFullscreenChange = () => setExpanded(document.fullscreenElement === canvasRef.current)
    document.addEventListener("fullscreenchange", onFullscreenChange)
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange)
  }, [])
  const fit = useMemo(() => { const scale = Math.min(1, (dims.w - 96) / GRAPH_W, (dims.h - 96) / GRAPH_H); return { scale: Math.max(.35, scale), x: (dims.w - GRAPH_W * scale) / 2, y: (dims.h - GRAPH_H * scale) / 2 } }, [dims])
  const v = view ?? fit
  const visibleTasks = useMemo(() => tasks.filter((t) => (stage === "all" || t.stage === stage) && (!query.trim() || `${t.title} ${t.task_id} ${t.board}`.toLowerCase().includes(query.toLowerCase()))), [tasks, stage, query])
  const zoomAt = useCallback((factor: number) => setView((base) => { const b = base ?? fit; const scale = Math.max(.35, Math.min(2, b.scale * factor)); const cx = dims.w / 2, cy = dims.h / 2; return { scale, x: cx - ((cx - b.x) / b.scale) * scale, y: cy - ((cy - b.y) / b.scale) * scale } }), [dims, fit])
  const onPointerDown = (e: React.PointerEvent) => { if (e.button !== 0) return; dragRef.current = { x: e.clientX, y: e.clientY, px: v.x, py: v.y }; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId) }
  const onPointerMove = (e: React.PointerEvent) => { const d = dragRef.current; if (d) setPan({ x: d.px + e.clientX - d.x, y: d.py + e.clientY - d.y }) }
  const onPointerUp = () => { if (pan) setView({ ...v, ...pan }); setPan(null); dragRef.current = null }
  const actualView = pan ? { ...v, ...pan } : v
  const positions = useMemo(() => ({ ...POS, ...overrides }), [overrides])
  const countFor = (id: FlowNodeId) => visibleTasks.filter((t) => t.node_id === id || (t.stage === "dispatched" && id === "node-agent-server")).length
  const selectedTask = selected ? stageFor(selected, visibleTasks) : undefined
  const edgePaths = EDGES.map((edge) => ({ ...edge, path: anchor(edge.from, edge.to, positions)[2] }))
  const activeCount = tasks.filter((t) => t.stage === "dispatched" || t.stage === "running").length
  const onNodePointerDown = (e: React.PointerEvent, id: FlowNodeId) => {
    e.stopPropagation()
    nodeDragRef.current = { id, x: e.clientX, y: e.clientY, origin: positions[id] }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }
  const onNodePointerMove = (e: React.PointerEvent) => {
    const drag = nodeDragRef.current
    if (!drag) return
    setOverrides((current) => ({ ...current, [drag.id]: { x: drag.origin.x + (e.clientX - drag.x) / actualView.scale, y: drag.origin.y + (e.clientY - drag.y) / actualView.scale } }))
  }
  const onNodePointerUp = (e: React.PointerEvent, id: FlowNodeId) => {
    e.stopPropagation()
    nodeDragRef.current = null
    setSelected(id)
  }
  const toggleExpand = () => {
    if (document.fullscreenElement) document.exitFullscreen()
    else canvasRef.current?.requestFullscreen()
  }

  return <div className="relative flex min-h-0 flex-1 flex-col bg-[#10110f] text-[#e8e8e3]">
    <div className="flex min-h-16 shrink-0 flex-wrap items-center gap-3 border-b border-white/[.08] bg-[#11120f] px-4 py-3">
      <div className="mr-auto flex items-center gap-2"><Network className="size-4 text-[#10e0dd]" /><div><h1 className="text-sm font-semibold">Flow Map</h1><p className="text-[10px] text-[#8b8e86]">Live task routing and execution map</p></div></div>
      <div className="relative w-full sm:w-48"><Search className="absolute left-2 top-1/2 size-3 -translate-y-1/2 text-[#8b8e86]" /><input aria-label="Search active tasks" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search tasks" className="h-8 w-full border border-white/[.11] bg-[#171816] pl-7 pr-2 text-xs outline-none placeholder:text-[#666960] focus:border-[#10e0dd]/60" /></div>
      <select aria-label="Filter task stage" value={stage} onChange={(e) => setStage(e.target.value as FlowStage | "all")} className="h-8 border border-white/[.11] bg-[#171816] px-2 text-xs outline-none focus:border-[#10e0dd]/60"><option value="all">All stages</option><option value="dispatched">Dispatched</option><option value="running">Running</option><option value="done">Done</option><option value="failed">Failed</option></select>
      <span className="border-l border-white/[.1] pl-3 font-mono text-[10px] text-[#8b8e86]">{activeCount} active</span><span className="flex items-center gap-1.5 font-mono text-[10px] text-[#57d18d]"><i className="size-1.5 rounded-full bg-current" /> connected</span>
    </div>
    {isError && <div className="border-b border-[#ef6b73]/30 bg-[#ef6b73]/10 px-4 py-2 text-xs text-[#ef6b73]">Flow Map could not load /api/flow/active.</div>}
    <div ref={canvasRef} className="relative min-h-0 flex-1 overflow-hidden select-none" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} onWheel={(e) => { if (e.ctrlKey || e.metaKey) { e.preventDefault(); zoomAt(e.deltaY < 0 ? 1.12 : .89) } }} style={{ backgroundImage: "radial-gradient(rgba(255,255,255,.075) 1px, transparent 1px)", backgroundSize: "16px 16px" }}>
      <div className="absolute left-0 top-0 origin-top-left" style={{ width: GRAPH_W, height: GRAPH_H, transform: `translate(${actualView.x}px, ${actualView.y}px) scale(${actualView.scale})` }}>
        <svg className="pointer-events-none absolute inset-0" width={GRAPH_W} height={GRAPH_H}>{edgePaths.map((e) => <path key={`${e.from}-${e.to}`} className={!visibleTasks.length ? "map-idle-edge" : ""} d={e.path} fill="none" stroke="#3a3d36" strokeWidth="1.5" />)}</svg>
        {visibleTasks.slice(0, 24).map((t, i) => { const chain = t.stage === "dispatched" ? ["kanban", "node-agent-server"] : t.stage === "running" && (t.node_id === "mac" || t.node_id === "windows") ? ["node-agent-server", "tailscale", t.node_id] : ["orchestrator", "node-agent-server"]; const d = chain.map((id, n) => n < chain.length - 1 ? anchor(id as FlowNodeId, chain[n + 1] as FlowNodeId, positions)[2] : "").join(" "); return <TravelingDot key={t.task_id} taskId={`${t.task_id}-${i}`} pathD={d} pathLen={pathLength(d)} phaseRatio={i / Math.max(1, visibleTasks.length)} /> })}
        {visibleTasks.length === 0 && edgePaths.map((edge, i) => <TravelingDot key={`idle-${edge.from}-${edge.to}`} taskId={`idle-${i}`} pathD={edge.path} pathLen={pathLength(edge.path)} phaseRatio={i / Math.max(1, edgePaths.length)} />)}
        {NODES.map((node) => { const Icon = ICON[node.id], task = stageFor(node.id, visibleTasks), color = task ? STAGE_COLOR[task.stage] : COLORS[node.id]; return <button key={node.id} type="button" onPointerDown={(e) => onNodePointerDown(e, node.id)} onPointerMove={onNodePointerMove} onPointerUp={(e) => onNodePointerUp(e, node.id)} onPointerCancel={() => { nodeDragRef.current = null }} className={`map-node absolute flex h-[52px] w-[188px] cursor-grab items-center gap-2 border bg-[#171816] px-3 text-left transition-colors duration-150 hover:bg-[#1c1e1b] active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#10e0dd] ${!visibleTasks.length ? "map-idle-card" : ""} ${selected === node.id ? "ring-1" : ""}`} style={{ left: positions[node.id].x - CARD_W / 2, top: positions[node.id].y - CARD_H / 2, borderColor: selected === node.id ? color : "rgba(255,255,255,.11)", boxShadow: selected === node.id ? `0 0 0 1px ${color}` : undefined }}><span className="absolute inset-y-0 left-0 w-1" style={{ background: color }} /><Icon className="ml-1 size-3.5 shrink-0" style={{ color }} /><span className="min-w-0 flex-1"><span className="block truncate text-[11px] font-semibold">{LABEL[node.id]}</span><span className="block truncate font-mono text-[9px] text-[#90928b]">{task ? `${task.stage} · ${task.task_id}` : node.sub}</span></span>{countFor(node.id) > 0 && <span className="flex size-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-black" style={{ background: color }}>{countFor(node.id)}</span>}</button> })}
        <div className="absolute left-16 top-[282px] font-mono text-[9px] uppercase tracking-[.16em] text-[#666960]">{visibleTasks.length ? "live route activity" : "no active task"}</div>
      </div>
      <div onPointerDown={(e) => e.stopPropagation()} className="absolute bottom-4 left-4 flex items-center gap-1 border border-white/[.11] bg-[#171816] p-1"><button aria-label="Zoom out" title="Zoom out" className="map-control" onClick={() => zoomAt(.8)}><ZoomOut className="size-3.5" /></button><span className="w-10 text-center font-mono text-[10px] text-[#8b8e86]">{Math.round(actualView.scale * 100)}%</span><button aria-label="Zoom in" title="Zoom in" className="map-control" onClick={() => zoomAt(1.2)}><ZoomIn className="size-3.5" /></button><button aria-label="Fit graph" title="Fit graph" className="map-control" onClick={() => setView(null)}><Maximize2 className="size-3.5" /></button><button aria-label={expanded ? "Exit expanded map" : "Expand map"} title={expanded ? "Exit expanded map" : "Expand map"} className="map-control" onClick={toggleExpand}>{expanded ? <Minimize2 className="size-3.5" /> : <Expand className="size-3.5" />}</button></div>
      <button type="button" aria-label="Recenter map from minimap" title="Recenter map" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { const rect = e.currentTarget.getBoundingClientRect(); const gx = (e.clientX - rect.left - 8) / .13; const gy = (e.clientY - rect.top - 8) / .13; setView({ scale: actualView.scale, x: dims.w / 2 - gx * actualView.scale, y: dims.h / 2 - gy * actualView.scale }) }} className="absolute bottom-4 right-4 hidden h-[104px] w-40 border border-white/[.11] bg-[#171816]/95 p-2 text-left md:block"><span className="relative block h-full w-full" style={{ transform: "scale(.13)", transformOrigin: "top left", width: GRAPH_W, height: GRAPH_H }}>{NODES.map((n) => <i key={n.id} className="absolute h-[52px] w-[188px]" style={{ left: positions[n.id].x - CARD_W / 2, top: positions[n.id].y - CARD_H / 2, background: COLORS[n.id] }} />)}<span className="absolute border-2 border-[#10e0dd]" style={{ left: Math.max(0, -actualView.x / actualView.scale), top: Math.max(0, -actualView.y / actualView.scale), width: dims.w / actualView.scale, height: dims.h / actualView.scale }} /></span><span className="absolute bottom-1 right-2 font-mono text-[8px] text-[#666960]">MINIMAP</span></button>
    </div>
    {selected && <aside className="absolute right-0 top-16 bottom-0 z-20 w-full max-w-[320px] border-l border-white/[.1] bg-[#171816] p-4 shadow-2xl md:top-16"><button aria-label="Close inspector" title="Close inspector" onClick={() => setSelected(null)} className="absolute right-3 top-3 text-[#8b8e86] hover:text-white"><X className="size-4" /></button><p className="font-mono text-[9px] uppercase tracking-[.16em]" style={{ color: COLORS[selected] }}>{GROUP[selected]}</p><h2 className="mt-2 text-base font-semibold">{LABEL[selected]}</h2><p className="mt-1 font-mono text-[10px] text-[#8b8e86]">{nodeMapSub(selected)}</p><div className="my-4 border-t border-white/[.1]" /><p className="text-[10px] uppercase tracking-wider text-[#666960]">Route activity</p>{selectedTask ? <div className="mt-2 border border-white/[.1] bg-[#11120f] p-3"><p className="truncate text-xs font-medium">{selectedTask.title}</p><p className="mt-2 font-mono text-[10px]" style={{ color: STAGE_COLOR[selectedTask.stage] }}>{selectedTask.stage}</p><p className="mt-1 truncate font-mono text-[10px] text-[#8b8e86]">{selectedTask.task_id}</p><p className="mt-3 text-[10px] text-[#666960]">{new Date(selectedTask.updated_at).toLocaleString()}</p></div> : <p className="mt-2 text-xs text-[#8b8e86]">No matching task currently routed through this service.</p>}</aside>}
  </div>
}

function nodeMapSub(id: FlowNodeId) { return NODES.find((node) => node.id === id)?.sub ?? "Existing service" }
