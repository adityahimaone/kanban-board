import { colorForTask } from "./color"

/** Colored dot that actually travels along the channel path via offset-path,
 *  ping-ponging (alternate) while the task stays in the same stage. */
export function TravelingDot({ taskId, pathD, delayMs }: { taskId: string; pathD: string; delayMs: number }) {
  const color = colorForTask(taskId)
  return (
    <div
      className="pointer-events-auto absolute left-0 top-0 size-2.5 rounded-full animate-[flow-travel_2.4s_ease-in-out_infinite_alternate]"
      style={{
        offsetPath: `path("${pathD}")`,
        animationDelay: `${delayMs}ms`,
        background: color,
        boxShadow: `0 0 6px 1px ${color}`,
      }}
      title={taskId}
    />
  )
}
