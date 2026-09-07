import type { Point } from "./layout"

/** Rounded elbow (right-angle) from `from` to `to`, turning at x=midX.
 *  Corners are circular ARCS (tangent-continuous) -> perfectly smooth. */
export function elbowPath(from: Point, to: Point, midX: number, rIn = 16): string {
  if (Math.abs(to.y - from.y) < 1) return `M ${from.x} ${from.y} L ${to.x} ${to.y}`
  const vert = Math.abs(to.y - from.y)
  const r = Math.min(rIn, vert / 2, Math.abs(midX - from.x), Math.abs(to.x - midX))
  const dir = to.y > from.y ? 1 : -1 // vertical travel direction (down = 1)
  const s = Math.sign(midX - from.x) // horizontal travel direction of first run
  const s2 = Math.sign(to.x - midX) // horizontal travel direction of last run
  const sweep1 = s * dir > 0 ? 1 : 0
  const sweep2 = s2 * dir > 0 ? 0 : 1
  return [
    `M ${from.x} ${from.y}`,
    `L ${midX - s * r} ${from.y}`,
    `A ${r} ${r} 0 0 ${sweep1} ${midX} ${from.y + dir * r}`,
    `L ${midX} ${to.y - dir * r}`,
    `A ${r} ${r} 0 0 ${sweep2} ${midX + s2 * r} ${to.y}`,
    `L ${to.x} ${to.y}`,
  ].join(" ")
}

/** Vertical variant (same column): turn at y=midY. */
export function elbowPathV(from: Point, to: Point, midY: number, rIn = 16): string {
  if (Math.abs(to.x - from.x) < 1) return `M ${from.x} ${from.y} L ${to.x} ${to.y}`
  const horiz = Math.abs(to.x - from.x)
  const r = Math.min(rIn, horiz / 2, Math.abs(midY - from.y), Math.abs(to.y - midY))
  const dir = to.x > from.x ? 1 : -1 // horizontal turn direction (right = 1)
  const sv = Math.sign(midY - from.y) // vertical travel direction of first run
  const sweep = sv * dir > 0 ? 1 : 0
  return [
    `M ${from.x} ${from.y}`,
    `L ${from.x} ${midY - sv * r}`,
    `A ${r} ${r} 0 0 ${sweep} ${from.x + dir * r} ${midY}`,
    `L ${to.x - dir * r} ${midY}`,
    `A ${r} ${r} 0 0 ${sweep} ${to.x} ${midY + sv * r}`,
    `L ${to.x} ${to.y}`,
  ].join(" ")
}

/** Joint points (small circles) at the vertical run of a horizontal elbow. */
export function elbowJoints(from: Point, to: Point, midX: number): Point[] {
  if (Math.abs(to.y - from.y) < 1) return []
  return [{ x: midX, y: from.y }, { x: midX, y: to.y }]
}

/** Path length for d strings of M/L/A commands (arcs = quarter circle).
 *  Good enough for constant-speed dot timing. */
export function pathLength(d: string): number {
  let total = 0
  let px = 0, py = 0
  const re = /([MLA])\s*([^MLA]+)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(d)) !== null) {
    const cmd = m[1]
    const vals = m[2].trim().split(/[\s,]+/).map(Number).filter((n) => !Number.isNaN(n))
    if (cmd === "M") {
      px = vals[0]; py = vals[1]
    } else if (cmd === "L") {
      for (let j = 0; j < vals.length; j += 2) {
        total += Math.hypot(vals[j] - px, vals[j + 1] - py)
        px = vals[j]; py = vals[j + 1]
      }
    } else {
      // A rx ry rot large sweep x y -> quarter-circle arc of radius rx
      const r = Math.abs(vals[0])
      total += (Math.PI / 2) * r
      px = vals[vals.length - 2]; py = vals[vals.length - 1]
    }
  }
  return total
}
