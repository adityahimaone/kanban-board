import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList } from "@/components/ui/tabs"
import { Search, Volume2, VolumeX } from "lucide-react"

const TABS = [
  { id: "general", label: "General" },
  { id: "appearance", label: "Appearance" },
  { id: "notifications", label: "Notifications" },
  { id: "advanced", label: "Advanced" },
] as const

type TabId = (typeof TABS)[number]["id"]

// ponytail: localStorage-only settings. Add backend API + user table when multi-device sync needed.
const SOUND_KEY = "kb-sound-enabled"

function useSoundPref() {
  const [enabled, setEnabled] = useState(() => {
    try { return localStorage.getItem(SOUND_KEY) !== "false" } catch { return true }
  })
  const toggle = (v: boolean) => {
    setEnabled(v)
    try { localStorage.setItem(SOUND_KEY, String(v)) } catch {}
    // cuelume bind() already global; mute/unmute via setEnabled if needed later
  }
  return { enabled, toggle }
}

export default function SettingsPage() {
  const [tab, setTab] = useState<TabId>("general")
  const [q, setQ] = useState("")
  const sound = useSoundPref()

  const needle = q.trim().toLowerCase()
  const show = (label: string) => !needle || label.toLowerCase().includes(needle)

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
              {show("Sound Effects") && (
                <div className="flex items-center justify-between rounded-lg border border-[#1e2430]/60 bg-[#11151f]/30 p-4">
                  <div className="flex items-center gap-3">
                    {sound.enabled ? <Volume2 className="size-4 text-[#10e0dd]" /> : <VolumeX className="size-4 text-neutral-500" />}
                    <div>
                      <p className="text-sm font-medium text-neutral-200">Sound Effects</p>
                      <p className="text-xs text-neutral-500">Interaction feedback via cuelume</p>
                    </div>
                  </div>
                  <Switch checked={sound.enabled} onCheckedChange={sound.toggle} />
                </div>
              )}
              {!show("Sound Effects") && <p className="text-xs text-neutral-600">No match.</p>}
            </TabsContent>

            <TabsContent value="appearance" className="mt-0">
              <p className="text-xs text-neutral-600">Theme & density settings coming soon.</p>
            </TabsContent>

            <TabsContent value="notifications" className="mt-0">
              <p className="text-xs text-neutral-600">Notification preferences coming soon.</p>
            </TabsContent>

            <TabsContent value="advanced" className="mt-0">
              <p className="text-xs text-neutral-600">Debug & export tools coming soon.</p>
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  )
}
