import { useRef, useState, useLayoutEffect, useCallback, useMemo } from "react"
import { Brain, Database, Server, Radio, Laptop, AppWindow, Kanban } from "lucide-react"
import { NODES, EDGES, nodeMap, rowOf, channelPath, joinedPath, channelDistances, stageNode, type FlowNodeId, type Point } from "./layout"
import { elbowPath, elbowPathV, elbowJoints, pathLength } from "./elbow"
import { FlowNodeCard } from "./FlowNodeCard"
import { TravelingDot, cycleFor, timeToDistance } from "./TravelingDot"
import { ShimmerEdge } from "./ShimmerEdge"
import type { FlowTask } from "./useFlowTasks"

const ROW_H = 120
const COL_W = 270
const PAD_X = 80
const PAD_TOP = 60
const CARD_W = 210
const CARD_H = 56 // fixed FlowNodeCard height (h-14) — anchors must match

const NODE_ICON: Record<FlowNodeId, typeof Brain> = {
  orchestrator: Brain,
  kanban: Kanban,
  memory: Database,
  "node-agent-server": Server,
  tailscale: Radio,
  mac: Laptop,
  windows: AppWindow,
}

/** Edge geometry between two nodes, direction-aware: exit side of `from` and
 *  entry side of `to` face each other; anchor sits at the CENTER of that side.
 *  Same column -> bottom->top (vertical elbow). Target left -> exit left/enter
 *  right (reversed horizontal elbow). Target right -> exit right/enter left. */
function edgeAnchorsFor(
  fromId: FlowNodeId,
  toId: FlowNodeId,
  posOf: (id: FlowNodeId) => Point,
): [Point, Point, Point[], string] {
  const fc = posOf(fromId)
  const tc = posOf(toId)
  const dx = tc.x - fc.x

  if (Math.abs(dx) < 1) {
    // same column: straight-ish vertical, bottom -> top
    const from = { x: fc.x, y: fc.y + CARD_H / 2 }
    const to = { x: tc.x, y: tc.y - CARD_H / 2 }
    return [from, to, [] as Point[], elbowPathV(from, to, (from.y + to.y) / 2)]
  }
  if (dx < 0) {
    // target is to the LEFT: exit left side, enter right side
    const from = { x: fc.x - CARD_W / 2, y: fc.y }
    const to = { x: tc.x + CARD_W / 2, y: tc.y }
    const midX = (from.x + to.x) / 2
    return [from, to, elbowJoints(from, to, midX), elbowPath(from, to, midX)]
  }
  // target is to the RIGHT: exit right side, enter left side
  const from = { x: fc.x + CARD_W / 2, y: fc.y }
  const to = { x: tc.x - CARD_W / 2, y: tc.y }
  const midX = (from.x + to.x) / 2
  return [from, to, elbowJoints(from, to, midX), elbowPath(from, to, midX)]
}

export default function FlowGraph({ tasks }: { tasks: FlowTask[] }) {
  const ref = useRef<HTMLDivElement>(null)
  const [dims, setDims] = useState({ w: 900, h: 600 })
  // node drag: overrides store center position; anchors recompute live so
  // edges stay attached exactly at card mid-sides while dragging.
  const [overrides, setOverrides] = useState<Partial<Record<FlowNodeId, Point>>>({})
  const dragRef = useRef<{ id: FlowNodeId; dx: number; dy: number } | null>(null)

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

  // fit-to-width, centered both axes
  const scale = Math.min(1, dims.w / svgW)
  const offX = Math.max(0, (dims.w - svgW * scale) / 2) / scale
  const offY = Math.max(0, (dims.h - svgH * scale) / 2) / scale

  const posOf = useCallback((id: FlowNodeId): Point => {
    const n = nodeMap[id]
    const base = { x: PAD_X + n.col * COL_W + COL_W / 2, y: PAD_TOP + n.row * ROW_H + ROW_H / 2 }
    return overrides[id] ?? base
  }, [overrides])

  const edgeAnchors = useCallback(
    (a: FlowNodeId, b: FlowNodeId): [Point, Point] => edgeAnchorsFor(a, b, posOf).slice(0, 2) as [Point, Point],
    [posOf],
  )

  const edges = EDGES.map((e) => {
    const [from, to, joints, d] = edgeAnchorsFor(e.from, e.to, posOf)
    return { ...e, from, to, joints, d }
  })

  // node glow/badge: count tasks currently represented by each node
  const byNode = new Map<FlowNodeId, number>()
  for (const t of tasks) {
    const nid = stageNode(t.stage, t.node_id)
    if (!nid) continue
    byNode.set(nid, (byNode.get(nid) ?? 0) + 1)
  }

  // group live tasks by channel so dots sharing the same path are evenly
  // spaced (phaseRatio = i/n). Each channel also drives card pulses synced to
  // dot arrival: parent card pulses at t=0, next card when the dot reaches it.
  const channelGroups = useMemo(() => {
    const m = new Map<string, { chain: FlowNodeId[]; items: FlowTask[] }>()
    for (const t of tasks) {
      const chain = channelPath(t.stage, t.node_id)
      if (chain.length < 2) continue
      const key = chain.join(">")
      const g = m.get(key)
      if (g) g.items.push(t)
      else m.set(key, { chain, items: [t] })
    }
    for (const g of m.values()) g.items.sort((a, b) => a.task_id.localeCompare(b.task_id))
    return [...m.values()]
  }, [tasks])

  // per-node card pulse synced to dot arrival: for each channel, the card at
  // path-distance `dist` pulses exactly when the dot reaches that distance
  // (timeToDistance), using the channel's own cycle. Exact arc-aware
  // distances via channelDistances().
  const pulseFor = useMemo(() => {
    const map = new Map<FlowNodeId, { delay: number; cycle: number; hue: string }>()
    for (const g of channelGroups) {
      const dists = channelDistances(g.chain, edgeAnchors)
      const len = dists[dists.length - 1] || 1
      const cycle = cycleFor(len)
      for (let i = 0; i < g.chain.length; i++) {
        const nid = g.chain[i]
        if (map.has(nid)) continue
        map.set(nid, {
          delay: ((timeToDistance(len, dists[i]) % cycle) + cycle) % cycle,
          cycle,
          hue: nodeMap[nid].hue,
        })
      }
    }
    return map
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelGroups, edgeAnchors])

  const onNodePointerDown = (e: React.PointerEvent, id: FlowNodeId) => {
    e.stopPropagation()
    const cur = posOf(id)
    dragRef.current = { id, dx: e.clientX - cur.x, dy: e.clientY - cur.y }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }
  const onNodePointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current
    if (!d) return
    setOverrides((prev) => ({ ...prev, [d.id]: { x: e.clientX - d.dx, y: e.clientY - d.dy } }))
  }
  const onNodePointerUp = () => { dragRef.current = null }
  const resetLayout = () => setOverrides({})

  return (
    <div className="relative min-h-0 flex-1 overflow-hidden rounded-xl border border-[#1e2430]" style={{ background: "#0b0e14" }}>
      {Object.keys(overrides).length > 0 && (
        <button
          onClick={resetLayout}
          className="absolute left-3 top-3 z-10 rounded-lg border border-[#2a3140] bg-[#11151f] px-2 py-1 text-[10px] font-mono text-neutral-400 transition-colors hover:text-white"
        >
          reset layout
        </button>
      )}
      <div
        ref={ref}
        className="absolute inset-0"
        style={{ background: "radial-gradient(#1e2430 1px, transparent 1px)", backgroundSize: "24px 24px" }}
      >
        <div
          className="absolute origin-top-left"
          style={{ transform: `translate(${offX}px, ${offY}px) scale(${scale})`, width: svgW, height: svgH }}
        >
          <svg width={svgW} height={svgH} className="absolute inset-0 pointer-events-none">
            {edges.map((e) => (
              <g key={`${e.from}-${e.to}`}>
                <path d={e.d} fill="none" stroke="#2a3140" strokeWidth={1.25} strokeLinecap="round" strokeLinejoin="round" />
              </g>
            ))}
          </svg>

          {/* idle shimmer cascade root -> leaf */}
          {tasks.length === 0 && EDGES.map((e) => (
            <ShimmerEdge
              key={`${e.from}-${e.to}-shimmer`}
              pathD={edgeAnchorsFor(e.from, e.to, posOf)[3]}
              depth={rowOf(e.to)}
            />
          ))}

          {/* traveling dots — one channel at a time, evenly phased */}
          {channelGroups.map((g) => {
            const d = joinedPath(g.chain, edgeAnchors)
            const len = pathLength(d)
            return g.items.map((t, i) => (
              <TravelingDot
                key={t.task_id}
                taskId={t.task_id}
                pathD={d}
                pathLen={len}
                phaseRatio={g.items.length === 1 ? 0 : i / g.items.length}
              />
            ))
          })}

          {/* node cards */}
          {NODES.map((n) => {
            const p = posOf(n.id)
            const count = byNode.get(n.id) ?? 0
            const pulse = pulseFor.get(n.id)
            return (
              <div
                key={n.id}
                data-node={n.id}
                className="absolute cursor-grab touch-none select-none active:cursor-grabbing"
                style={{ left: p.x, top: p.y, width: CARD_W, transform: "translate(-50%, -50%)" }}
                onPointerDown={(e) => onNodePointerDown(e, n.id)}
                onPointerMove={onNodePointerMove}
                onPointerUp={onNodePointerUp}
                onPointerCancel={onNodePointerUp}
              >
                <div className="relative">
                  <FlowNodeCard label={n.label} sub={n.sub} Icon={NODE_ICON[n.id]} hue={n.hue} />
                  {/* shimmer + pulse ring: card glows as the dot wave passes it */}
                  {pulse && (
                    <div
                      className="pointer-events-none absolute inset-0 rounded-2xl animate-[flow-card-pulse_0s_ease-out_infinite]"
                      style={
                        {
                          "--pulse-hue": pulse.hue + "66",
                          animationDuration: `${pulse.cycle}s`,
                          animationDelay: `-${pulse.delay}s`,
                          animationFillMode: "backwards",
                        } as React.CSSProperties
                      }
                    />
                  )}
                  {count > 0 && (
                    <span
                      className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold text-black"
                      style={{ background: n.hue }}
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
