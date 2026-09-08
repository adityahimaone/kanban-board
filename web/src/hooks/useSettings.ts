import { useEffect, useState } from "react"

// ponytail: localStorage-only settings hook. Add backend API + user table when multi-device sync needed.
const REFRESH_KEY = "kb-refresh-interval"
const COMPACT_KEY = "kb-compact-cards"
const PING_KEY = "kb-ping-interval"

function readNum(key: string, fallback: number): number {
  try {
    const raw = localStorage.getItem(key)
    return raw !== null ? Number(raw) : fallback
  } catch {
    return fallback
  }
}

function readBool(key: string, fallback: boolean): boolean {
  try {
    const raw = localStorage.getItem(key)
    return raw !== null ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

export function useSettings() {
  const [refreshMs, setRefreshMs] = useState(() => readNum(REFRESH_KEY, 15000))
  const [compact, setCompact] = useState(() => readBool(COMPACT_KEY, false))
  const [pingMs, setPingMs] = useState(() => readNum(PING_KEY, 30000))

  // Listen for cross-tab / same-tab storage changes so settings page updates propagate live
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === REFRESH_KEY) setRefreshMs(readNum(REFRESH_KEY, 15000))
      if (e.key === COMPACT_KEY) setCompact(readBool(COMPACT_KEY, false))
      if (e.key === PING_KEY) setPingMs(readNum(PING_KEY, 30000))
    }
    window.addEventListener("storage", handler)
    return () => window.removeEventListener("storage", handler)
  }, [])

  return { refreshMs, compact, pingMs }
}

