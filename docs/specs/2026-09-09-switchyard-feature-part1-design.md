# Switchyard Feature Part 1 — Design

Status: approved for implementation (audit follow-up, skip #1 default-password — explicit user request)
Date: 2026-09-09
Source audit: findings 2–16 (finding #1 skipped)
Repo: `~/apps/kanban-board` — Go `cmd/server` + `internal/kanban`, Vite React `web/`

## 1. Goal

Close all audit gaps except the seeded-password risk (#1). Part 1 ships: correctness (missing column), operational safety (backup/restore + commit auth), dispatcher/run UX, scale (pagination), and productivity polish — without inventing new auth or breaking existing API contracts.

## 2. Non-goals (explicit)

- Finding #1 (default password `123456`, forced-change/env seed) — skipped per user instruction.
- Replacing kanban HTTP API with gRPC or touching node-agent transport.
- Changing task status model.

## 3. Scope — 15 items (audit mapping)

P0:
- #2 Commit pending auth — `internal/kanban/auth*.go`, `web/src/AuthGate.tsx`, `auth-page.tsx`, etc. — moves from untracked to committed.
- #3 Backup/restore — export/import board data + auth not in backup by design.

P1 (ops/QA):
- #4 `scheduled` column missing — `api.ts:COLUMNS` omits valid status, so tasks stuck invisible.
- #5 Persistent drag-drop order — `App.tsx:taskOrder` is transient React state.
- #6 Bulk actions — no multi-select/archive/move/assign.
- #7 Notifications — `SettingsPage.tsx:268` placeholder only.
- #8 Run-now/dispatch UX — create/move only, no explicit run/queue/cancel affordance.
- #9 Run history/attempts — `task_events` exists but no attempt/run entity in UI.
- #10 Server pagination/filter — `GET /api/boards/{slug}/tasks` loads all rows.

P2 (productivity):
- #11 Command palette (Cmd/Ctrl+K).
- #12 Saved views / filter presets.
- #13 Task dependencies/blockers.
- #14 Board archive/restore UI.
- #15 Consistent mutation/toast feedback.
- #16 Bundle splitting (1,024 KB eager bundle).

## 4. Contracts & Data

### 4.1 Statuses
`ValidStatuses` already includes `scheduled`; only `COLUMNS` needs fix. No DB migration.
`BOARD_COLUMNS = [...COLUMNS, "archived"]` stays; `COLUMNS` must include `scheduled` between `triage` and `todo` (backend order: triage|todo|scheduled|ready|running|blocked|review|done|archived).

### 4.2 Position persistence (#5)
Add `position INTEGER NOT NULL DEFAULT 0` to `tasks`. Existing rows unaffected (default 0). Sort becomes `ORDER BY position ASC, priority DESC, created_at DESC` or `position` first. New endpoints:
- `PATCH /api/boards/{slug}/tasks/{id}/position` or reuse bulk reorder `POST /api/boards/{slug}/tasks/reorder {order: string[]}` — prefer bulk for drag-drop (one write).
- Client keeps optimistic `taskOrder` but persists via bulk reorder on drop.

### 4.3 Backup/restore (#3)
- `GET /api/boards/{slug}/export` → JSON `{board, tasks, events, comments}` (no auth secrets).
- `POST /api/boards/{slug}/import` (or `/api/boards/import`) — creates board if missing, inserts tasks with conflict by id (skip/overwrite flag). Validates `ValidStatuses`.
- CLI helper: `go run ./cmd/server --export` optional; v1 is HTTP only.
- Never export `auth.db` or `api_key`.

### 4.4 Bulk (#6)
- `POST /api/boards/{slug}/tasks/bulk` body `{ids: string[], action: "archive"|"move", status?: string, assignee?: string}`. Reuses `StatusTransition` per id, emits `task_event` per id, single SSE broadcast batch. Archiving is `status=archived`.
- UI: multi-select checkbox per card + bulk bar (count + actions).

### 4.5 Pagination (#10)
- `GET /api/boards/{slug}/tasks?q=&status=&assignee=&limit=&offset=&sort=` — server filters + `LIMIT/OFFSET`. Default `limit=100` if omitted to avoid breaking existing clients; `limit=0` means all (legacy). Response stays `Task[]` for compat; later can wrap `{items, total}` with compat shim.

### 4.6 Notifications (#7)
- Phase 1: in-app notifications + browser Notification API (permission-gated). Source: SSE `task_event` for fail/lost/stuck + `review` entry. Store last N in localStorage or new `notifications` table later; v1 keeps in-memory + localStorage.
- Settings → Notifications tab replaces placeholder with toggles: `enableBrowser`, `onFailed`, `onReview`.

### 4.7 Run queue (#8)
- Explicit `POST /api/boards/{slug}/tasks/{id}/run` alias to retry/queue; UI button "Run now" visible when task has assignee and status in `todo|ready|blocked|review`. Shows queue reason (missing assignee/profile invalid/workspace unreachable).

### 4.8 History (#9)
- New `task_runs` or reuse `task_events` with attempt grouping. v1: group events by attempt derived from `status_changed`/`claimed`/`completed` clusters, show in detail page expandable timeline per attempt. No DB migration if grouping is view-only; add table only if attempt metadata needed.

### 4.9 Palette (#11)
- `Cmd/Ctrl+K` dialog: search tasks (title/id), boards, pages. Powered by existing `ListTasks` client cache + `ListBoards`. No backend search needed v1.

### 4.10 Saved views (#12)
- LocalStorage `kb-views:{slug}` presets: `{name, filters: {q,fStatus,fAgent,fWorkspace,fPriority}}`. Filter rail gets preset dropdown + save.

### 4.11 Dependencies (#13)
- Table `task_dependencies(task_id, depends_on_id)` + `GET/POST /api/boards/{slug}/tasks/{id}/dependencies`. `blocked` badge shows count; dependency graph read-only v1.

### 4.12 Board archive (#14)
- `PATCH /api/boards/{slug}` already exists; add `archived: bool` handling. UI: board switcher separates active vs archived, archived page/section with restore (`archived=false`).

### 4.13 Feedback (#15)
- Single `useToast` + `Toaster` primitive. Every mutation has `onSuccess`/`onError` toast; 401 redirects to login. Replace raw `alert()` in `TaskDetailPage`.

### 4.14 Bundle (#16)
- Route-level `React.lazy()` for heavy pages (`OverviewPage` Recharts, `AgentMappingPage`, `LogsPage`, `SkillsPage`, etc.) + `manualChunks`. Target <700 KB initial.

## 5. API surface delta

New/changed:
- `GET /api/boards/{slug}/export`, `POST /api/boards/import` (or slug import)
- `POST /api/boards/{slug}/tasks/bulk`
- `POST /api/boards/{slug}/tasks/reorder` or `PATCH .../position`
- `GET /api/boards/{slug}/tasks` — add query params (backward compat)
- `GET/POST /api/boards/{slug}/tasks/{id}/dependencies` (P2)
- Frontend-only: palette, saved views, notifications store, toast.

Auth: all new `/api/*` routes auto-covered by `authHandler` — no wiring.

## 6. Frontend pages touching

- `App.tsx` — COLUMNS fix, bulk bar, palette provider, saved-views, pagination wiring, reorder persist.
- `TaskCard.tsx` — bulk checkbox, dependency/blocked badge.
- `TaskDetailPage.tsx` — run-now, attempt grouping, dependencies.
- `SettingsPage.tsx` — Notifications tab real prefs.
- New: `components/ui/toaster.tsx`, `components/command-palette.tsx`, `features/board/BulkBar.tsx`.

## 7. Acceptance (gate)

- `go vet ./... && go test ./...` pass
- `pnpm build` pass, initial JS < 700 KB (or documented why not yet)
- `scheduled` column renders and holds tasks
- Drag-drop survives reload
- Bulk archive/move works
- Export/import round-trips board without data loss
- Notifications toggle persisted, browser permission respected
- Pagination returns filtered page without loading full table on large board
- Archive/restore board works, palette Cmd+K opens, saved view restores filters

## 8. Execution order

Slice order (one commit per slice, `plan.md` tick per slice):
1. #4 scheduled column — zero-risk correctness
2. #2 commit auth (already staged) — isolate security boundary commit
3. #10 pagination — scales before bulk
4. #5 persistent position
5. #6 bulk actions
6. #3 backup/restore
7. #7 notifications (in-app)
8. #8 run-queue affordance + #9 history grouping (together)
9. #14 board archive UI
10. #11 palette + #12 saved views
11. #13 dependencies
12. #15 toast/feedback sweep
13. #16 bundle splitting (last, measures final)

Each slice: TDD red→green (Go table test where applicable), `go vet/test` + `pnpm build`, smoke curl.

## 9. Risks

- Large bundle split can break hydration; do last.
- Position migration must be additive; old boards without column keep `position=0`.
- Bulk must not bypass `StatusTransition` guards (running-task rules).
