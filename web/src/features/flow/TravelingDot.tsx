
const SPEED_IDLE = 80 // px/s one-way for permanent idle dots
const SPEED_ACTIVE = 260 // px/s one-way when a session drives the hop
const SPEED_DEFAULT = 130

/** Full cycle (s) of the ping-pong travel animation for a path of `pathLen` px.
 *  Keyframe timeline: 0-50% forward, 50-100% return (with end fades). */
export function cycleFor(pathLen: number, speed = SPEED_DEFAULT): number {
  const oneWay = Math.max(1, pathLen) / speed
  return oneWay * 2.55
}

/** Time (s) from cycle start until the dot reaches `dist` px along the path
 *  (forward pass). Used to sync card shimmers to dot arrival. */
export function timeToDistance(pathLen: number, dist: number, speed = SPEED_DEFAULT): number {
  return 0.5 * (dist / Math.max(1, pathLen)) * cycleFor(pathLen, speed)
}

/** Dot travels its hop at constant speed. The offset-path wrapper is 0x0 so the
 *  moving point IS the exact path point; the visible dot is centered inside it
 *  via translate(-50%,-50%) -> always dead-center on the line, corners included.
 *  idle  = permanent ambient dot (dim, slow)
 *  active= session-driven dot (bright, bigger, fast) */
export function TravelingDot({
  taskId, pathD, pathLen, phaseRatio, idle = false, active = false,
}: {
  taskId: string
  pathD: string
  pathLen: number
  phaseRatio: number // 0..1 position in the shared cycle (even spacing)
  idle?: boolean
  active?: boolean
}) {
  const color = "#f5f7f2"
  const cycle = cycleFor(pathLen, idle ? SPEED_IDLE : active ? SPEED_ACTIVE : SPEED_DEFAULT)
  const size = idle ? 4 : active ? 5 : 4.5

  return (
    <div
      className={`pointer-events-none absolute left-0 top-0 size-0 ${idle ? "animate-[flow-idle_0s_linear_infinite]" : "animate-[flow-travel_0s_linear_infinite_alternate]"}`}
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
        className="pointer-events-auto absolute left-0 top-0 block -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          width: size,
          height: size,
          background: color,
          opacity: idle ? 0.75 : 1,
          boxShadow: `0 0 ${active ? 6 : 3}px ${active ? 1.5 : 1}px rgba(245,247,242,.8)`,
        }}
        title={taskId}
      />
    </div>
  )
}
