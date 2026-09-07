import { colorForTask } from "./color"

const SPEED_PX_S = 130 // px/s -> consistent pace regardless of edge length

/** Dot travels the full channel at constant speed. Uses offset-path with the
 *  default center anchor (no transform) so it sits EXACTLY on the line.
 *  Keyframe fades in/out at the path ends -> clean handoff between hops:
 *  the dot reaches the child, fades, then respawns at the parent. */
export function TravelingDot({
  taskId, pathD, pathLen, phaseRatio,
}: {
  taskId: string
  pathD: string
  pathLen: number
  phaseRatio: number // 0..1 position in the shared cycle (even spacing)
}) {
  const color = colorForTask(taskId)
  const oneWay = Math.max(1, pathLen) / SPEED_PX_S
  const cycle = oneWay * 2.55 // travel + fade ends; alternate ping-pong via CSS

  return (
    <div
      className="pointer-events-auto absolute left-0 top-0 size-2.5 rounded-full animate-[flow-travel_0s_linear_infinite_alternate]"
      style={
        {
          offsetPath: `path("${pathD}")`,
          offsetRotate: "0deg",
          offsetAnchor: "center",
          animationDuration: `${cycle}s`,
          animationDelay: `-${phaseRatio * cycle}s`,
          animationFillMode: "backwards",
          background: color,
          boxShadow: `0 0 6px 1px ${color}`,
        } as React.CSSProperties
      }
      title={taskId}
    />
  )
}
