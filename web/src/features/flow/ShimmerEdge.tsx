/** Idle shimmer: soft glow traveling each edge root->leaf, depth-staggered.
 *  fill-mode backwards keeps it invisible until its delay starts (no corner artifact). */
export function ShimmerEdge({ pathD, depth }: { pathD: string; depth: number }) {
  return (
    <div
      className="pointer-events-none absolute left-0 top-0 size-1.5 rounded-full bg-white/80 blur-[0.5px]"
      style={{
        offsetPath: `path("${pathD}")`,
        offsetRotate: "0deg",
        transform: "translate(-50%, -50%)",
        animation: "flow-shimmer 3.2s ease-in-out infinite",
        animationDelay: `${depth * 240}ms`,
        animationFillMode: "backwards",
      }}
    />
  )
}
