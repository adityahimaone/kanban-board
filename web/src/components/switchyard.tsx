import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

/* Switchyard shared primitives — a thin layer over existing shadcn tokens.
   Restricted by redesign.md § 5: consistency, not a parallel component library. */

export function PageFrame({ title, description, actions, children, className }: {
  title: string
  description?: string
  actions?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", className)}>
      <div className="flex shrink-0 flex-wrap items-end justify-between gap-3 px-6 pt-5 pb-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-ink">{title}</h1>
          {description && <p className="mt-1 text-xs text-ink-3">{description}</p>}
        </div>
        {actions}
      </div>
      {children}
    </div>
  )
}

export function SectionCard({ title, description, actions, children, className, dense }: {
  title?: string
  description?: string
  actions?: ReactNode
  children: ReactNode
  className?: string
  dense?: boolean
}) {
  return (
    <section className={cn("rounded-xl border border-line bg-surface", dense ? "p-3" : "p-4", className)}>
      {(title || actions) && (
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="min-w-0">
            {title && <h2 className="truncate text-sm font-semibold text-ink">{title}</h2>}
            {description && <p className="mt-0.5 text-[10px] text-ink-3">{description}</p>}
          </div>
          {actions && <div className="shrink-0">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  )
}

export function MetricTile({ label, value, note, tone = "var(--color-accent)", icon: Icon }: {
  label: string
  value: ReactNode
  note?: string
  tone?: string
  icon?: React.ComponentType<{ className?: string; style?: React.CSSProperties }>
}) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-ink-3">
        {Icon && <Icon className="size-3.5" style={{ color: tone }} />}
        {label}
      </div>
      <p className="mt-3 font-mono text-2xl font-semibold tabular-nums text-ink">{value}</p>
      {note && <p className="mt-1 text-[10px] text-ink-4">{note}</p>}
    </div>
  )
}

const TONES: Record<string, { fg: string; bg: string }> = {
  accent: { fg: "text-accent", bg: "bg-accent-tint" },
  lavender: { fg: "text-lavender", bg: "bg-lavender-tint" },
  amber: { fg: "text-amber", bg: "bg-amber-tint" },
  green: { fg: "text-green", bg: "bg-green-tint" },
  rose: { fg: "text-rose", bg: "bg-red-tint" },
  neutral: { fg: "text-ink-3", bg: "bg-surface-raised" },
}

export function StatusPill({ tone = "neutral", dot, children, title }: {
  tone?: keyof typeof TONES
  dot?: boolean
  children: ReactNode
  title?: string
}) {
  const t = TONES[tone] ?? TONES.neutral
  return (
    <span title={title} className={cn("inline-flex h-5.5 items-center gap-1.5 rounded-full px-2 text-[11px] font-medium", t.bg, t.fg)}>
      {dot && <i className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  )
}

/* Decorative bloom with dot texture. redesign.md: max 3 placements/viewport,
   never on task cards, flow nodes, forms, or toasts. */
export function SignalStamp({ children, className, compact }: {
  children: ReactNode
  className?: string
  compact?: boolean
}) {
  return (
    <div className={cn("relative overflow-hidden rounded-xl border border-line bg-surface", compact ? "p-4" : "p-6", className)}>
      <div aria-hidden className="signal-stamp-bloom absolute inset-0" />
      <div aria-hidden className="signal-stamp-dot absolute inset-0 opacity-60" />
      <div className="relative">{children}</div>
    </div>
  )
}

export function EmptyState({ title, hint, children }: { title: string; hint?: string; children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-line px-4 py-10 text-center">
      <p className="text-sm font-medium text-ink-2">{title}</p>
      {hint && <p className="mt-1 text-xs text-ink-4">{hint}</p>}
      {children}
    </div>
  )
}
