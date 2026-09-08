import { useMemo } from "react"
import { Activity, Cpu, Database, MemoryStick, TriangleAlert } from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { api } from "../../api"

type FlowLink = { source: string; target: string; value: number }
type Overview = { metrics: { cpu_percent: number; memory_used_mb: number; memory_total_mb: number; goroutines: number }; total_tasks: number; running_tasks: number; completed_tasks: number; failed_tasks: number; profiles: number; workspaces: number; usage_mode: string; usage_note: string; flows: FlowLink[] }

const NODE_COLORS = ["var(--color-accent)", "var(--color-success)", "var(--color-warning)", "var(--color-accent)", "var(--color-warning)", "var(--color-info)", "var(--color-danger)", "var(--color-success)"]

function Metric({ icon: Icon, label, value, note, tone = "var(--color-accent)" }: { icon: typeof Cpu; label: string; value: string; note: string; tone?: string }) {
  return <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-4"><div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-[var(--color-ink-3)]"><Icon className="size-3.5" style={{ color: tone }} />{label}</div><p className="mt-3 font-mono text-2xl font-semibold tabular-nums text-[var(--color-ink)]">{value}</p><p className="mt-1 text-[10px] text-[var(--color-ink-4)]">{note}</p></div>
}

function UsageGauge({ icon: Icon, label, value, note, tone }: { icon: typeof Cpu; label: string; value: number; note: string; tone: string }) {
  const pct = Math.max(0, Math.min(100, value))
  const color = pct > 80 ? "var(--color-danger)" : pct > 50 ? "var(--color-warning)" : tone
  return <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-4"><div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-[var(--color-ink-3)]"><Icon className="size-3.5" style={{ color }} />{label}</div><div className="relative mx-auto mt-2 h-24 max-w-[180px]"><svg viewBox="0 0 110 64" className="h-full w-full" role="img" aria-label={`${label} ${pct.toFixed(1)} percent`}><path d="M13 54 A42 42 0 0 1 97 54" fill="none" stroke="var(--color-bg)" strokeWidth="9" strokeLinecap="round" pathLength="100" /><path d="M13 54 A42 42 0 0 1 97 54" fill="none" stroke={color} strokeWidth="9" strokeLinecap="round" pathLength="100" strokeDasharray={`${pct} ${100 - pct}`} /><circle cx="13" cy="54" r="2" fill="var(--color-ink-4)" /><circle cx="97" cy="54" r="2" fill="var(--color-ink-4)" /></svg><strong className="absolute inset-x-0 bottom-0 text-center font-mono text-2xl tabular-nums text-[var(--color-ink)]">{pct.toFixed(1)}%</strong></div><p className="mt-1 truncate text-center text-[10px] text-[var(--color-ink-4)]">{note}</p></div>
}

function SankeyCard({ links, mode, note }: { links: FlowLink[]; mode: string; note: string }) {
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
    for (const l of agg.values()) { seen.add(l.source); seen.add(l.target) }
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
    const H = 200, nodeW = 12, gap = 8, pad = 4
    const colX = [8, 96, 184]
    // single global unit scale keeps node heights comparable across columns
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
    // stack ribbons along each node side, ordered by the opposite endpoint
    const outOff = new Map<string, number>(), inOff = new Map<string, number>()
    const ordered = [...agg.values()].sort((a, b) => (layout.get(a.source)?.y ?? 0) - (layout.get(b.source)?.y ?? 0) || (layout.get(a.target)?.y ?? 0) - (layout.get(b.target)?.y ?? 0))
    for (const l of ordered) {
      const s = layout.get(l.source), t = layout.get(l.target)
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
  return <section className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-4"><div className="flex items-center justify-between"><div><h2 className="text-sm font-semibold">Model / provider activity</h2><p className="mt-1 text-[10px] text-[var(--color-ink-4)]">Task flow through Hermes profiles to providers and models.</p></div><span className="rounded border border-[var(--color-line)] px-2 py-1 font-mono text-[9px] text-[var(--color-ink-3)]">{mode}</span></div>
    {totalFlow === 0 ? <div className="mt-6 rounded-lg border border-dashed border-[var(--color-line)] px-3 py-10 text-center font-mono text-[11px] text-[var(--color-ink-4)]">no task activity yet</div> : <div className="mt-4"><div className="grid grid-cols-[1fr_1.1fr_1.2fr] gap-2 pb-1 text-center font-mono text-[9px] uppercase tracking-wider text-[var(--color-ink-4)]"><span>Source</span><span>Profile</span><span>Provider / model</span></div><svg viewBox={`0 0 204 ${sankey.H}`} className="h-52 w-full" role="img" aria-label="Task activity sankey">{sankey.links.map((l) => { const s = sankey.layout.get(l.source), t = sankey.layout.get(l.target); if (!s || !t || l.sy === undefined || l.ty === undefined || l.th === undefined) return null; const x1 = s.x + sankey.nodeW, x2 = t.x, mx = (x1 + x2) / 2, color = sankey.colorOf.get(l.source); return <g key={`${l.source}-${l.target}`}><title>{`${l.source} → ${l.target}: ${l.value} tasks`}</title><path d={`M${x1},${l.sy} C${mx},${l.sy} ${mx},${l.ty} ${x2},${l.ty} L${x2},${l.ty + l.th} C${mx},${l.ty + l.th} ${mx},${l.sy + l.th} ${x1},${l.sy + l.th} Z`} fill={color} opacity=".32" /><path d={`M${x1},${l.sy + l.th / 2} C${mx},${l.sy + l.th / 2} ${mx},${l.ty + l.th / 2} ${x2},${l.ty + l.th / 2}`} fill="none" stroke={color} strokeOpacity=".85" strokeWidth=".8" /></g> })}{sankey.cols.map((col) => col.map((n) => { const p = sankey.layout.get(n); if (!p) return null; return <g key={n}><rect x={p.x} y={p.y} width={sankey.nodeW} height={p.h} rx="2.5" fill={sankey.colorOf.get(n)}><title>{`${n}: ${sankey.weight(n)} tasks`}</title></rect></g> }))}</svg><div className="mt-2 grid grid-cols-3 gap-2">{sankey.cols.map((col, c) => <div key={c} className="space-y-1">{col.map((n) => <div key={n} className="flex items-center gap-1.5 font-mono text-[9px]"><i className="size-1.5 shrink-0 rounded-full" style={{ background: sankey.colorOf.get(n) }} /><span className="min-w-0 flex-1 truncate text-[var(--color-ink-3)]" title={n}>{n}</span><b className="text-[var(--color-ink)]">{sankey.weight(n)}</b></div>)}</div>)}</div></div>}<p className="mt-3 text-[10px] text-[var(--color-ink-4)]">{note}</p></section>
}

export default function OverviewPage() {
  const overview = useQuery({ queryKey: ["overview"], queryFn: () => api<Overview>("/api/overview"), refetchInterval: 5000 })
  const data = overview.data
  if (overview.isLoading) return <div className="flex h-full items-center justify-center text-sm text-[var(--color-ink-3)]">Memuat overview…</div>
  if (overview.isError || !data) return <div className="flex h-full items-center justify-center text-sm text-[var(--color-danger)]">Gagal load overview: {(overview.error as Error)?.message}</div>
  const memory = data.metrics.memory_total_mb ? Math.round((data.metrics.memory_used_mb / data.metrics.memory_total_mb) * 100) : 0
  return <div className="min-h-0 flex-1 overflow-y-auto bg-[var(--color-bg)] p-4 text-[var(--color-ink)] md:p-6"><div className="mx-auto max-w-7xl"><div className="flex items-end justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[.18em] text-[var(--color-accent)]">Hermes Runtime</p><h1 className="mt-1 text-xl font-semibold tracking-tight">Overview</h1><p className="mt-1 text-xs text-[var(--color-ink-3)]">Live system health, task throughput, and model activity.</p></div><span className="flex items-center gap-1.5 font-mono text-[10px] text-emerald-300"><i className="size-1.5 rounded-full bg-current" /> live · 5s</span></div>
    <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><UsageGauge icon={Cpu} label="CPU usage" value={data.metrics.cpu_percent} note={`${data.metrics.goroutines} goroutines · live host load`} tone="var(--color-accent)" /><UsageGauge icon={MemoryStick} label="Memory" value={memory} note={`${data.metrics.memory_used_mb} / ${data.metrics.memory_total_mb} MB`} tone="var(--color-accent)" /><Metric icon={Activity} label="Running tasks" value={String(data.running_tasks)} note={`${data.total_tasks} total tasks`} tone="var(--color-success)" /><Metric icon={TriangleAlert} label="Failed tasks" value={String(data.failed_tasks)} note={`${data.completed_tasks} completed`} tone="var(--color-danger)" /></div>
    <div className="mt-3 grid gap-3 lg:grid-cols-[1.35fr_.65fr]"><SankeyCard links={data.flows} mode={data.usage_mode} note={data.usage_note} /><section className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-4"><h2 className="text-sm font-semibold">Runtime snapshot</h2><div className="mt-4 space-y-3 text-xs"><div className="flex justify-between border-b border-[var(--color-line)] pb-3"><span className="text-[var(--color-ink-3)]">Profiles</span><b>{data.profiles}</b></div><div className="flex justify-between border-b border-[var(--color-line)] pb-3"><span className="text-[var(--color-ink-3)]">Workspaces</span><b>{data.workspaces}</b></div><div><div className="mb-1 flex justify-between text-[10px] text-[var(--color-ink-3)]"><span>Memory pressure</span><span>{memory}%</span></div><div className="h-1.5 rounded bg-[var(--color-bg)]"><div className="h-full rounded bg-[var(--color-accent)]" style={{ width: `${Math.min(100, memory)}%` }} /></div></div></div><div className="mt-6 flex items-center gap-2 text-[10px] text-[var(--color-ink-4)]"><Database className="size-3.5" />Live data from Hermes API</div></section></div></div></div>
}
