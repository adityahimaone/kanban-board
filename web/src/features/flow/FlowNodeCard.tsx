import type { LucideIcon } from "lucide-react"

export function FlowNodeCard({ label, sub, Icon }: { label: string; sub: string; Icon: LucideIcon }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-[#1e2430] bg-[#0d1017] px-4 py-3 shadow-sm">
      <div className="min-w-0">
        <div className="font-mono text-[13px] font-semibold leading-none text-neutral-100">{label}</div>
        <div className="mt-1 font-mono text-[11px] leading-none text-neutral-500">{sub}</div>
      </div>
      <div className="ml-auto flex size-8 shrink-0 items-center justify-center rounded-lg border border-[#2a3140] bg-[#11151f] text-neutral-400">
        <Icon className="size-4" />
      </div>
    </div>
  )
}
