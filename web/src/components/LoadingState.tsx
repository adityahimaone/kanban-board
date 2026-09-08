type LoadingVariant = "board" | "detail" | "page"

function ShimmerBar({ className = "" }: { className?: string }) {
  return <span className={`signal-skeleton ${className}`} aria-hidden="true" />
}

function BoardLoading() {
  return (
    <div className="flex min-h-0 flex-1 gap-3 overflow-hidden p-3" aria-hidden="true">
      {["w-72", "w-72", "w-72", "w-60"].map((width, column) => (
        <section key={column} className={`flex h-full ${width} shrink-0 flex-col rounded-xl border border-[var(--color-line)]/60 bg-[var(--color-surface)]/40 p-2`}>
          <div className="flex items-center justify-between border-b border-[var(--color-line)]/60 px-2 py-2">
            <ShimmerBar className="h-2.5 w-20" />
            <ShimmerBar className="h-4 w-5" />
          </div>
          <div className="space-y-2 py-2">
            {[0, 1, 2].slice(0, column === 3 ? 2 : 3).map((card) => (
              <div key={card} className="rounded-lg border border-[var(--color-line)]/60 bg-[var(--color-bg)]/60 p-3.5">
                <ShimmerBar className="h-3.5 w-4/5" />
                <ShimmerBar className="mt-2 h-2.5 w-full" />
                <ShimmerBar className="mt-1.5 h-2.5 w-3/5" />
                <div className="mt-3 flex justify-between"><ShimmerBar className="h-5 w-20" /><ShimmerBar className="h-2.5 w-8" /></div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

function DetailLoading() {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-4" aria-hidden="true">
      <div className="flex items-center gap-3"><ShimmerBar className="h-8 w-20" /><ShimmerBar className="h-4 w-64" /></div>
      <div className="mt-3 rounded-lg border border-[var(--color-line)] bg-[var(--color-bg)] p-3">
        <ShimmerBar className="h-3 w-56" /><ShimmerBar className="mt-4 h-8 w-40" />
        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2"><ShimmerBar className="h-16 w-full" /><ShimmerBar className="h-16 w-full" /></div>
        <ShimmerBar className="mt-3 h-20 w-full" /><ShimmerBar className="mt-3 h-28 w-full" />
      </div>
    </div>
  )
}

function PageLoading() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 p-4" aria-hidden="true">
      <div className="flex items-center justify-between"><ShimmerBar className="h-5 w-32" /><ShimmerBar className="h-8 w-48" /></div>
      <ShimmerBar className="h-3 w-72" />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2"><ShimmerBar className="h-36 w-full" /><ShimmerBar className="h-36 w-full" /><ShimmerBar className="h-36 w-full" /><ShimmerBar className="h-36 w-full" /></div>
    </div>
  )
}

export default function LoadingState({ variant = "page", label = "Memuat data" }: { variant?: LoadingVariant; label?: string }) {
  return (
    <div className="signal-loading relative flex min-h-0 flex-1 flex-col overflow-hidden" role="status" aria-label={label}>
      <div className="signal-loading__line" aria-hidden="true" />
      <span className="sr-only">{label}…</span>
      {variant === "board" ? <BoardLoading /> : variant === "detail" ? <DetailLoading /> : <PageLoading />}
    </div>
  )
}
