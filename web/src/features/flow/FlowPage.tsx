import { useFlowTasks } from "./useFlowTasks"
import FlowGraph from "./FlowGraph"
import { FlowLegendTable } from "./FlowLegendTable"
import LoadingState from "@/components/LoadingState"

export default function FlowPage() {
  const { data: tasks = [], isLoading, isError } = useFlowTasks()
  if (isLoading) return <LoadingState label="Memuat agent flow" />
  if (isError) return <p className="p-4 text-sm text-red-400">Gagal load agent flow.</p>
  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <FlowGraph tasks={tasks} />
      <FlowLegendTable tasks={tasks} />
    </div>
  )
}
