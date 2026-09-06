import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { api } from "@/api"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Puzzle, Search, X } from "lucide-react"

interface SkillMeta {
  name: string
  description: string
  category?: string
  path?: string
}

export default function SkillsPage() {
  const [q, setQ] = useState("")
  const [active, setActive] = useState<string | null>(null)

  const skills = useQuery({
    queryKey: ["skills"],
    queryFn: () => api<SkillMeta[]>("/api/skills"),
  })

  const content = useQuery({
    queryKey: ["skill-content", active],
    queryFn: () => api<{ name: string; content: string }>(`/api/skills/content?name=${encodeURIComponent(active ?? "")}`),
    enabled: !!active,
  })

  const filtered = useMemo(() => {
    const list = skills.data ?? []
    const needle = q.trim().toLowerCase()
    if (!needle) return list
    return list.filter(
      (s) => s.name.toLowerCase().includes(needle) || s.description.toLowerCase().includes(needle) || (s.category ?? "").toLowerCase().includes(needle),
    )
  }, [skills.data, q])

  return (
    <div className="mx-auto flex h-full w-full max-w-6xl flex-col p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-lg font-semibold tracking-tight">Skills</h1>
        <span className="rounded bg-[#0b0e14] px-1.5 py-0.5 text-[10px] text-neutral-400">
          {skills.data?.length ?? 0} installed
        </span>
        <div className="relative ml-auto w-64">
          <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-neutral-500" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari skill…"
            className="h-8 border-[#1e2430] bg-[#0b0e14] pl-7 text-xs"
          />
        </div>
      </div>
      <p className="mt-1 text-xs text-neutral-500">
        Read-only registry dari <code className="text-neutral-400">~/.hermes/skills</code> — klik skill buat liat SKILL.md.
      </p>

      <Separator className="my-3" />

      {skills.isLoading ? (
        <p className="text-sm text-neutral-400">Loading…</p>
      ) : skills.isError ? (
        <p className="text-sm text-red-400">Gagal load skills: {(skills.error as Error).message}</p>
      ) : (
        <div className={`grid min-h-0 flex-1 gap-3 overflow-hidden ${active ? "lg:grid-cols-[1fr_1.2fr]" : ""}`}>
          <div className={`grid min-h-0 gap-2 overflow-y-auto pr-1 ${active ? "lg:grid-cols-1" : "sm:grid-cols-2 lg:grid-cols-3"}`}>
            {filtered.map((s) => (
              <Card
                key={s.path || s.name}
                className={`cursor-pointer border-[#1e2430] bg-[#11151f] transition-colors hover:border-[#10e0dd]/40 ${active === s.name ? "border-[#10e0dd]/60" : ""}`}
                onClick={() => setActive(s.name)}
              >
                <CardContent className="p-3">
                  <div className="flex items-start gap-2">
                    <div className="flex aspect-square size-7 shrink-0 items-center justify-center rounded-lg bg-[#161b27]">
                      <Puzzle className="size-3.5 text-[#10e0dd]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <h3 className="truncate text-sm font-semibold">{s.name}</h3>
                        {s.category && (
                          <Badge variant="outline" className="shrink-0 text-[9px] text-neutral-400">{s.category}</Badge>
                        )}
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-neutral-400">{s.description}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {!filtered.length && <p className="col-span-full text-sm text-neutral-500">No skills matched "{q}".</p>}
          </div>

          {active && (
            <div className="flex min-h-0 flex-col rounded-lg border border-[#1e2430] bg-[#11151f]">
              <div className="flex shrink-0 items-center gap-2 border-b border-[#1e2430] px-3 py-2">
                <h2 className="truncate font-mono text-xs font-semibold text-[#10e0dd]">{active}/SKILL.md</h2>
                <Button variant="ghost" size="sm" className="ml-auto size-6 p-0" onClick={() => setActive(null)}>
                  <X className="size-3.5" />
                </Button>
              </div>
              <pre className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap break-words p-3 font-mono text-[11px] leading-relaxed text-neutral-300">
                {content.isLoading ? "Loading…" : content.isError ? (content.error as Error).message : content.data?.content}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
