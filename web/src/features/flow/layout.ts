import type { FlowStage } from "./useFlowTasks"

export interface LayoutNode { id: string; label: string; row: number; col: number; hue: string }
export interface LayoutEdge { from: string; to: string }

export const NODES: LayoutNode[] = [
  { id: "orchestrator", label: "VPS Orchestrator", row: 0, col: 1, hue: "#10e0dd" },
  { id: "kanban", label: "Kanban DB", row: 1, col: 0, hue: "#9a5cff" },
  { id: "memory", label: "Memory Store", row: 1, col: 2, hue: "#6366f1" },
  { id: "na-server", label: "node-agent :8788", row: 2, col: 1, hue: "#f09a2f" },
  { id: "tailscale", label: "Tailscale", row: 3, col: 1, hue: "#6366f1" },
  { id: "mac", label: "Mac Agent", row: 4, col: 0, hue: "#ec4899" },
  { id: "win", label: "Win Agent", row: 4, col: 2, hue: "#3b82f6" },
]

export const EDGES: LayoutEdge[] = [
  { from: "orchestrator", to: "kanban" },
  { from: "orchestrator", to: "memory" },
  { from: "orchestrator", to: "na-server" },
  { from: "na-server", to: "tailscale" },
  { from: "tailscale", to: "mac" },
  { from: "tailscale", to: "win" },
]

export function stageNode(stage: FlowStage, nodeId: string): string {
  if (stage === "dispatched" || stage === "running") {
    if (nodeId) return "na-server"
    return "orchestrator"
  }
  if (stage === "done" || stage === "failed") return nodeId || "mac"
  return "orchestrator"
}
