import { useRef, useState, useLayoutEffect } from "react"

// ponytail: static node graph from task events. Add live SSE/WebSocket push when real-time bubble movement needed.
// ponytail: drag-to-reorder nodes skipped. Add when user wants custom layout persistence.

const GREEN = "#22c55e"
const GRAY = "#6b7280"

const mix = (hue: string, pct: number, base = "var(--surface, #11151f)") =>
  `color-mix(in srgb, ${hue} ${pct}%, ${base})`

export type FlowNodeKind = "trigger" | "vps" | "node-agent" | "remote" | "done" | "error"

export interface FlowNode {
  id: string
  kind: FlowNodeKind
  label: string
  sub?: string
  hue: string
  active?: boolean
  done?: boolean
}

export interface FlowEdge {
  from: string
  to: string
}

function nodeHue(n: FlowNode) {
  if (n.done) return GREEN
  if (n.active) return n.hue
  return GRAY
}

function StatusDot({ node }: { node: FlowNode }) {
  const h = nodeHue(node)
  return (
    <span
      className="inline-block size-2 shrink-0 rounded-full"
      style={{
        background: h,
        boxShadow: node.active ? `0 0 6px ${h}` : "none",
      }}
    />
  )
}

function NodeCard({ node, selected, onClick }: { node: FlowNode; selected: boolean; onClick: () => void }) {
  const h = nodeHue(node)
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex w-56 cursor-pointer flex-col gap-1 rounded-xl border p-3 text-left transition-all duration-150
        ${selected ? "border-[var(--accent)] shadow-[0_0_0_1px_var(--accent)]" : "border-[#1e2430]/60 hover:border-[#1e2430]"}`}
      style={{ background: mix(h, 6) }}
    >
      <div className="flex items-center gap-2">
        <StatusDot node={node} />
        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: h }}>
          {node.kind}
        </span>
      </div>
      <span className="truncate text-sm font-medium text-[var(--ink, #e5e7eb)]">{node.label}</span>
      {node.sub && <span className="truncate text-[11px] text-[var(--ink-3, #6b7280)]">{node.sub}</span>}
    </button>
  )
}

export default function AgentFlowGraph({
  nodes,
  edges,
  onNodeClick,
}: {
  nodes: FlowNode[]
  edges: FlowEdge[]
  onNodeClick?: (id: string) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const nodeRefs = useRef(new Map<string, HTMLDivElement>())
  const [dims, setDims] = useState<{ w: number; h: number }>({ w: 0, h: 0 })
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({})
  const [selected, setSelected] = useState<string | null>(null)

  useLayoutEffect(() => {
    if (!containerRef.current) return
    const cw = containerRef.current.clientWidth
    const ch = Math.max(containerRef.current.clientHeight, 280)
    setDims({ w: cw, h: ch })

    const incoming = new Map<string, string[]>()
    const outgoing = new Map<string, string[]>()
    for (const e of edges) {
      outgoing.set(e.from, [...(outgoing.get(e.from) ?? []), e.to])
      incoming.set(e.to, [...(incoming.get(e.to) ?? []), e.from])
    }
    const roots = nodes.filter((n) => !incoming.has(n.id)).map((n) => n.id)
    const layer = new Map<string, number>()
    const queue = [...roots]
    for (const r of roots) layer.set(r, 0)
    while (queue.length) {
      const cur = queue.shift()!
      const cl = layer.get(cur)!
      for (const nxt of outgoing.get(cur) ?? []) {
        const prev = layer.get(nxt)
        if (prev === undefined || prev < cl + 1) {
          layer.set(nxt, cl + 1)
          queue.push(nxt)
        }
      }
    }
    for (const n of nodes) if (!layer.has(n.id)) layer.set(n.id, 0)

    const maxLayer = Math.max(0, ...Array.from(layer.values()))
    const cols = maxLayer + 1
    const colW = cw / Math.max(cols, 1)

    const groups = new Map<number, string[]>()
    for (const [id, l] of layer) {
      groups.set(l, [...(groups.get(l) ?? []), id])
    }

    const pos: Record<string, { x: number; y: number }> = {}
    for (let l = 0; l <= maxLayer; l++) {
      const ids = groups.get(l) ?? []
      const rowH = ch / Math.max(ids.length, 1)
      ids.forEach((id, i) => {
        pos[id] = { x: colW * l + colW / 2, y: rowH * i + rowH / 2 }
      })
    }
    setPositions(pos)
  }, [nodes, edges])

  const handleClick = (id: string) => {
    setSelected((prev) => (prev === id ? null : id))
    onNodeClick?.(id)
  }

  const pathFor = (e: FlowEdge) => {
    const a = positions[e.from]
    const b = positions[e.to]
    if (!a || !b) return ""
    const dx = Math.abs(b.x - a.x) * 0.5
    return `M ${a.x} ${a.y} C ${a.x + dx} ${a.y}, ${b.x - dx} ${b.y}, ${b.x} ${b.y}`
  }

  const isLit = (e: FlowEdge) => selected === e.from || selected === e.to

  return (
    <div ref={containerRef} className="relative h-full min-h-[280px] w-full select-none overflow-hidden rounded-xl bg-[#0b0e14]/60">
      <div
        className="pointer-events-none absolute inset-0 opacity-20"
        style={{
          backgroundImage: "radial-gradient(var(--line-strong, #1e2430) 1px, transparent 1.25px)",
          backgroundSize: "22px 22px",
        }}
      />
      <svg className="pointer-events-none absolute inset-0" width={dims.w} height={dims.h}>
        {edges.map((e) => (
          <path
            key={`${e.from}-${e.to}`}
            d={pathFor(e)}
            fill="none"
            stroke={isLit(e) ? "var(--accent, #10e0dd)" : "#1e2430"}
            strokeWidth={isLit(e) ? 2 : 1.25}
            className="transition-colors duration-150"
          />
        ))}
      </svg>
      {nodes.map((n) => {
        const p = positions[n.id]
        if (!p) return null
        return (
          <div
            key={n.id}
            ref={(el) => {
              if (el) nodeRefs.current.set(n.id, el)
              else nodeRefs.current.delete(n.id)
            }}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: p.x, top: p.y }}
          >
            <NodeCard node={n} selected={selected === n.id} onClick={() => handleClick(n.id)} />
          </div>
        )
      })}
    </div>
  )
}

