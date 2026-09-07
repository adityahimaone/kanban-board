import { useRef, useState, useLayoutEffect, useCallback } from "react"
import { Brain, Database, Server, Radio, Laptop, AppWindow, Kanban } from "lucide-react"
import { NODES, EDGES, nodeMap, rowOf, channelPath, joinedPath, stageNode, type FlowNodeId, type Point } from "./layout"
import { elbowPath, elbowJoints } from "./elbow"
import { delayForTask } from "./color"
import { FlowNodeCard } from "./FlowNodeCard"
import { TravelingDot } from "./TravelingDot"
import { ShimmerEdge } from "./ShimmerEdge"
import type { FlowTask } from "./useFlowTasks"

const ROW_H = 110
const COL_W = 240
const PAD_X = 90
const PAD_TOP = 50
const CARD_W = 210 // FlowNodeCard width; anchors computed from this

const NODE_ICON: Record<FlowNodeId, typeof Brain> = {
  orchestrator: Brain,
  kanban: Kanban,
  memory: Database,
  "node-agent-server": Server,
  tailscale: Radio,
  mac: Laptop,
  windows: AppWindow,
}

export default function FlowGraph({ tasks }: { tasks: FlowTask[] }) {
  const ref = useRef<HTMLDivElement>(null)
  const [dims, setDims] = useState({ w: 900, h: 600 })

  useLayoutEffect(() => {
    if (!ref.current) return
    const ro = new ResizeObserver(([e]) => {
      setDims({ w: e.contentRect.width, h: Math.max(e.contentRect.height, 520) })
    })
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [])

  const maxRow = Math.max(...NODES.map((n) => n.row))
  const maxCol = Math.max(...NODES.map((n) => n.col))
  const svgH = (maxRow + 1) * ROW_H + PAD_TOP * 2
  const svgW = (maxCol + 1) * COL_W + PAD_X * 2

  // fit-to-width: scale down so all columns stay visible; keep centered
  const scale = Math.min(1, dims.w / svgW)
  const offX = Math.max(0, (dims.w - svgW * scale) / 2) / scale
  const offY = Math.max(0, (dims.h - svgH * scale) / 2) / scale

  // anchors on card edges: right side = exit, left side = entry
  const anchor = useCallback((id: FlowNodeId, side: "left" | "right"): Point => {
    const n = nodeMap[id]
    const cx = PAD_X + n.col * COL_W + COL_W / 2
    const cy = PAD_TOP + n.row * ROW_H + ROW_H / 2
    return { x: cx + (side === "right" ? CARD_W / 2 : -CARD_W / 2), y: cy }
  }, [])

  const edgePath = (e: { from: FlowNodeId; to: FlowNodeId }) => {
    const from = anchor(e.from, "right")
    const to = anchor(e.to, "left")
    const midX = from.x + (to.x - from.x) * 0.4
    return elbowPath(from, to, midX)
  }

  // node glow/badge: count tasks currently represented by each node
  const byNode = new Map<FlowNodeId, number>()
  for (const t of tasks) {
    const nid = stageNode(t.stage, t.node_id)
    if (!nid) continue
    byNode.set(nid, (byNode.get(nid) ?? 0) + 1)
  }

  return (
    <div className="relative min-h-0 flex-1 overflow-hidden rounded-xl border border-[#1e2430]" style={{ background: "#0b0e14" }}>
      <div
        ref={ref}
        className="absolute inset-0"
        style={{ background: "radial-gradient(#1e2430 1px, transparent 1px)", backgroundSize: "24px 24px" }}
      >
        <div
          className="absolute origin-top-left"
          style={{
            transform: `translate(${offX}px, ${offY}px) scale(${scale})`,
            width: svgW,
            height: svgH,
          }}
        >
          <svg width={svgW} height={svgH} className="absolute inset-0 pointer-events-none">
            {EDGES.map((e) => {
              const from = anchor(e.from, "right")
              const to = anchor(e.to, "left")
              const midX = from.x + (to.x - from.x) * 0.4
              return (
                <g key={`${e.from}-${e.to}`}>
                  <path d={elbowPath(from, to, midX)} fill="none" stroke="#2a3140" strokeWidth="1.25" />
                  {elbowJoints(from, to, midX).map((p, i) => (
                    <circle key={i} cx={p.x} cy={p.y} r="3" fill="#2a3140" />
                  ))}
                </g>
              )
            })}
          </svg>

          {/* idle shimmer cascade root -> leaf */}
          {tasks.length === 0 && EDGES.map((e) => (
            <ShimmerEdge key={`${e.from}-${e.to}-shimmer`} pathD={edgePath(e)} depth={rowOf(e.to)} />
          ))}

          {/* traveling dots per live task */}
          {tasks.map((t) => {
            const chain = channelPath(t.stage, t.node_id)
            if (chain.length === 0) return null
            const d = joinedPath(chain, anchor)
            return <TravelingDot key={t.task_id} taskId={t.task_id} pathD={d} delayMs={delayForTask(t.task_id)} />
          })}

          {/* node cards */}
          {NODES.map((n) => {
            const cx = PAD_X + n.col * COL_W + COL_W / 2
            const cy = PAD_TOP + n.row * ROW_H + ROW_H / 2
            const count = byNode.get(n.id) ?? 0
            return (
              <div
                key={n.id}
                className="absolute"
                style={{ left: cx, top: cy, width: CARD_W, transform: "translate(-50%, -50%)" }}
              >
                <div className="relative">
                  <FlowNodeCard label={n.label} sub={n.sub} Icon={NODE_ICON[n.id]} />
                  {count > 0 && (
                    <span
                      className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#10e0dd] px-1 text-[9px] font-bold text-black"
                    >
                      {count}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
