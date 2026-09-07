import { useFlowTasks } from "./useFlowTasks"
import FlowGraph from "./FlowGraph"
import { FlowLegendTable } from "./FlowLegendTable"

export default function FlowPage() {
  const { data: tasks = [] } = useFlowTasks()
  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <FlowGraph tasks={tasks} />
      <FlowLegendTable tasks={tasks} />
    </div>
  )
}
