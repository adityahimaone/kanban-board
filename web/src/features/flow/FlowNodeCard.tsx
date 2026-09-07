import type { LucideIcon } from "lucide-react"
import type { FlowTask } from "./useFlowTasks"

export const CARD_W = 186
export const CARD_H = 50

/** Compact service card: 4px radius, left accent strip, tiny activity dot. */
export function FlowNodeCard({ label, sub, Icon, hue, activeCount, selected, onClick, latest }: {
  label: string
  sub: string
  Icon: LucideIcon
  hue: string
  activeCount: number
  selected: boolean
  onClick: () => void
  latest?: FlowTask
}) {
  const ring = selected ? { boxShadow: `0 0 0 1px ${hue}` } : undefined
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${label}${activeCount > 0 ? `, ${activeCount} active` : ""}`}
      className="relative flex w-[186px] cursor-pointer items-center gap-2 rounded-[5px] border px-2.5 text-left transition-colors duration-150 hover:brightness-110"
      style={{ height: CARD_H, background: "#171816", borderColor: "rgba(255,255,255,.11)", ...ring }}
    >
      <span className="absolute left-0 top-1/2 h-5 w-[5px] -translate-y-1/2 rounded-r" style={{ background: hue }} />
      <Icon className="size-3.5 shrink-0" style={{ color: hue }} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[11px] font-medium leading-tight text-[#e8e8e3]" title={label}>{label}</span>
        <span className="block truncate font-mono text-[9px] leading-tight text-[#90928b]" title={latest ? `${latest.stage} · ${latest.task_id} · ${latest.title}` : sub}>
          {latest ? `${latest.stage} · ${latest.task_id}` : sub}
        </span>
      </span>
      {activeCount > 0 && <span className="size-1.5 shrink-0 rounded-full" style={{ background: hue, boxShadow: `0 0 6px ${hue}` }} />}
    </button>
  )
}
