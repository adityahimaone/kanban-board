import { useMemo } from "react"
import { Activity, Cpu, Database, MemoryStick, TriangleAlert } from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { api } from "../../api"

type FlowLink = { source: string; target: string; value: number }
type Overview = { metrics: { cpu_percent: number; memory_used_mb: number; memory_total_mb: number; goroutines: number }; total_tasks: number; running_tasks: number; completed_tasks: number; failed_tasks: number; profiles: number; workspaces: number; usage_mode: string; usage_note: string; flows: FlowLink[] }

const NODE_COLORS = ["#10e0dd", "#8fd14f", "#f2c94c", "#a78bfa", "#f09a2f", "#38bdf8", "#ec4899", "#57d18d"]

function Metric({ icon: Icon, label, value, note, tone = "#10e0dd" }: { icon: typeof Cpu; label: string; value: string; note: string; tone?: string }) {
  return <div className="rounded-xl border border-[#1e2430] bg-[#11151f] p-4"><div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-[#8b93a7]"><Icon className="size-3.5" style={{ color: tone }} />{label}</div><p className="mt-3 font-mono text-2xl font-semibold tabular-nums text-[#e6e9ef]">{value}</p><p className="mt-1 text-[10px] text-[#687187]">{note}</p></div>
}

function CpuGauge({ value, goroutines }: { value: number; goroutines: number }) {
  const pct = Math.max(0, Math.min(100, value))
  return <div className="rounded-xl border border-[#1e2430] bg-[#11151f] p-4"><div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-[#8b93a7]"><Cpu className="size-3.5 text-[#10e0dd]" />CPU usage</div><div className="relative mt-2 h-24"><svg viewBox="0 0 110 64" className="h-full w-full" role="img" aria-label={`CPU usage ${pct.toFixed(1)} percent`}><path d="M13 54 A42 42 0 0 1 97 54" fill="none" stroke="#0b0e14" strokeWidth="9" strokeLinecap="round" pathLength="100" /><path d="M13 54 A42 42 0 0 1 97 54" fill="none" stroke={pct > 80 ? "#ef6b73" : pct > 50 ? "#f2c94c" : "#10e0dd"} strokeWidth="9" strokeLinecap="round" pathLength="100" strokeDasharray={`${pct} ${100 - pct}`} /><circle cx="13" cy="54" r="2" fill="#687187" /><circle cx="97" cy="54" r="2" fill="#687187" /></svg><strong className="absolute inset-x-0 bottom-0 text-center font-mono text-2xl tabular-nums text-[#e6e9ef]">{pct.toFixed(1)}%</strong></div><p className="mt-1 text-[10px] text-[#687187]">{pct === 0 ? "idle / low load" : "live host load"} · {goroutines} goroutines</p></div>
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
    const H = 210
    const nodeW = 9
    const colX = [16, 104, 192]
    const layout = new Map<string, { x: number; y: number; h: number }>()
    for (let c = 0; c < 3; c++) {
      const col = cols[c]
      const total = col.reduce((s, n) => s + weight(n), 0)
      if (!total) continue
      const avail = H - 12 - 10 * (col.length - 1)
      let y = 6
      for (const n of col) {
        const h = Math.max(6, (weight(n) / total) * avail)
        layout.set(n, { x: colX[c], y, h })
        y += h + 10
      }
    }
    const maxV = Math.max(1, ...[...agg.values()].map((l) => l.value))
    return { links: [...agg.values()], weight, colorOf, layout, maxV, H, nodeW, cols }
  }, [links])
  const totalFlow = sankey.links.reduce((s, l) => s + l.value, 0)
  return <section className="rounded-xl border border-[#1e2430] bg-[#11151f] p-4"><div className="flex items-center justify-between"><div><h2 className="text-sm font-semibold">Model / provider activity</h2><p className="mt-1 text-[10px] text-[#687187]">Task flow through Hermes profiles to providers and models.</p></div><span className="rounded border border-[#1e2430] px-2 py-1 font-mono text-[9px] text-[#8b93a7]">{mode}</span></div>
    {totalFlow === 0 ? <div className="mt-6 rounded-lg border border-dashed border-[#1e2430] px-3 py-10 text-center font-mono text-[11px] text-[#687187]">no task activity yet</div> : <div className="mt-4"><svg viewBox={`0 0 210 ${sankey.H}`} className="h-56 w-full" role="img" aria-label="Task activity sankey">{sankey.links.map((l) => { const s = sankey.layout.get(l.source), t = sankey.layout.get(l.target); if (!s || !t) return null; const th = 2 + (l.value / sankey.maxV) * 12; const y1 = s.y + s.h / 2, y2 = t.y + t.h / 2, x1 = s.x + sankey.nodeW, x2 = t.x, mx = (x1 + x2) / 2; return <g key={`${l.source}-${l.target}`}><title>{`${l.source} → ${l.target}: ${l.value} tasks`}</title><path d={`M${x1},${y1 - th / 2} C${mx},${y1 - th / 2} ${mx},${y2 - th / 2} ${x2},${y2 - th / 2} L${x2},${y2 + th / 2} C${mx},${y2 + th / 2} ${mx},${y1 + th / 2} ${x1},${y1 + th / 2} Z`} fill={sankey.colorOf.get(l.source)} opacity=".4" /><path d={`M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`} fill="none" stroke={sankey.colorOf.get(l.source)} strokeOpacity=".9" strokeWidth="1.2" /></g> })}{sankey.cols.map((col, c) => col.map((n) => { const p = sankey.layout.get(n); if (!p) return null; return <g key={n}><rect x={p.x} y={p.y} width={sankey.nodeW} height={p.h} rx="3" fill={sankey.colorOf.get(n)}><title>{`${n}: ${sankey.weight(n)} tasks`}</title></rect><text x={c === 2 ? p.x - 5 : p.x + sankey.nodeW + 5} y={p.y + p.h / 2 + 2.5} textAnchor={c === 2 ? "end" : "start"} fontSize="7" className="fill-[#8b93a7] font-mono">{n} · {sankey.weight(n)}</text></g> }))}</svg><div className="mt-2 grid grid-cols-3 text-center font-mono text-[9px] uppercase tracking-wider text-[#687187]"><span>Source</span><span>Profile</span><span>Provider / model</span></div></div>}<p className="mt-3 text-[10px] text-[#687187]">{note}</p></section>
}

export default function OverviewPage() {
  const overview = useQuery({ queryKey: ["overview"], queryFn: () => api<Overview>("/api/overview"), refetchInterval: 5000 })
  const data = overview.data
  if (overview.isLoading) return <div className="flex h-full items-center justify-center text-sm text-[#8b93a7]">Memuat overview…</div>
  if (overview.isError || !data) return <div className="flex h-full items-center justify-center text-sm text-[#ef6b73]">Gagal load overview: {(overview.error as Error)?.message}</div>
  const memory = data.metrics.memory_total_mb ? Math.round((data.metrics.memory_used_mb / data.metrics.memory_total_mb) * 100) : 0
  return <div className="min-h-0 flex-1 overflow-y-auto bg-[#0b0e14] p-4 text-[#e6e9ef] md:p-6"><div className="mx-auto max-w-7xl"><div className="flex items-end justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[.18em] text-[#10e0dd]">Hermes Runtime</p><h1 className="mt-1 text-xl font-semibold tracking-tight">Overview</h1><p className="mt-1 text-xs text-[#8b93a7]">Live system health, task throughput, and model activity.</p></div><span className="flex items-center gap-1.5 font-mono text-[10px] text-emerald-300"><i className="size-1.5 rounded-full bg-current" /> live · 5s</span></div>
    <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><CpuGauge value={data.metrics.cpu_percent} goroutines={data.metrics.goroutines} /><Metric icon={MemoryStick} label="Memory" value={`${memory}%`} note={`${data.metrics.memory_used_mb} / ${data.metrics.memory_total_mb} MB`} tone="#a78bfa" /><Metric icon={Activity} label="Running tasks" value={String(data.running_tasks)} note={`${data.total_tasks} total tasks`} tone="#8fd14f" /><Metric icon={TriangleAlert} label="Failed tasks" value={String(data.failed_tasks)} note={`${data.completed_tasks} completed`} tone="#ef6b73" /></div>
    <div className="mt-3 grid gap-3 lg:grid-cols-[1.35fr_.65fr]"><SankeyCard links={data.flows} mode={data.usage_mode} note={data.usage_note} /><section className="rounded-xl border border-[#1e2430] bg-[#11151f] p-4"><h2 className="text-sm font-semibold">Runtime snapshot</h2><div className="mt-4 space-y-3 text-xs"><div className="flex justify-between border-b border-[#1e2430] pb-3"><span className="text-[#8b93a7]">Profiles</span><b>{data.profiles}</b></div><div className="flex justify-between border-b border-[#1e2430] pb-3"><span className="text-[#8b93a7]">Workspaces</span><b>{data.workspaces}</b></div><div><div className="mb-1 flex justify-between text-[10px] text-[#8b93a7]"><span>Memory pressure</span><span>{memory}%</span></div><div className="h-1.5 rounded bg-[#0b0e14]"><div className="h-full rounded bg-[#a78bfa]" style={{ width: `${Math.min(100, memory)}%` }} /></div></div></div><div className="mt-6 flex items-center gap-2 text-[10px] text-[#687187]"><Database className="size-3.5" />Live data from Hermes API</div></section></div></div></div>
}
