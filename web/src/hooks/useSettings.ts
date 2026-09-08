import { useEffect, useState } from "react"

// ponytail: localStorage-only settings hook. Add backend API + user table when multi-device sync needed.
const REFRESH_KEY = "kb-refresh-interval"
const COMPACT_KEY = "kb-compact-cards"
const PING_KEY = "kb-ping-interval"
export const THEME_KEY = "kb-theme"
export type ThemePreference = "system" | "light" | "dark"

function readNum(key: string, fallback: number): number {
  try {
    const raw = localStorage.getItem(key)
    return raw !== null ? Number(raw) : fallback
  } catch { return fallback }
}
function readBool(key: string, fallback: boolean): boolean {
  try {
    const raw = localStorage.getItem(key)
    return raw !== null ? JSON.parse(raw) : fallback
  } catch { return fallback }
}
export function readTheme(): ThemePreference {
  try {
    const raw = localStorage.getItem(THEME_KEY)
    return raw === "light" || raw === "dark" || raw === "system" ? raw : "system"
  } catch { return "system" }
}
export function applyTheme(theme: ThemePreference) {
  const resolved = theme === "system" ? (window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark") : theme
  document.documentElement.classList.toggle("light", resolved === "light")
  document.documentElement.classList.toggle("dark", resolved === "dark")
  document.documentElement.dataset.theme = theme
}

export function useSettings() {
  const [refreshMs, setRefreshMs] = useState(() => readNum(REFRESH_KEY, 15000))
  const [compact, setCompact] = useState(() => readBool(COMPACT_KEY, false))
  const [pingMs, setPingMs] = useState(() => readNum(PING_KEY, 30000))
  const [theme, setThemeState] = useState<ThemePreference>(() => readTheme())

  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === REFRESH_KEY) setRefreshMs(readNum(REFRESH_KEY, 15000))
      if (e.key === COMPACT_KEY) setCompact(readBool(COMPACT_KEY, false))
      if (e.key === PING_KEY) setPingMs(readNum(PING_KEY, 30000))
      if (e.key === THEME_KEY) { const next = readTheme(); setThemeState(next); applyTheme(next) }
    }
    window.addEventListener("storage", handler)
    const media = window.matchMedia("(prefers-color-scheme: light)")
    const syncSystem = () => { if (readTheme() === "system") applyTheme("system") }
    media.addEventListener("change", syncSystem)
    return () => { window.removeEventListener("storage", handler); media.removeEventListener("change", syncSystem) }
  }, [])

  function setTheme(next: ThemePreference) {
    setThemeState(next)
    try { localStorage.setItem(THEME_KEY, next) } catch {}
    applyTheme(next)
    window.dispatchEvent(new StorageEvent("storage", { key: THEME_KEY, newValue: next }))
  }
  return { refreshMs, compact, pingMs, theme, setTheme }
}
