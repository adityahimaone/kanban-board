import { elbowPath, pathLength } from "./elbow"
import type { FlowStage } from "./useFlowTasks"

export type FlowNodeId = "kanban" | "orchestrator" | "memory" | "dispatcher" | "node-agent-server" | "tailscale" | "mac" | "windows" | "review"
export interface Point { x: number; y: number }
export interface LayoutNode { id: FlowNodeId; label: string; sub: string; x: number; y: number; hue: string; group: string }
export interface LayoutEdge { from: FlowNodeId; to: FlowNodeId; color: string }

export const NODES: LayoutNode[] = [
  { id: "kanban", label: "Kanban Queue", sub: "task intake", x: 120, y: 190, hue: "#8f83ff", group: "Task Intake" },
  { id: "orchestrator", label: "Hermes Orchestrator", sub: "control plane", x: 390, y: 190, hue: "#e5a84b", group: "Control Plane" },
  { id: "memory", label: "Memory and Prequest", sub: "context", x: 390, y: 340, hue: "#6477ff", group: "Context" },
  { id: "node-agent-server", label: "Node Agent Gateway", sub: "dispatch + auth", x: 660, y: 190, hue: "#e5a84b", group: "Dispatch" },
  { id: "tailscale", label: "Tailscale Tunnel", sub: "tailnet transport", x: 930, y: 190, hue: "#43c6d9", group: "Network" },
  { id: "mac", label: "Mac Worker", sub: "launchd · workspace", x: 1200, y: 120, hue: "#5a9cff", group: "Execution" },
  { id: "windows", label: "Windows Worker", sub: "service · workspace", x: 1200, y: 280, hue: "#e87baf", group: "Execution" },
]

export const EDGES: LayoutEdge[] = [
  { from: "kanban", to: "orchestrator", color: "#8f83ff" },
  { from: "memory", to: "orchestrator", color: "#6477ff" },
  { from: "orchestrator", to: "node-agent-server", color: "#e5a84b" },
  { from: "node-agent-server", to: "tailscale", color: "#43c6d9" },
  { from: "tailscale", to: "mac", color: "#5a9cff" },
  { from: "tailscale", to: "windows", color: "#e87baf" },
]
export const nodeMap = Object.fromEntries(NODES.map((n) => [n.id, n])) as Record<FlowNodeId, LayoutNode>
export const rowOf = (id: FlowNodeId) => nodeMap[id]?.y ?? 0

export function channelPath(stage: FlowStage, nodeId: string): FlowNodeId[] {
  const base: FlowNodeId[] = ["kanban", "orchestrator"]
  if (stage === "dispatched") return [...base, "node-agent-server"]
  if (stage === "running") {
    if (nodeId === "mac" || nodeId === "windows") return [...base, "node-agent-server", "tailscale", nodeId]
    return [...base, "node-agent-server"]
  }
  if (stage === "done" || stage === "failed") {
    if (nodeId === "mac" || nodeId === "windows") return [nodeId, "tailscale", "node-agent-server", "orchestrator", "kanban"]
    return ["node-agent-server", "orchestrator", "kanban"]
  }
  return []
}

export function joinedPath(ids: FlowNodeId[], anchors: (a: FlowNodeId, b: FlowNodeId) => [Point, Point]) {
  return ids.slice(0, -1).map((id, i) => {
    const [from, to] = anchors(id, ids[i + 1])
    return elbowPath(from, to, (from.x + to.x) / 2)
  }).join(" ")
}

export function channelDistances(ids: FlowNodeId[], anchors: (a: FlowNodeId, b: FlowNodeId) => [Point, Point]) {
  const out = [0]
  let total = 0
  for (let i = 0; i < ids.length - 1; i++) {
    const [from, to] = anchors(ids[i], ids[i + 1])
    total += pathLength(elbowPath(from, to, (from.x + to.x) / 2))
    out.push(total)
  }
  return out
}

export function stageNode(stage: FlowStage, nodeId: string): FlowNodeId | null {
  if (stage === "dispatched") return "node-agent-server"
  if (stage === "running") return nodeId === "mac" || nodeId === "windows" ? nodeId : "node-agent-server"
  if (stage === "done" || stage === "failed") return nodeId === "mac" || nodeId === "windows" ? nodeId : "node-agent-server"
  return null
}
