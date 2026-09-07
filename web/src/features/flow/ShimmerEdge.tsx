/** Idle shimmer: soft glow dot cascading root->leaf per edge, depth-staggered. */
export function ShimmerEdge({ pathD, depth }: { pathD: string; depth: number }) {
  return (
    <div
      className="pointer-events-none absolute left-0 top-0 size-2 rounded-full bg-white/70 blur-[1px]"
      style={{
        offsetPath: `path("${pathD}")`,
        animation: "flow-shimmer 3.2s ease-in-out infinite",
        animationDelay: `${depth * 240}ms`,
      }}
    />
  )
}
