import { useQuery } from "@tanstack/react-query"
import { Activity, AlertTriangle, CheckCircle2, CircleDot, Cpu, Database, Gauge, Layers3, MemoryStick, Radio, Server, Users, Workflow, XCircle } from "lucide-react"
import { api } from "../../api"

type Overview = {
  metrics: { cpu_percent: number; memory_used_mb: number; memory_total_mb: number; goroutines: number }
  total_tasks: number
  running_tasks: number
  completed_tasks: number
  failed_tasks: number
  profiles: number
  workspaces: number
}

type Tone = "accent" | "success" | "warning" | "danger" | "info"

const tones: Record<Tone, { icon: string; tint: string }> = {
  accent: { icon: "var(--color-accent)", tint: "var(--color-accent-tint)" },
  success: { icon: "var(--color-success)", tint: "var(--color-success-tint)" },
  warning: { icon: "var(--color-warning)", tint: "var(--color-warning-tint)" },
  danger: { icon: "var(--color-danger)", tint: "var(--color-danger-tint)" },
  info: { icon: "var(--color-info)", tint: "var(--color-accent-tint)" },
}

function StatCard({ icon: Icon, label, value, note, tone = "accent" }: { icon: typeof Activity; label: string; value: string | number; note: string; tone?: Tone }) {
  const color = tones[tone]
  return (
    <section className="aurora-stat decorative-card rounded-xl border border-[var(--color-line)] p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[.14em] text-[var(--color-ink-3)]">
          <span className="flex size-7 items-center justify-center rounded-lg" style={{ background: color.tint }}><Icon className="size-3.5" style={{ color: color.icon }} /></span>
          {label}
        </div>
        <span className="size-1.5 rounded-full" style={{ background: color.icon, boxShadow: `0 0 10px ${color.icon}` }} />
      </div>
      <p className="mt-4 font-mono text-3xl font-semibold tracking-tight text-[var(--color-ink)]">{value}</p>
      <p className="mt-1 text-[10px] text-[var(--color-ink-4)]">{note}</p>
    </section>
  )
}

function ResourceBar({ icon: Icon, label, value, detail, tone = "accent" }: { icon: typeof Cpu; label: string; value: number; detail: string; tone?: Tone }) {
  const pct = Math.max(0, Math.min(100, value))
  const color = tones[tone].icon
  return (
    <div className="rounded-lg border border-[var(--color-line)] bg-[var(--color-inset)]/45 p-3">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-xs text-[var(--color-ink-2)]"><Icon className="size-3.5" style={{ color }} />{label}</span>
        <span className="font-mono text-xs tabular-nums" style={{ color }}>{value.toFixed(1)}%</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--color-bg)]"><div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${pct}%`, background: color, boxShadow: `0 0 12px ${color}` }} /></div>
      <p className="mt-2 text-[10px] text-[var(--color-ink-4)]">{detail}</p>
    </div>
  )
}

function BreakdownRow({ icon: Icon, label, value, total, tone }: { icon: typeof CircleDot; label: string; value: number; total: number; tone: Tone }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0
  const color = tones[tone].icon
  return (
    <div className="flex items-center gap-3">
      <Icon className="size-3.5 shrink-0" style={{ color }} />
      <span className="w-20 text-xs text-[var(--color-ink-3)]">{label}</span>
      <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-[var(--color-bg)]"><div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} /></div>
      <span className="w-14 text-right font-mono text-xs tabular-nums text-[var(--color-ink-2)]">{value} <small className="text-[var(--color-ink-4)]">({pct}%)</small></span>
    </div>
  )
}

export default function OverviewPage() {
  const overview = useQuery({ queryKey: ["overview"], queryFn: () => api<Overview>("/api/overview"), refetchInterval: 5000 })
  const data = overview.data

  if (overview.isLoading) return <div className="flex h-full items-center justify-center text-sm text-[var(--color-ink-3)]">Memuat overview…</div>
  if (overview.isError || !data) return <div className="flex h-full items-center justify-center text-sm text-[var(--color-danger)]">Gagal load overview: {(overview.error as Error)?.message}</div>

  const memoryPct = data.metrics.memory_total_mb > 0 ? (data.metrics.memory_used_mb / data.metrics.memory_total_mb) * 100 : 0
  const finished = data.completed_tasks + data.failed_tasks
  const completionRate = data.total_tasks > 0 ? Math.round((data.completed_tasks / data.total_tasks) * 100) : 0
  const failureRate = data.total_tasks > 0 ? Math.round((data.failed_tasks / data.total_tasks) * 100) : 0

  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-[var(--color-bg)] p-4 text-[var(--color-ink)] md:p-6">
      <div className="mx-auto w-full max-w-6xl">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[.18em] text-[var(--color-accent)]">Hermes Runtime</p>
            <h1 className="mt-1 text-xl font-semibold tracking-tight">Overview</h1>
            <p className="mt-1 text-xs text-[var(--color-ink-3)]">Complete runtime statistics, task health, and resource utilization.</p>
          </div>
          <span className="flex items-center gap-1.5 rounded-full border border-[var(--color-success)]/25 bg-[var(--color-success-tint)] px-2.5 py-1 font-mono text-[10px] text-[var(--color-success)]"><i className="size-1.5 animate-pulse rounded-full bg-current" /> live · 5s</span>
        </header>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard icon={Layers3} label="Total tasks" value={data.total_tasks} note="Across all Kanban boards" />
          <StatCard icon={Activity} label="Running" value={data.running_tasks} note="Tasks currently executing" tone="info" />
          <StatCard icon={CheckCircle2} label="Completed" value={data.completed_tasks} note={`${completionRate}% of all tasks`} tone="success" />
          <StatCard icon={XCircle} label="Failed" value={data.failed_tasks} note={`${failureRate}% of all tasks`} tone="danger" />
        </div>

        <div className="mt-3 grid gap-3 lg:grid-cols-[1.15fr_.85fr]">
          <section className="decorative-card rounded-xl border border-[var(--color-line)] p-4">
            <div className="flex items-start justify-between gap-3"><div><p className="font-mono text-[10px] uppercase tracking-[.14em] text-[var(--color-accent)]">System health</p><h2 className="mt-1 text-sm font-semibold">Resource utilization</h2></div><Gauge className="size-4 text-[var(--color-accent)]" /></div>
            <div className="mt-5 space-y-3"><ResourceBar icon={Cpu} label="CPU load" value={data.metrics.cpu_percent} detail={`${data.metrics.goroutines} active Go runtime goroutines`} /><ResourceBar icon={MemoryStick} label="Memory" value={memoryPct} detail={`${data.metrics.memory_used_mb} MB used of ${data.metrics.memory_total_mb} MB`} tone={memoryPct > 80 ? "danger" : memoryPct > 60 ? "warning" : "accent"} /></div>
            <div className="mt-4 grid grid-cols-2 gap-2"><div className="rounded-lg border border-[var(--color-line)] bg-[var(--color-inset)]/45 p-3"><p className="text-[10px] uppercase tracking-wider text-[var(--color-ink-4)]">Goroutines</p><p className="mt-1 font-mono text-lg text-[var(--color-ink)]">{data.metrics.goroutines}</p></div><div className="rounded-lg border border-[var(--color-line)] bg-[var(--color-inset)]/45 p-3"><p className="text-[10px] uppercase tracking-wider text-[var(--color-ink-4)]">Finished</p><p className="mt-1 font-mono text-lg text-[var(--color-ink)]">{finished}</p></div></div>
          </section>

          <section className="decorative-card rounded-xl border border-[var(--color-line)] p-4">
            <div className="flex items-start justify-between gap-3"><div><p className="font-mono text-[10px] uppercase tracking-[.14em] text-[var(--color-accent)]">Task health</p><h2 className="mt-1 text-sm font-semibold">Status distribution</h2></div><Workflow className="size-4 text-[var(--color-accent)]" /></div>
            <div className="mt-6 space-y-5"><BreakdownRow icon={CircleDot} label="Todo / ready" value={Math.max(0, data.total_tasks - finished - data.running_tasks)} total={data.total_tasks} tone="accent" /><BreakdownRow icon={Activity} label="Running" value={data.running_tasks} total={data.total_tasks} tone="info" /><BreakdownRow icon={CheckCircle2} label="Completed" value={data.completed_tasks} total={data.total_tasks} tone="success" /><BreakdownRow icon={AlertTriangle} label="Failed" value={data.failed_tasks} total={data.total_tasks} tone="danger" /></div>
            <div className="mt-6 rounded-lg border border-[var(--color-line)] bg-[var(--color-inset)]/45 p-3"><div className="flex items-center justify-between text-xs"><span className="text-[var(--color-ink-3)]">Completion rate</span><b className="font-mono text-[var(--color-success)]">{completionRate}%</b></div><div className="mt-2 h-1.5 rounded-full bg-[var(--color-bg)]"><div className="h-full rounded-full bg-[var(--color-success)]" style={{ width: `${completionRate}%` }} /></div></div>
          </section>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <StatCard icon={Users} label="Agent profiles" value={data.profiles} note="Configured execution profiles" tone="accent" />
          <StatCard icon={Server} label="Workspaces" value={data.workspaces} note="Connected execution targets" tone="info" />
          <StatCard icon={Database} label="Runtime mode" value="Activity" note="Live task telemetry" tone="success" />
        </div>

        <footer className="mt-4 flex items-center gap-2 text-[10px] text-[var(--color-ink-4)]"><Radio className="size-3.5 text-[var(--color-accent)]" />Live data from Hermes API · refresh interval 5 seconds</footer>
      </div>
    </div>
  )
}
