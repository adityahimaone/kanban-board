import { useMemo } from "react"
import { Activity, Cpu, Database, MemoryStick, TriangleAlert, Sparkles } from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { api } from "../../api"
import { SectionCard, SignalStamp, StatusPill } from "@/components/switchyard"

type FlowLink = { source: string; target: string; value: number }
type Overview = {
  metrics: { cpu_percent: number; memory_used_mb: number; memory_total_mb: number; goroutines: number }
  total_tasks: number
  running_tasks: number
  completed_tasks: number
  failed_tasks: number
  profiles: number
  workspaces: number
  usage_mode: string
  usage_note: string
  flows: FlowLink[]
}

const NODE_COLORS = ["#6be6d9", "#a89cff", "#f1b65a", "#72d79a", "#7cc0f5", "#ff8d9a", "#c9ccc2", "#6be6d9"]

function UsageGauge({
  icon: Icon,
  label,
  value,
  note,
  tone,
}: {
  icon: typeof Cpu
  label: string
  value: number
  note: string
  tone: string
}) {
  const pct = Math.max(0, Math.min(100, value))
  const color = pct > 80 ? "#ff8d9a" : pct > 55 ? "#f1b65a" : tone
  const track = "var(--color-inset)"
  return (
    <SectionCard className="flex flex-col">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[.14em] text-ink-3">
        <Icon className="size-3.5" style={{ color }} />
        {label}
        <span className="ml-auto rounded-full border border-line bg-surface-raised px-2 py-0.5 font-mono text-[9px] text-ink-3">
          live
        </span>
      </div>
      <div className="relative mx-auto mt-4 h-28 w-full max-w-[200px]">
        <svg viewBox="0 0 120 68" className="h-full w-full" role="img" aria-label={`${label} ${pct.toFixed(1)} percent`}>
          <path d="M14 58 A44 44 0 0 1 106 58" fill="none" stroke={track} strokeWidth="10" strokeLinecap="round" pathLength="100" opacity="0.95" />
          <path
            d="M14 58 A44 44 0 0 1 106 58"
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeLinecap="round"
            pathLength="100"
            strokeDasharray={`${pct} ${100 - pct}`}
            style={{ filter: `drop-shadow(0 0 10px ${color}33)` }}
          />
          <circle cx="14" cy="58" r="2.2" fill="var(--color-ink-4)" />
          <circle cx="106" cy="58" r="2.2" fill="var(--color-ink-4)" />
        </svg>
        <div className="absolute inset-x-0 bottom-1 text-center">
          <strong className="font-mono text-2xl font-semibold tabular-nums tracking-tight text-ink">{pct.toFixed(1)}%</strong>
          <span className="ml-1 font-mono text-[10px] text-ink-4">used</span>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 border-t border-line pt-3">
        <p className="truncate font-mono text-[10px] text-ink-4">{note}</p>
        <span className="shrink-0 font-mono text-[10px] tabular-nums" style={{ color }}>
          {pct > 80 ? "high" : pct > 55 ? "warm" : "steady"}
        </span>
      </div>
    </SectionCard>
  )
}

function MetricStat({
  icon: Icon,
  label,
  value,
  note,
  tone,
}: {
  icon: typeof Cpu
  label: string
  value: string
  note: string
  tone?: string
}) {
  return (
    <SectionCard>
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[.14em] text-ink-3">
        <Icon className="size-3.5" style={{ color: tone ?? "var(--color-ink-3)" }} />
        {label}
      </div>
      <p className="mt-4 font-mono text-2xl font-semibold tabular-nums tracking-tight text-ink">{value}</p>
      <p className="mt-1 flex items-center gap-1.5 font-mono text-[10px] text-ink-4">
        <span className="size-1 rounded-full" style={{ background: tone ?? "var(--color-line-strong)" }} />
        {note}
      </p>
    </SectionCard>
  )
}

function SankeyCard({ links, mode }: { links: FlowLink[]; mode: string }) {
  const sankey = useMemo(() => {
    const agg = new Map<string, FlowLink>()
    for (const l of links) {
      const key = `${l.source}\u0000${l.target}`
      const cur = agg.get(key)
      if (cur) cur.value += l.value
      else agg.set(key, { source: l.source, target: l.target, value: l.value })
    }
    const outSum = new Map<string, number>()
    const inSum = new Map<string, number>()
    for (const l of agg.values()) {
      outSum.set(l.source, (outSum.get(l.source) ?? 0) + l.value)
      inSum.set(l.target, (inSum.get(l.target) ?? 0) + l.value)
    }
    const cols: string[][] = [[], [], []]
    const seen = new Set<string>()
    for (const l of agg.values()) {
      seen.add(l.source)
      seen.add(l.target)
    }
    for (const n of seen) {
      if (outSum.has(n) && inSum.has(n)) cols[1].push(n)
      else if (outSum.has(n)) cols[0].push(n)
      else cols[2].push(n)
    }
    const weight = (n: string) => Math.max(outSum.get(n) ?? 0, inSum.get(n) ?? 0)
    for (const col of cols) col.sort((a, b) => weight(b) - weight(a))
    const colorOf = new Map<string, string>()
    let ci = 0
    for (const col of cols) for (const n of col) colorOf.set(n, NODE_COLORS[ci++ % NODE_COLORS.length])
    const H = 208
    const nodeW = 11
    const gap = 10
    const pad = 6
    const colX = [10, 98, 186]
    let unit = Infinity
    for (let c = 0; c < 3; c++) {
      const total = cols[c].reduce((s, n) => s + weight(n), 0)
      if (total) unit = Math.min(unit, (H - 2 * pad - gap * (cols[c].length - 1)) / total)
    }
    if (!isFinite(unit)) unit = 0
    const layout = new Map<string, { x: number; y: number; h: number }>()
    for (let c = 0; c < 3; c++) {
      let y = pad
      for (const n of cols[c]) {
        const h = Math.max(4, weight(n) * unit)
        layout.set(n, { x: colX[c], y, h })
        y += h + gap
      }
    }
    const outOff = new Map<string, number>()
    const inOff = new Map<string, number>()
    const ordered = [...agg.values()].sort(
      (a, b) => (layout.get(a.source)?.y ?? 0) - (layout.get(b.source)?.y ?? 0) || (layout.get(a.target)?.y ?? 0) - (layout.get(b.target)?.y ?? 0),
    )
    for (const l of ordered) {
      const s = layout.get(l.source)
      const t = layout.get(l.target)
      if (!s || !t) continue
      const th = Math.max(1.5, l.value * unit)
      const sy = s.y + (outOff.get(l.source) ?? 0)
      const ty = t.y + (inOff.get(l.target) ?? 0)
      outOff.set(l.source, (outOff.get(l.source) ?? 0) + th)
      inOff.set(l.target, (inOff.get(l.target) ?? 0) + th)
      ;(l as FlowLink & { sy?: number; ty?: number; th?: number }).sy = sy
      ;(l as FlowLink & { sy?: number; ty?: number; th?: number }).ty = ty
      ;(l as FlowLink & { sy?: number; ty?: number; th?: number }).th = th
    }
    return { links: ordered as (FlowLink & { sy?: number; ty?: number; th?: number })[], weight, colorOf, layout, H, nodeW, cols }
  }, [links])
  const totalFlow = sankey.links.reduce((s, l) => s + l.value, 0)
  return (
    <SectionCard
      title="Model / provider activity"
      description="Task flow through Hermes profiles to providers and models."
      actions={<StatusPill tone="neutral">{mode}</StatusPill>}
    >
      {totalFlow === 0 ? (
        <div className="rounded-lg border border-dashed border-line bg-inset/40 px-3 py-10 text-center font-mono text-[11px] text-ink-4">no task activity yet</div>
      ) : (
        <div>
          <div className="grid grid-cols-[1fr_1.1fr_1.2fr] gap-2 pb-2 text-center font-mono text-[9px] uppercase tracking-[.14em] text-ink-4">
            <span>Source</span>
            <span>Profile</span>
            <span>Provider / model</span>
          </div>
          <div className="rounded-lg border border-line bg-inset/30 p-2">
            <svg viewBox={`0 0 208 ${sankey.H}`} className="h-52 w-full" role="img" aria-label="Task activity sankey">
              {sankey.links.map((l) => {
                const s = sankey.layout.get(l.source)
                const t = sankey.layout.get(l.target)
                if (!s || !t || l.sy === undefined || l.ty === undefined || l.th === undefined) return null
                const x1 = s.x + sankey.nodeW
                const x2 = t.x
                const mx = (x1 + x2) / 2
                const color = sankey.colorOf.get(l.source)
                return (
                  <g key={`${l.source}-${l.target}`}>
                    <title>{`${l.source} → ${l.target}: ${l.value} tasks`}</title>
                    <path
                      d={`M${x1},${l.sy} C${mx},${l.sy} ${mx},${l.ty} ${x2},${l.ty} L${x2},${l.ty + l.th} C${mx},${l.ty + l.th} ${mx},${l.sy + l.th} ${x1},${l.sy + l.th} Z`}
                      fill={color}
                      opacity=".18"
                    />
                    <path
                      d={`M${x1},${l.sy + l.th / 2} C${mx},${l.sy + l.th / 2} ${mx},${l.ty + l.th / 2} ${x2},${l.ty + l.th / 2}`}
                      fill="none"
                      stroke={color}
                      strokeOpacity=".9"
                      strokeWidth=".9"
                    />
                  </g>
                )
              })}
              {sankey.cols.map((col) =>
                col.map((n) => {
                  const p = sankey.layout.get(n)
                  if (!p) return null
                  return (
                    <g key={n}>
                      <rect x={p.x} y={p.y} width={sankey.nodeW} height={p.h} rx="2.5" fill={sankey.colorOf.get(n)}>
                        <title>{`${n}: ${sankey.weight(n)} tasks`}</title>
                      </rect>
                    </g>
                  )
                }),
              )}
            </svg>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {sankey.cols.map((col, c) => (
              <div key={c} className="space-y-1">
                {col.map((n) => (
                  <div key={n} className="flex items-center gap-1.5 font-mono text-[9px]">
                    <i className="size-1.5 shrink-0 rounded-full" style={{ background: sankey.colorOf.get(n) }} />
                    <span className="min-w-0 flex-1 truncate text-ink-3" title={n}>
                      {n}
                    </span>
                    <b className="text-ink">{sankey.weight(n)}</b>
                  </div>
                ))}
              </div>
            ))}
          </div>
          <p className="mt-3 border-t border-line pt-2 font-mono text-[10px] text-ink-4">{totalFlow} total routed tasks · ribbons use a single global scale</p>
        </div>
      )}
    </SectionCard>
  )
}

export default function OverviewPage() {
  const overview = useQuery({ queryKey: ["overview"], queryFn: () => api<Overview>("/api/overview"), refetchInterval: 5000 })
  const data = overview.data
  if (overview.isLoading) return <div className="flex h-full items-center justify-center bg-bg p-6 text-sm text-ink-3">Memuat overview…</div>
  if (overview.isError || !data)
    return <div className="flex h-full items-center justify-center bg-bg p-6 text-sm text-rose">Gagal load overview: {(overview.error as Error)?.message}</div>
  const memory = data.metrics.memory_total_mb ? Math.round((data.metrics.memory_used_mb / data.metrics.memory_total_mb) * 100) : 0
  const needsAttention = data.failed_tasks > 0 || data.running_tasks > 6

  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-bg p-4 text-ink md:p-6">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[.18em] text-accent">Hermes Runtime</p>
            <h1 className="mt-1 text-[22px] font-semibold tracking-tight text-ink">Overview</h1>
            <p className="mt-1 max-w-[52ch] text-xs leading-5 text-ink-3">Live system health, task throughput, and model activity. One Signal Stamp marks what needs attention — everything else stays quiet.</p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 font-mono text-[10px] text-ink-3">
            <i className="size-1.5 rounded-full bg-green animate-pulse" /> live · 5s
          </span>
        </div>

        {needsAttention && (
          <SignalStamp compact className="mt-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="flex size-7 items-center justify-center rounded-full bg-ink text-bg">
                  <Sparkles className="size-3.5" />
                </span>
                <div>
                  <p className="text-sm font-semibold tracking-tight text-ink">What needs attention</p>
                  <p className="mt-0.5 font-mono text-[11px] text-ink-3">
                    {data.failed_tasks > 0 ? `${data.failed_tasks} failed tasks need review` : `${data.running_tasks} running — queue is warm`} · {data.total_tasks} total · {data.completed_tasks} completed
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <StatusPill tone={data.failed_tasks > 0 ? "rose" : "amber"} dot>
                  {data.failed_tasks > 0 ? "review" : "active"}
                </StatusPill>
                <span className="font-mono text-[10px] text-ink-4">{data.profiles} profiles · {data.workspaces} workspaces</span>
              </div>
            </div>
          </SignalStamp>
        )}

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <UsageGauge icon={Cpu} label="CPU usage" value={data.metrics.cpu_percent} note={`${data.metrics.goroutines} goroutines · live host load`} tone="var(--color-accent)" />
          <UsageGauge icon={MemoryStick} label="Memory" value={memory} note={`${data.metrics.memory_used_mb} / ${data.metrics.memory_total_mb} MB`} tone="var(--color-lavender)" />
          <MetricStat icon={Activity} label="Running" value={String(data.running_tasks)} note={`${data.total_tasks} total tasks`} tone="var(--color-green)" />
          <MetricStat icon={TriangleAlert} label="Failed" value={String(data.failed_tasks)} note={`${data.completed_tasks} completed`} tone="var(--color-rose)" />
        </div>

        <div className="mt-3 grid gap-3 lg:grid-cols-[1.38fr_.62fr]">
          <SankeyCard links={data.flows} mode={data.usage_mode} />
          <SectionCard title="Runtime snapshot" description="Profiles, workspaces, and memory pressure.">
            <div className="space-y-0 divide-y divide-line">
              <div className="flex justify-between py-3 text-xs">
                <span className="text-ink-3">Profiles</span>
                <b className="font-mono tabular-nums text-ink">{data.profiles}</b>
              </div>
              <div className="flex justify-between py-3 text-xs">
                <span className="text-ink-3">Workspaces</span>
                <b className="font-mono tabular-nums text-ink">{data.workspaces}</b>
              </div>
              <div className="py-3">
                <div className="mb-1.5 flex justify-between font-mono text-[10px] text-ink-3">
                  <span>Memory pressure</span>
                  <span className="tabular-nums text-ink">{memory}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-inset p-0.5">
                  <div className="h-full rounded-full bg-lavender transition-all" style={{ width: `${Math.min(100, memory)}%` }} />
                </div>
                <p className="mt-1.5 font-mono text-[10px] text-ink-4">Same scale language as the gauges above — no second visual system.</p>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2 border-t border-line pt-3 font-mono text-[10px] text-ink-4">
              <Database className="size-3.5" />
              Live data from Hermes API · {data.usage_note}
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  )
}
