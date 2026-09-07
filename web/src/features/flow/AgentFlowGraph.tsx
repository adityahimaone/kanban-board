import { useRef, useState, useLayoutEffect, useCallback } from "react"
import { NODES, EDGES, stageNode, type LayoutNode } from "./layout"
import type { FlowTask } from "./useFlowTasks"
import TaskBubble from "./TaskBubble"
import { ZoomIn, ZoomOut, Maximize2 } from "lucide-react"

const ROW_H = 100
const COL_W = 200
const PAD = 60

function bezier(from: { x: number; y: number }, to: { x: number; y: number }) {
  const dy = Math.abs(to.y - from.y) * 0.5
  return `M ${from.x} ${from.y} C ${from.x} ${from.y + dy}, ${to.x} ${to.y - dy}, ${to.x} ${to.y}`
}

export default function AgentFlowGraph({ tasks }: { tasks: FlowTask[] }) {
  const ref = useRef<HTMLDivElement>(null)
  const [dims, setDims] = useState({ w: 800, h: 600 })
  const [overrides, setOverrides] = useState<Record<string, { x: number; y: number }>>({})
  const dragRef = useRef<{ id: string; dx: number; dy: number } | null>(null)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const panDrag = useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(null)

  useLayoutEffect(() => {
    if (!ref.current) return
    const ro = new ResizeObserver(([e]) => {
      setDims({ w: e.contentRect.width, h: Math.max(e.contentRect.height, 500) })
    })
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [])

  const maxRow = Math.max(...NODES.map((n) => n.row))
  const maxCol = Math.max(...NODES.map((n) => n.col))
  const svgH = (maxRow + 1) * ROW_H + PAD * 2
  const svgW = (maxCol + 1) * COL_W + PAD * 2

  const pos = (n: LayoutNode) => ({
    x: PAD + n.col * COL_W + COL_W / 2,
    y: PAD + n.row * ROW_H + ROW_H / 2,
  })
  const resolve = (n: LayoutNode) => overrides[n.id] ?? pos(n)
  const nodeMap = Object.fromEntries(NODES.map((n) => [n.id, n]))

  const tasksByNode = new Map<string, FlowTask[]>()
  for (const t of tasks) {
    if (t.stage === "done" || t.stage === "failed") continue
    const nid = stageNode(t.stage, t.node_id)
    const arr = tasksByNode.get(nid) || []
    arr.push(t)
    tasksByNode.set(nid, arr)
  }

  const zoomIn = () => setZoom((z) => Math.min(z + 0.25, 3))
  const zoomOut = () => setZoom((z) => Math.max(z - 0.25, 0.25))
  const resetView = () => { setZoom(1); setPan({ x: 0, y: 0 }); setOverrides({}) }

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    setZoom((z) => Math.min(Math.max(z - e.deltaY * 0.001, 0.25), 3))
  }, [])

  const activeCount = tasks.length
  const runningCount = tasks.filter((t) => t.stage === "running").length
  const dispatchedCount = tasks.filter((t) => t.stage === "dispatched").length

  return (
    <div className="relative h-full min-h-[500px] w-full overflow-hidden rounded-xl" style={{ background: "#0b0e14" }}>
      {/* dot grid background */}
      <svg className="pointer-events-none absolute inset-0 h-full w-full">
        <defs>
          <pattern id="dot-grid" width="24" height="24" patternUnits="userSpaceOnUse">
            <circle cx="12" cy="12" r="1" fill="#1e2430" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#dot-grid)" />
      </svg>

      {/* zoom controls */}
      <div className="absolute left-3 top-3 z-10 flex items-center gap-1">
        <button onClick={zoomOut} className="flex h-7 w-7 items-center justify-center rounded-lg border text-neutral-400 transition-colors hover:bg-[#1e2430] hover:text-white" style={{ background: "#11151f", borderColor: "#1e2430" }}>
          <ZoomOut className="size-3.5" />
        </button>
        <span className="min-w-[3rem] text-center text-[10px] font-mono text-neutral-500">{Math.round(zoom * 100)}%</span>
        <button onClick={zoomIn} className="flex h-7 w-7 items-center justify-center rounded-lg border text-neutral-400 transition-colors hover:bg-[#1e2430] hover:text-white" style={{ background: "#11151f", borderColor: "#1e2430" }}>
          <ZoomIn className="size-3.5" />
        </button>
        <button onClick={resetView} className="ml-1 flex h-7 w-7 items-center justify-center rounded-lg border text-neutral-400 transition-colors hover:bg-[#1e2430] hover:text-white" style={{ background: "#11151f", borderColor: "#1e2430" }} title="Reset view">
          <Maximize2 className="size-3.5" />
        </button>
      </div>

      {/* stats badges */}
      <div className="absolute right-3 top-3 z-10 flex gap-1.5">
        {activeCount > 0 && (
          <>
            <span className="rounded-md border px-2 py-0.5 text-[10px] font-semibold" style={{ background: "rgba(16,224,221,0.08)", borderColor: "rgba(16,224,221,0.25)", color: "#10e0dd" }}>
              {activeCount} active
            </span>
            {runningCount > 0 && (
              <span className="rounded-md border px-2 py-0.5 text-[10px] font-semibold" style={{ background: "rgba(16,224,221,0.08)", borderColor: "rgba(16,224,221,0.25)", color: "#10e0dd" }}>
                {runningCount} running
              </span>
            )}
            {dispatchedCount > 0 && (
              <span className="rounded-md border px-2 py-0.5 text-[10px] font-semibold" style={{ background: "rgba(240,154,47,0.08)", borderColor: "rgba(240,154,47,0.25)", color: "#f09a2f" }}>
                {dispatchedCount} queued
              </span>
            )}
          </>
        )}
      </div>

      {/* canvas with zoom+pan */}
      <div
        ref={ref}
        className="h-full w-full cursor-grab active:cursor-grabbing"
        onWheel={handleWheel}
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).closest("[data-node]")) return
          panDrag.current = { startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y }
          e.currentTarget.setPointerCapture(e.pointerId)
        }}
        onPointerMove={(e) => {
          const d = panDrag.current
          if (!d) return
          setPan({ x: d.panX + (e.clientX - d.startX), y: d.panY + (e.clientY - d.startY) })
        }}
        onPointerUp={() => { panDrag.current = null }}
        onPointerCancel={() => { panDrag.current = null }}
      >
        <div
          className="relative origin-top-left"
          style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, width: Math.max(dims.w, svgW), height: Math.max(dims.h, svgH) }}
        >
          <svg width={Math.max(dims.w, svgW)} height={Math.max(dims.h, svgH)} className="absolute inset-0 pointer-events-none">
            {EDGES.map((e) => {
              const a = nodeMap[e.from], b = nodeMap[e.to]
              if (!a || !b) return null
              return <path key={`${e.from}-${e.to}`} d={bezier(resolve(a), resolve(b))} fill="none" stroke="#1e2430" strokeWidth={1.5} />
            })}
          </svg>
          {NODES.map((n) => {
            const p = resolve(n)
            const taskCount = tasksByNode.get(n.id)?.length ?? 0
            return (
              <div
                key={n.id}
                data-node={n.id}
                className="absolute flex cursor-grab touch-none select-none flex-col items-center gap-1 active:cursor-grabbing"
                style={{ left: p.x, top: p.y, transform: "translate(-50%,-50%)" }}
                onPointerDown={(e) => {
                  e.stopPropagation()
                  if (!ref.current) return
                  const rect = ref.current.getBoundingClientRect()
                  const cur = resolve(n)
                  dragRef.current = { id: n.id, dx: (e.clientX - rect.left - pan.x) / zoom - cur.x, dy: (e.clientY - rect.top - pan.y) / zoom - cur.y }
                  e.currentTarget.setPointerCapture(e.pointerId)
                }}
                onPointerMove={(e) => {
                  const d = dragRef.current
                  if (!d || d.id !== n.id || !ref.current) return
                  const rect = ref.current.getBoundingClientRect()
                  setOverrides((prev) => ({
                    ...prev,
                    [n.id]: { x: (e.clientX - rect.left - pan.x) / zoom - d.dx, y: (e.clientY - rect.top - pan.y) / zoom - d.dy },
                  }))
                }}
                onPointerUp={() => { dragRef.current = null }}
                onPointerCancel={() => { dragRef.current = null }}
              >
                <div
                  className="relative rounded-xl border px-4 py-2.5 text-xs font-semibold shadow-lg transition-shadow hover:shadow-xl"
                  style={{
                    background: "linear-gradient(135deg, #11151f 0%, #0f1219 100%)",
                    borderColor: taskCount > 0 ? n.hue : "#1e2430",
                    color: n.hue,
                    boxShadow: taskCount > 0 ? `0 0 20px ${n.hue}22` : undefined,
                  }}
                >
                  {n.label}
                  {taskCount > 0 && (
                    <span
                      className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold text-black"
                      style={{ background: n.hue }}
                    >
                      {taskCount}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
          {Array.from(tasksByNode.entries()).map(([nid, ts]) => {
            const n = nodeMap[nid]
            if (!n) return null
            const p = resolve(n)
            const count = ts.length
            // ponytail: grid fan-out (3 per row) with dynamic gap. Upgrade to force-layout if >8 tasks per node.
            const gap = Math.min(90, 260 / Math.max(count, 1))
            return ts.map((t, i) => {
              const col = i % 3
              const row = Math.floor(i / 3)
              const colsInRow = Math.min(count - row * 3, 3)
              const xOff = (col - (colsInRow - 1) / 2) * gap
              const yOff = 40 + row * 30
              return <TaskBubble key={t.task_id} task={t} x={p.x + xOff} y={p.y + yOff} />
            })
          })}
        </div>
      </div>
    </div>
  )
}