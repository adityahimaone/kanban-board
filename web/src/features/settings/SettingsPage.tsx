import { useEffect, useState } from "react"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList } from "@/components/ui/tabs"
import { ArrowDown, ArrowUp, GripVertical, RotateCcw, Search, Volume2, VolumeX, RefreshCw, LayoutGrid, Activity, Download, Eye, EyeOff } from "lucide-react"
import { setEnabled as setCuelumeEnabled, setVolume } from "cuelume"
import { useSidebarPreferences } from "@/lib/sidebar-preferences"

const TABS = [
  { id: "general", label: "General" },
  { id: "appearance", label: "Appearance" },
  { id: "notifications", label: "Notifications" },
  { id: "advanced", label: "Advanced" },
] as const

type TabId = (typeof TABS)[number]["id"]

// ponytail: localStorage-only settings. Add backend API + user table when multi-device sync needed.
const SOUND_KEY = "kb-sound-enabled"
const VOLUME_KEY = "kb-sound-volume"
const REFRESH_KEY = "kb-refresh-interval"
const COMPACT_KEY = "kb-compact-cards"
const PING_KEY = "kb-ping-interval"

function useLocalStorage<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key)
      return raw !== null ? (JSON.parse(raw) as T) : fallback
    } catch {
      return fallback
    }
  })
  const update = (v: T) => {
    setValue(v)
    try { localStorage.setItem(key, JSON.stringify(v)) } catch {}
  }
  return [value, update] as const
}

export default function SettingsPage() {
  const [tab, setTab] = useState<TabId>("general")
  const [q, setQ] = useState("")

  const [soundOn, setSoundOn] = useLocalStorage(SOUND_KEY, true)
  const [volume, setVol] = useLocalStorage(VOLUME_KEY, 0.6)
  const [refreshMs, setRefresh] = useLocalStorage(REFRESH_KEY, 15000)
  const [compact, setCompact] = useLocalStorage(COMPACT_KEY, false)
  const [pingMs, setPing] = useLocalStorage(PING_KEY, 30000)
  const { items, isVisible, move, toggle, reset } = useSidebarPreferences()

  // Sync cuelume engine with stored prefs on mount/change
  useEffect(() => {
    setCuelumeEnabled(soundOn)
    setVolume(volume)
  }, [soundOn, volume])

  const needle = q.trim().toLowerCase()
  const show = (...labels: string[]) => !needle || labels.some((l) => l.toLowerCase().includes(needle))

  const refreshOpts = [
    { label: "5s", value: 5000 },
    { label: "10s", value: 10000 },
    { label: "15s", value: 15000 },
    { label: "30s", value: 30000 },
    { label: "60s", value: 60000 },
  ]

  const pingOpts = [
    { label: "10s", value: 10000 },
    { label: "30s", value: 30000 },
    { label: "60s", value: 60000 },
    { label: "Off", value: 0 },
  ]

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <header className="flex shrink-0 items-center gap-3 border-b border-[#1e2430] px-6 py-4">
        <h1 className="text-lg font-semibold text-neutral-100">Settings</h1>
        <div className="relative ml-auto w-64">
          <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-neutral-500" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari setting…"
            className="h-8 border-[#1e2430] bg-[#0b0e14] pl-7 text-xs" />
        </div>
      </header>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <nav className="flex w-48 shrink-0 flex-col gap-1 border-r border-[#1e2430] bg-[#11151f]/40 p-3">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              data-cuelume-hover="tick" data-cuelume-press data-cuelume-release
              className={`rounded-md px-3 py-2 text-left text-xs font-medium transition-colors ${
                tab === t.id ? "bg-[#10e0dd]/10 text-[#10e0dd]" : "text-neutral-400 hover:bg-[#1e2430]/60 hover:text-neutral-200"
              }`}>
              {t.label}
            </button>
          ))}
        </nav>

        <main className="min-h-0 flex-1 overflow-y-auto p-6">
          <Tabs value={tab} onValueChange={(v) => setTab(v as TabId)} className="w-full max-w-2xl">
            <TabsList className="hidden">{/* nav sidebar replaces visual tabs */}</TabsList>

            <TabsContent value="general" className="mt-0 space-y-6">
              {show("Sound Effects", "Audio") && (
                <div className="space-y-4 rounded-lg border border-[#1e2430]/60 bg-[#11151f]/30 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {soundOn ? <Volume2 className="size-4 text-[#10e0dd]" /> : <VolumeX className="size-4 text-neutral-500" />}
                      <div>
                        <p className="text-sm font-medium text-neutral-200">Sound Effects</p>
                        <p className="text-xs text-neutral-500">Interaction feedback via cuelume</p>
                      </div>
                    </div>
                    <Switch checked={soundOn} onCheckedChange={setSoundOn} />
                  </div>
                  {soundOn && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs text-neutral-400">
                        <span>Volume</span>
                        <span>{Math.round(volume * 100)}%</span>
                      </div>
                      <input type="range" min={0} max={1} step={0.05} value={volume}
                        onChange={(e) => setVol(Number(e.target.value))}
                        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-[#1e2430] accent-[#10e0dd]" />
                    </div>
                  )}
                </div>
              )}

              {show("Auto Refresh", "Polling", "Board") && (
                <div className="flex items-center justify-between rounded-lg border border-[#1e2430]/60 bg-[#11151f]/30 p-4">
                  <div className="flex items-center gap-3">
                    <RefreshCw className="size-4 text-neutral-400" />
                    <div>
                      <p className="text-sm font-medium text-neutral-200">Board Auto-Refresh</p>
                      <p className="text-xs text-neutral-500">Task polling interval</p>
                    </div>
                  </div>
                  <select value={refreshMs} onChange={(e) => setRefresh(Number(e.target.value))}
                    className="h-8 rounded border border-[#1e2430] bg-[#0b0e14] px-2 text-xs text-neutral-200 outline-none focus:border-[#10e0dd]">
                    {refreshOpts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              )}

              {!show("Sound Effects", "Audio", "Auto Refresh", "Polling", "Board") && (
                <p className="text-xs text-neutral-600">No match.</p>
              )}
            </TabsContent>

            <TabsContent value="appearance" className="mt-0 space-y-6">
              {show("Compact", "Card", "Density") && (
                <div className="flex items-center justify-between rounded-lg border border-[#1e2430]/60 bg-[#11151f]/30 p-4">
                  <div className="flex items-center gap-3">
                    <LayoutGrid className="size-4 text-neutral-400" />
                    <div>
                      <p className="text-sm font-medium text-neutral-200">Compact Task Cards</p>
                      <p className="text-xs text-neutral-500">Reduce padding & font size for denser board</p>
                    </div>
                  </div>
                  <Switch checked={compact} onCheckedChange={setCompact} />
                </div>
              )}

              {show("Sidebar", "Navigation", "Order", "Hide", "Show") && (
                <div className="space-y-3 rounded-lg border border-[#1e2430]/60 bg-[#11151f]/30 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-neutral-200">Sidebar Navigation</p>
                      <p className="text-xs text-neutral-500">Atur urutan fitur dan sembunyikan halaman yang tidak dipakai.</p>
                    </div>
                    <button type="button" onClick={reset} title="Reset sidebar" aria-label="Reset sidebar navigation"
                      className="inline-flex shrink-0 items-center gap-1 rounded border border-[#1e2430] px-2 py-1 text-[11px] text-neutral-400 hover:border-[#10e0dd]/60 hover:text-[#10e0dd]">
                      <RotateCcw className="size-3" /> Reset
                    </button>
                  </div>
                  <div className="space-y-1">
                    {items.map((item, index) => {
                      const Icon = item.icon
                      const visible = isVisible(item.id)
                      return (
                        <div key={item.id} className={`flex items-center gap-2 rounded-md border px-2 py-1.5 ${visible ? "border-[#1e2430] bg-[#0b0e14]" : "border-[#1e2430]/60 bg-[#0b0e14]/40 opacity-65"}`}>
                          <GripVertical className="size-3.5 shrink-0 text-neutral-600" aria-hidden="true" />
                          <Icon className="size-3.5 shrink-0 text-neutral-400" aria-hidden="true" />
                          <span className="min-w-0 flex-1 truncate text-xs text-neutral-200">{item.label}</span>
                          <div className="flex shrink-0 items-center gap-0.5">
                            <button type="button" onClick={() => move(item.id, -1)} disabled={index === 0} title={`Move ${item.label} up`} aria-label={`Move ${item.label} up`}
                              className="rounded p-1 text-neutral-500 hover:bg-[#1e2430] hover:text-[#10e0dd] disabled:pointer-events-none disabled:opacity-25"><ArrowUp className="size-3.5" /></button>
                            <button type="button" onClick={() => move(item.id, 1)} disabled={index === items.length - 1} title={`Move ${item.label} down`} aria-label={`Move ${item.label} down`}
                              className="rounded p-1 text-neutral-500 hover:bg-[#1e2430] hover:text-[#10e0dd] disabled:pointer-events-none disabled:opacity-25"><ArrowDown className="size-3.5" /></button>
                            <button type="button" onClick={() => toggle(item.id, !visible)} disabled={item.id === "board"} title={item.id === "board" ? "Kanban Board selalu tersedia" : visible ? `Hide ${item.label}` : `Show ${item.label}`} aria-label={item.id === "board" ? "Kanban Board always visible" : visible ? `Hide ${item.label}` : `Show ${item.label}`}
                              className="rounded p-1 text-neutral-500 hover:bg-[#1e2430] hover:text-[#10e0dd] disabled:pointer-events-none disabled:opacity-40">{visible ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}</button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {!show("Compact", "Card", "Density", "Sidebar", "Navigation", "Order", "Hide", "Show") && (
                <p className="text-xs text-neutral-600">No match.</p>
              )}
            </TabsContent>

            <TabsContent value="notifications" className="mt-0">
              <p className="text-xs text-neutral-600">Notification preferences coming soon.</p>
            </TabsContent>

            <TabsContent value="advanced" className="mt-0 space-y-6">
              {show("Ping", "Workspace", "Heartbeat") && (
                <div className="flex items-center justify-between rounded-lg border border-[#1e2430]/60 bg-[#11151f]/30 p-4">
                  <div className="flex items-center gap-3">
                    <Activity className="size-4 text-neutral-400" />
                    <div>
                      <p className="text-sm font-medium text-neutral-200">Workspace Ping Interval</p>
                      <p className="text-xs text-neutral-500">Auto-ping frequency for workspace health</p>
                    </div>
                  </div>
                  <select value={pingMs} onChange={(e) => setPing(Number(e.target.value))}
                    className="h-8 rounded border border-[#1e2430] bg-[#0b0e14] px-2 text-xs text-neutral-200 outline-none focus:border-[#10e0dd]">
                    {pingOpts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              )}

              {show("Export", "Backup", "Data") && (
                <div className="flex items-center justify-between rounded-lg border border-[#1e2430]/60 bg-[#11151f]/30 p-4">
                  <div className="flex items-center gap-3">
                    <Download className="size-4 text-neutral-400" />
                    <div>
                      <p className="text-sm font-medium text-neutral-200">Export Settings</p>
                      <p className="text-xs text-neutral-500">Download all preferences as JSON</p>
                    </div>
                  </div>
                  <button onClick={() => {
                    const blob = new Blob([JSON.stringify({ soundOn, volume, refreshMs, compact, pingMs }, null, 2)], { type: "application/json" })
                    const a = document.createElement("a")
                    a.href = URL.createObjectURL(blob)
                    a.download = "kanban-settings.json"
                    a.click()
                    URL.revokeObjectURL(a.href)
                  }}
                    data-cuelume-press data-cuelume-release
                    className="rounded border border-[#1e2430] bg-[#0b0e14] px-3 py-1.5 text-xs text-neutral-300 hover:border-[#10e0dd] hover:text-[#10e0dd]">
                    Export
                  </button>
                </div>
              )}

              {!show("Ping", "Workspace", "Heartbeat", "Export", "Backup", "Data") && (
                <p className="text-xs text-neutral-600">No match.</p>
              )}
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  )
}
