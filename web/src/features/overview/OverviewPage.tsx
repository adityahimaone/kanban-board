import { useQuery } from "@tanstack/react-query"
import { Activity, CheckCircle2, Cpu, Database, Gauge, Layers3, MemoryStick, Radio, Server, Users, Workflow, XCircle } from "lucide-react"
import { LabelList, Pie, PieChart } from "recharts"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
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

const STATUS_COLORS = ["var(--color-accent)", "var(--color-info)", "var(--color-success)", "var(--color-danger)"]
const STATUS_LABELS = ["Todo / ready", "Running", "Completed", "Failed"]

function statusRows(data: Overview) {
  const finished = data.completed_tasks + data.failed_tasks
  return [
    { category: STATUS_LABELS[0], value: Math.max(0, data.total_tasks - finished - data.running_tasks), fill: STATUS_COLORS[0] },
    { category: STATUS_LABELS[1], value: data.running_tasks, fill: STATUS_COLORS[1] },
    { category: STATUS_LABELS[2], value: data.completed_tasks, fill: STATUS_COLORS[2] },
    { category: STATUS_LABELS[3], value: data.failed_tasks, fill: STATUS_COLORS[3] },
  ]
}

function TaskHealthChart({ data }: { data: Overview }) {
  const rows = statusRows(data)
  return (
    <div className="grid items-center gap-4 sm:grid-cols-[minmax(180px,1fr)_minmax(150px,.8fr)]">
      <div className="h-64 min-w-0">
        <PieChart width={260} height={250} className="mx-auto max-w-full">
          <Pie data={rows} dataKey="value" nameKey="category" innerRadius={62} outerRadius="84%" cornerRadius={5} paddingAngle={2} stroke="var(--color-surface)" strokeWidth={4}>
            <LabelList dataKey="value" position="inside" className="fill-background text-xs font-semibold" stroke="none" formatter={(value) => Number(value) > 0 ? value : ""} />
          </Pie>
        </PieChart>
      </div>
      <div className="space-y-3">
        {rows.map((row) => {
          const pct = data.total_tasks > 0 ? Math.round((row.value / data.total_tasks) * 100) : 0
          return <div key={row.category} className="flex items-center justify-between gap-3 text-xs"><span className="flex min-w-0 items-center gap-2 text-[var(--color-ink-3)]"><i className="size-2 rounded-full" style={{ background: row.fill, boxShadow: `0 0 8px ${row.fill}` }} />{row.category}</span><span className="font-mono tabular-nums text-[var(--color-ink-2)]">{row.value} <small className="text-[var(--color-ink-4)]">({pct}%)</small></span></div>
        })}
      </div>
    </div>
  )
}

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
    <Card className="aurora-stat decorative-card rounded-xl border-[var(--color-line)]">
      <CardHeader className="p-4 pb-0">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[.14em] text-[var(--color-ink-3)]">
            <span className="flex size-7 items-center justify-center rounded-lg" style={{ background: color.tint }}><Icon className="size-3.5" style={{ color: color.icon }} /></span>
            {label}
          </div>
          <span className="size-1.5 rounded-full" style={{ background: color.icon, boxShadow: `0 0 10px ${color.icon}` }} />
        </div>
      </CardHeader>
      <CardContent className="p-4"><p className="font-mono text-3xl font-semibold tracking-tight text-[var(--color-ink)]">{value}</p></CardContent>
      <CardFooter className="p-4 pt-0 text-[10px] text-[var(--color-ink-4)]">{note}</CardFooter>
    </Card>
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
            <TaskHealthChart data={data} />
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
