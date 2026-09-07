/** Idle shimmer: soft glow traveling each edge root->leaf.
 *  Wrapper is 0x0 so the point IS the path point; inner dot centered via
 *  -translate-x/y. Depth stagger preserved. */
export function ShimmerEdge({ pathD, depth }: { pathD: string; depth: number }) {
  return (
    <div
      className="pointer-events-none absolute left-0 top-0 size-0"
      style={{
        offsetPath: `path("${pathD}")`,
        offsetRotate: "0deg",
        animation: "flow-shimmer 3.2s ease-in-out infinite",
        animationDelay: `${depth * 240}ms`,
        animationFillMode: "backwards",
      }}
    >
      <span className="absolute left-0 top-0 block size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/80 blur-[0.5px]" />
    </div>
  )
}
