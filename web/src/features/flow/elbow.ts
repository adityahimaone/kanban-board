import type { Point } from "./layout"

/** Elbow connector (right-angle with rounded corners) from `from` to `to`,
 *  turning at x=midX, corner radius `r`. Used for every edge — trunk and branch. */
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

/** Joint points (small circles) — start corner + end corner of the elbow. */
export function elbowJoints(from: Point, to: Point, midX: number): Point[] {
  if (Math.abs(to.y - from.y) < 1) return []
  return [{ x: midX, y: from.y }, { x: midX, y: to.y }]
}
