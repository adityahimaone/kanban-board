export interface Board {
  slug: string
  name: string
  icon: string
  color: string
  default_workdir: string
}

export interface Task {
  id: string
  title: string
  body: string
  status: Status
  priority: number
  assignee: string
  executor: "auto" | "hermes" | "codex" | "commandcode" | "shell"
  command?: string
  workspace_kind: string
  workspace_path: string
  result: string
  created_by: string
  created_at: number
  started_at: number | null
  completed_at: number | null
  consecutive_failures: number
  last_failure_error: string
}

export interface TaskEvent {
  id: number
  task_id: string
  kind: string
  payload: string
  created_at: number
}

export interface TaskHealth {
  task_id: string
  status: Status
  health: "not_running" | "healthy" | "silent" | "stuck" | "lost" | "unknown"
  last_activity_at: number
  age_seconds: number
  source: string
  reason: string
}

export type RunControlAction = "retry" | "release" | "clone"

export function runControl(slug: string, taskId: string, action: RunControlAction) {
  return api<Task>(`/api/boards/${slug}/tasks/${taskId}/${action}`, { method: "POST" })
}

export function taskHealth(slug: string, taskId: string) {
  return api<TaskHealth>(`/api/boards/${slug}/tasks/${taskId}/health`)
}

export function boardHealth(slug: string) {
  return api<Record<string, TaskHealth>>(`/api/boards/${slug}/health`)
}

export interface OverviewHealth {
  healthy: number
  silent: number
  stuck: number
  lost: number
  unknown: number
}

export interface ServerEvent {
  kind: string
  data: { board?: string; task_id?: string }
  at: number
}

export function openEventStream(onEvent: (event: ServerEvent) => void) {
  const source = new EventSource("/api/events/stream")
  const handle = (message: MessageEvent<string>) => {
    try { onEvent(JSON.parse(message.data) as ServerEvent) } catch { /* refetch remains fallback */ }
  }
  source.onmessage = handle
  ;["task_created", "task_updated", "status_changed", "task_event", "workspace_ping", "node_health"].forEach((kind) => source.addEventListener(kind, handle))
  return () => source.close()
}

export interface Workspace {
  id: string
  name: string
  path: string
  host: string
  os?: string
  kind: string
  note?: string
  status?: string
  status_message?: string
  ping_ms?: number | null
}

export interface PingPoint {
  at: number
  ms?: number | null
  ok: boolean
  msg?: string
}

export interface Profile {
  name: string
  model: string
  provider: string
  active: boolean
  valid: boolean
}

export interface ProfileDetail {
  name: string
  model: string
  provider: string
  active: boolean
  valid: boolean
  base_url?: string
  system_prompt: string
  skills: string[]
}

export interface ProviderModel {
  name: string
  base_url: string
  default_model: string
  models: string[]
  api_key_set: boolean
}

export interface TaskComment {
  id: number
  task_id: string
  author: string
  body: string
  created_at: number
}

export type Status =
  | "triage" | "todo" | "scheduled" | "ready" | "running"
  | "blocked" | "review" | "done" | "archived"

export const COLUMNS: Status[] = [
  "triage", "todo", "ready", "running", "blocked", "review", "done",
]

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...init,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error((body as { error?: string }).error ?? res.statusText)
  }
  return res.json() as Promise<T>
}
