import { elbowPath, pathLength } from "./elbow"
import type { FlowStage } from "./useFlowTasks"

export type FlowNodeId =
  | "orchestrator" | "kanban" | "dispatcher" | "memory" | "node-agent-server"
  | "tailscale" | "mac" | "windows" | "review"

export type Side = "left" | "right" | "top" | "bottom"

export interface Point { x: number; y: number }

export interface LayoutNode { id: FlowNodeId; label: string; sub: string; row: number; col: number; hue: string }
export interface LayoutEdge { from: FlowNodeId; to: FlowNodeId }

// distinct hue per card (icon badge + count badge + active border)
export const NODES: LayoutNode[] = [
  { id: "orchestrator",      label: "Orchestrator",      sub: "intent + memory",        row: 0, col: 1, hue: "#10e0dd" },
  { id: "kanban",            label: "Kanban",            sub: "SQLite · task lifecycle", row: 1, col: 0, hue: "#9a5cff" },
  { id: "dispatcher",        label: "Dispatcher",        sub: "claim · resolve route",  row: 1, col: 1, hue: "#f59e0b" },
  { id: "memory",            label: "Memory",            sub: "fact store",              row: 1, col: 2, hue: "#6366f1" },
  { id: "node-agent-server", label: "Node-agent server", sub: "queue · auth · capability", row: 2, col: 1, hue: "#f09a2f" },
  { id: "tailscale",         label: "Tailscale",         sub: "tailnet transport",       row: 3, col: 1, hue: "#38bdf8" },
  { id: "mac",               label: "Mac worker",        sub: "launchd · workspace",     row: 4, col: 0, hue: "#ec4899" },
  { id: "windows",           label: "Windows worker",    sub: "scheduled task · workspace", row: 4, col: 2, hue: "#3b82f6" },
  { id: "review",            label: "Review gate",       sub: "diff · approve · commit", row: 5, col: 1, hue: "#22c55e" },
]

export const EDGES: LayoutEdge[] = [
  { from: "orchestrator", to: "kanban" },
  { from: "orchestrator", to: "memory" },
  { from: "kanban", to: "dispatcher" },
  { from: "dispatcher", to: "node-agent-server" },
  { from: "node-agent-server", to: "tailscale" },
  { from: "tailscale", to: "mac" },
  { from: "tailscale", to: "windows" },
  { from: "mac", to: "review" },
  { from: "windows", to: "review" },
  { from: "review", to: "kanban" },
]

export const nodeMap = Object.fromEntries(NODES.map((n) => [n.id, n])) as Record<FlowNodeId, LayoutNode>

export function rowOf(id: FlowNodeId): number {
  return nodeMap[id]?.row ?? 0
}

export function channelPath(stage: FlowStage, nodeId: string): FlowNodeId[] {
  if (stage === "dispatched") return ["kanban", "dispatcher", "node-agent-server"]
  if (stage === "running") {
    if (nodeId === "windows") return ["dispatcher", "node-agent-server", "tailscale", "windows"]
    if (nodeId === "mac") return ["dispatcher", "node-agent-server", "tailscale", "mac"]
    return ["kanban", "dispatcher", "node-agent-server"]
  }
  if (stage === "done" || stage === "failed") {
    if (nodeId === "windows") return ["windows", "review", "kanban"]
    if (nodeId === "mac") return ["mac", "review", "kanban"]
    return ["node-agent-server", "review", "kanban"]
  }
  return []
}

export function joinedPath(nodeIds: FlowNodeId[], edgeAnchors: (a: FlowNodeId, b: FlowNodeId) => [Point, Point]): string {
  const segments = nodeIds.slice(0, -1).map((id, i) => {
    const [from, to] = edgeAnchors(id, nodeIds[i + 1])
    const midX = (from.x + to.x) / 2
    return elbowPath(from, to, midX)
  })
  return segments.join(" ")
}

/** Distance from the start of a joined channel path to each node anchor —
 *  exact arc-aware walk (reuses pathLength so turns/curves count). */
export function channelDistances(
  nodeIds: FlowNodeId[],
  edgeAnchors: (a: FlowNodeId, b: FlowNodeId) => [Point, Point],
): number[] {
  const out: number[] = [0]
  let acc = 0
  for (let i = 0; i < nodeIds.length - 1; i++) {
    const [from, to] = edgeAnchors(nodeIds[i], nodeIds[i + 1])
    const midX = (from.x + to.x) / 2
    acc += pathLength(elbowPath(from, to, midX))
    out.push(acc)
  }
  return out
}

// which single node represents the task for glow/badge (null = legend only)
export function stageNode(stage: FlowStage, nodeId: string): FlowNodeId | null {
  if (stage === "dispatched") return "dispatcher"
  if (stage === "running") {
    if (nodeId === "mac") return "mac"
    if (nodeId === "windows") return "windows"
    return nodeId ? "node-agent-server" : "orchestrator"
  }
  if (stage === "done" || stage === "failed") return "review"
  return null
}
