import { useQuery } from "@tanstack/react-query"
import { api } from "../../api"

export type FlowStage = "dispatched" | "running" | "done" | "failed"

export interface FlowTask {
  task_id: string
  title: string
  board: string
  node_id: string
  stage: FlowStage
  updated_at: string
}

interface FlowResponse { tasks: FlowTask[] }

export function useFlowTasks() {
  return useQuery({
    queryKey: ["flow-active"],
    queryFn: () => api<FlowResponse>("/api/flow/active"),
    refetchInterval: 5000,
    select: (d) => d.tasks,
  })
}
