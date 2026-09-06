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

export interface Workspace {
  id: string
  name: string
  path: string
  host: string
  kind: string
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
