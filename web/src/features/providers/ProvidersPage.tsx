import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { api, type ProfileDetail } from "@/api"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Server, Search, X, KeyRound } from "lucide-react"

export default function ProvidersPage({ onUseInProfile }: { onUseInProfile?: (name: string, model: string) => void }) {
  const [q, setQ] = useState("")
  const [active, setActive] = useState<string | null>(null)

  const providers = useQuery({
    queryKey: ["providers"],
    queryFn: () => api<{ name: string; base_url: string; default_model: string; models: string[]; api_key_set: boolean }[]>("/api/providers"),
  })
  const profiles = useQuery({
    queryKey: ["profiles-full"],
    queryFn: () => api<ProfileDetail[]>("/api/profiles-full"),
  })

  const list = (providers.data ?? []).filter((p) => !q || p.name.toLowerCase().includes(q.toLowerCase()) || p.base_url.toLowerCase().includes(q.toLowerCase()))
  const selected = (providers.data ?? []).find((p) => p.name === active)

  return (
    <div className="mx-auto w-full max-w-5xl p-4">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-semibold tracking-tight">Providers</h1>
        <span className="rounded bg-[#0b0e14] px-1.5 py-0.5 text-[10px] text-neutral-400">
          {providers.data?.length ?? 0}
        </span>
        <div className="relative ml-auto">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-neutral-500" />
          <input
            value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari provider…"
            className="w-44 rounded-md border border-[#1e2430] bg-[#0b0e14] py-1.5 pl-8 pr-2 text-xs outline-none focus:border-[#10e0dd]/50"
          />
        </div>
      </div>
      <p className="mt-1 text-xs text-neutral-500">
        Roster model dari <code className="text-neutral-400">~/.hermes/config.yaml</code> custom_providers. Pakai di profile lewat dropdown bawah.
      </p>

      {providers.isLoading ? (
        <p className="mt-6 text-sm text-neutral-400">Loading…</p>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          {list.map((p) => (
            <Card key={p.name} className={`cursor-pointer border-[#1e2430] bg-[#11151f] transition-colors hover:border-[#10e0dd]/40 ${active === p.name ? "border-[#10e0dd]/60" : ""}`}
              onClick={() => setActive(active === p.name ? null : p.name)}>
              <CardHeader className="p-3.5 pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <div className="flex aspect-square size-7 shrink-0 items-center justify-center rounded-lg bg-[#161b27]">
                    <Server className="size-3.5 text-[#10e0dd]" />
                  </div>
                  <span className="truncate">{p.name}</span>
                  {p.api_key_set && (
                    <Badge variant="outline" className="ml-auto border-emerald-500/30 bg-emerald-500/10 text-[10px] text-emerald-300">
                      <KeyRound className="size-2.5" /> key set
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3.5 pt-0">
                <p className="truncate font-mono text-[11px] text-neutral-500" title={p.base_url}>{p.base_url || "—"}</p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <Badge variant="outline" className="border-[#1e2430] text-[10px] text-neutral-300">
                    {p.models.length} models
                  </Badge>
                  {p.default_model && (
                    <Badge variant="outline" className="border-[#10e0dd]/30 bg-[#10e0dd]/5 text-[10px] text-[#10e0dd]">
                      default: {p.default_model}
                    </Badge>
                  )}
                </div>
                {active === p.name && p.models.length > 0 && (
                  <>
                    <Separator className="my-2.5" />
                    <div className="max-h-40 overflow-y-auto">
                      <div className="flex flex-wrap gap-1">
                        {p.models.slice(0, 60).map((m) => (
                          <span key={m} className="rounded bg-[#0b0e14] px-1.5 py-0.5 font-mono text-[10px] text-neutral-400">{m}</span>
                        ))}
                        {p.models.length > 60 && (
                          <span className="px-1 py-0.5 text-[10px] text-neutral-600">+{p.models.length - 60} more</span>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          ))}
          {!list.length && <p className="text-sm text-neutral-500">No provider matched.</p>}
        </div>
      )}

      {/* link providers -> profiles */}
      <Card className="mt-6 border-[#1e2430] bg-[#11151f]">
        <CardHeader className="p-3.5 pb-1">
          <CardTitle className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
            Pakai provider di agent profile
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3 p-3.5 pt-1">
          <Select
            onValueChange={(profileName) => {
              if (!selected) return
              // PATCH profile model (default model of provider) — provider stays "custom"
              fetch(`/api/profiles/${profileName}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ model: selected.default_model, provider: "custom" }),
              }).then(() => profiles.refetch())
            }}
          >
            <SelectTrigger className="w-56 border-[#1e2430] bg-[#0b0e14] text-xs">
              <SelectValue placeholder={selected ? `Set ${selected.name} → profile…` : "Pilih provider dulu di atas"} />
            </SelectTrigger>
            <SelectContent className="border-[#1e2430] bg-[#11151f]">
              {(profiles.data ?? []).filter((p) => p.name !== "default").map((p) => (
                <SelectItem key={p.name} value={p.name} className="text-xs">{p.name} (model: {p.model || "—"})</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selected && (
            <span className="flex items-center gap-1.5 text-xs text-neutral-400">
              <X className="size-3" /> clear: klik kartu lagi
            </span>
          )}
          {selected ? (
            <span className="text-xs text-neutral-500">
              akan set model=<span className="font-mono text-neutral-300">{selected.default_model || "?"}</span> provider=<span className="font-mono text-neutral-300">custom</span>
            </span>
          ) : (
            <span className="text-xs text-neutral-500">klik satu provider card, lalu pilih profile target</span>
          )}
          {onUseInProfile && (
            <Button variant="outline" size="sm" className="ml-auto" onClick={() => selected && onUseInProfile(selected.name, selected.default_model)}>
              Edit profiles page
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
