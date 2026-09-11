import { CheckCircle2, GitBranch, KeyRound, Terminal, Workflow, XCircle } from "lucide-react"

const sections = [
  {
    title: "Execution flow",
    icon: Workflow,
    body: "Kanban creates task row → dispatcher claims todo/ready → exact workspace route resolves → node-agent sends job to Mac → executor runs in workspace → result and events return to board.",
  },
  {
    title: "Workspace routing",
    icon: GitBranch,
    body: "Remote Mac paths must be registered as exact child workspaces with host mac-tailscale. SSH/node-agent transport prevents VPS from treating /Users paths as local directories.",
  },
  {
    title: "Executor separation",
    icon: Terminal,
    body: "Hermes runs hermes chat. Codex runs codex exec --full-auto. Shell runs bash -lc directly with optional RTK rewrite. Shell skips AI preflight and prompt context.",
  },
  {
    title: "Proof and evidence",
    icon: CheckCircle2,
    body: "Trust provenance executor, requested, bin, args, ws from node-agent result; then verify Mac worker run.log, task row, events, and final artifact. Sisyphus text alone proves nothing.",
  },
  {
    title: "Failure handling",
    icon: XCircle,
    body: "Permission denied /Users means wrong routing. blocker_auth means stale or real auth/quota state. executor_unavailable means missing binary. Exit code 3 requires raw result and artifact inspection before recovery.",
  },
  {
    title: "Security boundary",
    icon: KeyRound,
    body: "Validate profile, workspace, transport, and executor before dispatch. Keep credentials out of task bodies and reports. Browser gaps must be marked NOT VERIFIED, never fabricated as PASS.",
  },
]

const matrix = [
  ["hermes", "hermes chat -q", "CodeGraph + prerequisites"],
  ["codex", "codex exec --full-auto", "CodeGraph + prerequisites"],
  ["shell", "bash -lc", "RTK only; no AI preflight"],
  ["auto", "Hermes first; fallback", "Resolved executor decides"],
]

export default function KnowledgePage() {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-[var(--color-bg)] p-4 text-[var(--color-ink)] md:p-6">
      <div className="mx-auto w-full max-w-6xl">
        <header>
          <p className="font-mono text-[10px] uppercase tracking-[.18em] text-[var(--color-accent)]">System Knowledge</p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight">Execution Knowledge</h1>
          <p className="mt-1 max-w-3xl text-xs text-[var(--color-ink-3)]">Flow map, executor boundaries, remote routing, proof rules, and recovery paths.</p>
        </header>

        <section className="mt-5 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)]/60 p-4 font-mono text-[11px] leading-6 text-[var(--color-ink-2)]">
          <div>Kanban UI</div><div className="pl-4">↓ dispatcher + validation</div><div className="pl-4">↓ mac-tailscale / node-agent</div><div className="pl-4">↓ hermes | codex | shell</div><div className="pl-4">↓ provenance + result + events</div><div className="pl-4">↓ review → done / blocked</div>
        </section>

        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {sections.map(({ title, icon: Icon, body }) => (
            <section key={title} className="decorative-card rounded-xl border border-[var(--color-line)] p-4">
              <div className="flex items-center gap-2"><Icon className="size-4 text-[var(--color-accent)]" /><h2 className="text-sm font-semibold">{title}</h2></div>
              <p className="mt-2 text-xs leading-5 text-[var(--color-ink-3)]">{body}</p>
            </section>
          ))}
        </div>

        <section className="mt-3 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)]/60 p-4">
          <h2 className="text-sm font-semibold">Executor matrix</h2>
          <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[560px] text-left text-xs"><thead className="text-[10px] uppercase tracking-wider text-[var(--color-ink-3)]"><tr><th className="pb-2">Mode</th><th className="pb-2">Process</th><th className="pb-2">Preflight</th></tr></thead><tbody>{matrix.map(([mode, process, preflight]) => <tr key={mode} className="border-t border-[var(--color-line)]"><td className="py-2 font-mono text-[var(--color-accent)]">{mode}</td><td className="py-2 font-mono text-[var(--color-ink-2)]">{process}</td><td className="py-2 text-[var(--color-ink-3)]">{preflight}</td></tr>)}</tbody></table></div>
        </section>

        <section className="mt-3 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)]/60 p-4">
          <h2 className="text-sm font-semibold">Verification checklist</h2>
          <ul className="mt-3 grid gap-2 text-xs text-[var(--color-ink-3)] sm:grid-cols-2"><li>□ exact remote workspace registered</li><li>□ SSH/node-agent route reachable</li><li>□ requested executor advertised</li><li>□ provenance header present</li><li>□ Mac worker run.log inspected</li><li>□ result, events, artifact verified</li></ul>
          <p className="mt-4 text-[11px] text-[var(--color-ink-3)]">Full reference: <code className="text-[var(--color-accent)]">docs/execution-flow.md</code></p>
        </section>
      </div>
    </div>
  )
}
