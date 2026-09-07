// Deterministic per-task color — consistent across re-renders/polls.
// Deliberately excludes app accent #10e0dd so dots never blend with UI chrome.
const DOT_PALETTE = [
  "#f0a83f", // orange
  "#c084fc", // purple
  "#fb7185", // rose
  "#a3e635", // lime
  "#38bdf8", // sky
  "#fbbf24", // amber
  "#f472b6", // pink
  "#818cf8", // indigo
]

export function colorForTask(taskId: string): string {
  let hash = 0
  for (let i = 0; i < taskId.length; i++) hash = (hash * 31 + taskId.charCodeAt(i)) >>> 0
  return DOT_PALETTE[hash % DOT_PALETTE.length]
}

/** Stagger delay (0-1200ms) so dots sharing a channel don't move in lockstep. */
export function delayForTask(taskId: string): number {
  let h = 0
  for (let i = 0; i < taskId.length; i++) h = (h * 17 + taskId.charCodeAt(i)) >>> 0
  return h % 1200
}
