import type { LucideIcon } from "lucide-react"

export function FlowNodeCard({ label, sub, Icon, hue }: { label: string; sub: string; Icon: LucideIcon; hue: string }) {
  return (
    <div className="flex h-14 w-[210px] items-center gap-3 rounded-2xl border bg-[#0d1017] px-4 shadow-sm" style={{ borderColor: hue + "40" }}>
      <div className="min-w-0 flex-1">
        <div className="font-mono text-[13px] font-semibold leading-none text-neutral-100">{label}</div>
        <div className="mt-1.5 font-mono text-[10px] leading-none text-neutral-500">{sub}</div>
      </div>
      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border bg-[#11151f]" style={{ borderColor: hue + "55", color: hue }}>
        <Icon className="size-4" />
      </div>
    </div>
  )
}
