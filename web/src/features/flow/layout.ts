import { elbowPath } from "./elbow"
import type { FlowStage } from "./useFlowTasks"

export type FlowNodeId =
  | "orchestrator" | "kanban" | "memory" | "node-agent-server"
  | "tailscale" | "mac" | "windows"

export interface Point { x: number; y: number }

export interface LayoutNode { id: FlowNodeId; label: string; sub: string; row: number; col: number }
export interface LayoutEdge { from: FlowNodeId; to: FlowNodeId }

export const NODES: LayoutNode[] = [
  { id: "orchestrator",      label: "Orchestrator",      sub: "VPS hermes · 9router",   row: 0, col: 1 },
  { id: "kanban",            label: "Kanban",            sub: "task_events · sqlite",   row: 1, col: 0 },
  { id: "memory",            label: "Memory",            sub: "holographic fact_store", row: 1, col: 2 },
  { id: "node-agent-server", label: "node-agent server", sub: ":8788 long-poll + auth", row: 2, col: 1 },
  { id: "tailscale",         label: "Tailscale",         sub: "tailnet · direct",       row: 3, col: 1 },
  { id: "mac",               label: "Mac",               sub: "launchd dial-out",       row: 4, col: 0 },
  { id: "windows",           label: "Windows",           sub: "scheduled task",         row: 4, col: 2 },
]

export const EDGES: LayoutEdge[] = [
  { from: "orchestrator", to: "kanban" },
  { from: "orchestrator", to: "memory" },
  { from: "orchestrator", to: "node-agent-server" },
  { from: "node-agent-server", to: "tailscale" },
  { from: "tailscale", to: "mac" },
  { from: "tailscale", to: "windows" },
]

export const nodeMap = Object.fromEntries(NODES.map((n) => [n.id, n])) as Record<FlowNodeId, LayoutNode>

export function rowOf(id: FlowNodeId): number {
  return nodeMap[id]?.row ?? 0
}

export function channelPath(stage: FlowStage, nodeId: string): FlowNodeId[] {
  if (stage === "dispatched") return ["kanban", "node-agent-server"]
  if (stage === "running") {
    if (nodeId === "windows") return ["node-agent-server", "tailscale", "windows"]
    if (nodeId === "mac") return ["node-agent-server", "tailscale", "mac"]
    return ["orchestrator", "node-agent-server"]
  }
  return []
}

export function joinedPath(nodeIds: FlowNodeId[], anchorOf: (id: FlowNodeId, side: "left" | "right") => Point): string {
  const segments = nodeIds.slice(0, -1).map((id, i) => {
    const from = anchorOf(id, "right")
    const to = anchorOf(nodeIds[i + 1], "left")
    const midX = from.x + (to.x - from.x) * 0.4
    return elbowPath(from, to, midX)
  })
  return segments.join(" ")
}

// which single node represents the task for glow/badge (null = legend only)
export function stageNode(stage: FlowStage, nodeId: string): FlowNodeId | null {
  if (stage === "dispatched") return "node-agent-server"
  if (stage === "running") {
    if (nodeId === "mac") return "mac"
    if (nodeId === "windows") return "windows"
    return nodeId ? "node-agent-server" : "orchestrator"
  }
  return null
}
