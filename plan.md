# plan.md — kanban-board (Vite FE + Go BE, opsi A)

Repo: `~/apps/kanban-board`, deploy VPS :8790, share `~/.hermes/kanban/boards/<slug>/kanban.db`.

## Scope (simple dulu)

1. **BE Go** (`cmd/server`) — chi, `modernc.org/sqlite` (pure Go, no cgo), port 8790
   - `GET /api/boards` — list dari `~/.hermes/kanban/boards/*/board.json`
   - `GET /api/boards/{slug}/tasks` — read tasks (id, title, body, status, priority, workspace_path, assignee, created_at, completed_at, result, consecutive_failures)
   - `POST /api/boards/{slug}/tasks` — create (title, body, workspace_path, priority, status=todo|triage)
   - `PATCH /api/boards/{slug}/tasks/{id}/status` — status transition (todo→ready→running→done|blocked|archived) + audit ke `task_events`
   - `DELETE /api/boards/{slug}/tasks/{id}` — archive (soft)
   - `GET /api/workspaces` — dari `~/.hermes/workspaces.json` (dropdown)
   - `GET /api/nodes` — proxy `:8788/health` (node-agent status)
   - `GET /api/boards/{slug}/tasks/{id}/events` — task_events tail (history card)
   - Auth: none (localhost + tailscale only). nginx subpath `/kanban/` proxy.

2. **FE Vite** (`web/`) — React 19, TS, Vite 7, Tailwind v4, shadcn/ui (button/card/badge/select/dialog/dropdown), TanStack Query v5
   - `BoardView` — columns per status (triage/todo/ready/running/blocked/review/done), card = title + badge priority + workspace chip + assignee + result excerpt
   - `TaskDialog` — create task (title, body, workspace select, priority)
   - `TaskDetail` drawer — events timeline + status actions
   - Mobile off-canvas, shared UI language, dark theme (match dashboard)
   - `src/features/board/` feature folder, route `sections/`, barrel index.ts

3. **Integration rules**
   - Baca tulis langsung ke kanban.db via same schema hermes pakai — WAL mode, `BEGIN IMMEDIATE` for writes
   - Status valid (dari kanban_db.py): `triage|todo|scheduled|ready|running|blocked|review|done|archived`
   - Create: status default `todo` (bukan `running` — running cuma dispatcher)
   - Jangan sentuh `claim_lock`, `consecutive_failures`, `worker_pid`, `current_run_id` — domain dispatcher
   - `task_events` insert manual saat FE write (source="board-ui")

## Verifikasi

- `go vet ./...` + `go build`
- SQLite read: `GET /api/boards/f8-saas/tasks` → sama dengan `hermes kanban list --board f8-saas`
- Create: `POST /api/boards/f8-saas/tasks` → muncul di `hermes kanban list` + `sqlite3` query
- Status: `PATCH` → `hermes kanban show` reflects
- FE build: `pnpm build` → dist served by Go static
- PM2: `kanban-board` :8790, domain `kanban.adityahimaone.space` (SSL later)
- 1 runnable check: `go test ./internal/kanban -run TestStatusTransition` assert valid/invalid transitions

## Out of scope (add when needed)

- drag-drop column move (use PATCH status per card dropdown first)
- auth (nginx basic later)
- websocket live refresh (poll 15s via TanStack Query refetchInterval)
- worker spawn from UI (dispatch stays CLI/hermes)

## Active roadmap — Agent Control Plane Reliability

Spec: `docs/specs/2026-09-08-agent-control-plane-reliability-design.md`

Status: design written, awaiting implementation approval.

### Discovery/design

- [x] Confirm current API routes and task event model
- [x] Confirm `stop` exists; avoid duplicate endpoint
- [x] Confirm `running` and runtime columns are dispatcher-owned
- [x] Define retry/release/clone contracts
- [x] Define health states and thresholds
- [x] Define SSE envelope and polling fallback
- [ ] User reviews and approves spec

### Backend

- [ ] Health domain + threshold tests
- [ ] Retry operation + route
- [ ] Stale release operation + route
- [ ] Clone operation + route
- [ ] Task health route
- [ ] Overview health summary
- [ ] SSE event hub + stream route
- [ ] Mutation event broadcasts
- [ ] Backend HTTP tests

### Frontend

- [ ] Typed API methods
- [ ] SSE client with reconnect/backoff
- [ ] Board invalidation from SSE
- [ ] Task detail refresh from SSE
- [ ] Health indicator
- [ ] Retry/release/clone actions
- [ ] Polling fallback verification

### Verification

- [ ] `go vet ./...`
- [ ] `go test ./...`
- [ ] `go build ./cmd/server`
- [ ] `pnpm build` in `web/`
- [ ] Authenticated API smoke tests
- [ ] SSE mutation smoke test
- [ ] Scope/diff review
