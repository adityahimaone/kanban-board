import type { Point } from "./layout"

/** Elbow connector (right-angle, rounded corners) from `from` to `to`,
 *  turning at x=midX, corner radius `r`. */
export function elbowPath(from: Point, to: Point, midX: number, r = 10): string {
  const dir = to.y > from.y ? 1 : -1
  if (Math.abs(to.y - from.y) < 1) {
    return `M ${from.x} ${from.y} L ${to.x} ${to.y}`
  }
  return [
    `M ${from.x} ${from.y}`,
    `L ${midX - r} ${from.y}`,
    `Q ${midX} ${from.y} ${midX} ${from.y + r * dir}`,
    `L ${midX} ${to.y - r * dir}`,
    `Q ${midX} ${to.y} ${midX + r} ${to.y}`,
    `L ${to.x} ${to.y}`,
  ].join(" ")
}

/** Same-shape elbow for VERTICAL travel (turn at y=midY) — used for
 *  same-column edges (bottom of upper card -> top of lower card). */
export function elbowPathV(from: Point, to: Point, midY: number, r = 10): string {
  const dir = to.x > from.x ? 1 : -1
  if (Math.abs(to.x - from.x) < 1) {
    return `M ${from.x} ${from.y} L ${to.x} ${to.y}`
  }
  return [
    `M ${from.x} ${from.y}`,
    `L ${from.x} ${midY - r * dir}`,
    `Q ${from.x} ${midY} ${from.x + r * dir} ${midY}`,
    `L ${to.x - r * dir} ${midY}`,
    `Q ${to.x} ${midY} ${to.x} ${midY + r * dir}`,
    `L ${to.x} ${to.y}`,
  ].join(" ")
}

/** Joint points (small circles) for the horizontal elbow. */
export function elbowJoints(from: Point, to: Point, midX: number): Point[] {
  if (Math.abs(to.y - from.y) < 1) return []
  return [{ x: midX, y: from.y }, { x: midX, y: to.y }]
}

/** Joint points for the vertical elbow. */
export function elbowJointsV(from: Point, to: Point, midY: number): Point[] {
  if (Math.abs(to.x - from.x) < 1) return []
  return [{ x: from.x, y: midY }, { x: to.x, y: midY }]
}
