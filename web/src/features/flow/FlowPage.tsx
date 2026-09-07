import { useFlowTasks } from "./useFlowTasks"
import AgentFlowGraph from "./AgentFlowGraph"
import DoneTray from "./DoneTray"

export default function FlowPage() {
  const { data: tasks = [] } = useFlowTasks()
  const live = tasks.filter((t) => t.stage !== "done" && t.stage !== "failed")
  const finished = tasks.filter((t) => t.stage === "done" || t.stage === "failed")
  return (
    <div className="flex h-full min-h-[500px] gap-2">
      <div className="min-w-0 flex-1">
        <AgentFlowGraph tasks={live} />
      </div>
      <DoneTray tasks={finished} />
    </div>
  )
}
