import { colorForTask } from "./color"

const SPEED_PX_S = 130 // px/s -> consistent pace regardless of edge length

/** Full cycle (s) of the ping-pong travel animation for a path of `pathLen` px.
 *  Keyframe timeline: 0-50% forward, 50-100% return (with end fades). */
export function cycleFor(pathLen: number): number {
  const oneWay = Math.max(1, pathLen) / SPEED_PX_S
  return oneWay * 2.55
}

/** Time (s) from cycle start until the dot reaches `dist` px along the path
 *  (forward pass). Used to sync card shimmers to dot arrival. */
export function timeToDistance(pathLen: number, dist: number): number {
  return 0.5 * (dist / Math.max(1, pathLen)) * cycleFor(pathLen)
}

/** Dot travels the full channel at constant speed. The offset-path wrapper is
 *  0x0 so the moving point IS the exact path point; the visible dot is centered
 *  inside it via translate(-50%,-50%) -> always dead-center on the line,
 *  including through corners. */
export function TravelingDot({
  taskId, pathD, pathLen, phaseRatio,
}: {
  taskId: string
  pathD: string
  pathLen: number
  phaseRatio: number // 0..1 position in the shared cycle (even spacing)
}) {
  const color = colorForTask(taskId)
  const cycle = cycleFor(pathLen)

  return (
    <div
      className="pointer-events-none absolute left-0 top-0 size-0 animate-[flow-travel_0s_linear_infinite_alternate]"
      style={
        {
          offsetPath: `path("${pathD}")`,
          offsetRotate: "0deg",
          animationDuration: `${cycle}s`,
          animationDelay: `-${phaseRatio * cycle}s`,
          animationFillMode: "backwards",
        } as React.CSSProperties
      }
    >
      <span
        className="pointer-events-auto absolute left-0 top-0 block size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ background: color, boxShadow: `0 0 6px 1px ${color}` }}
        title={taskId}
      />
    </div>
  )
}
