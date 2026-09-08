# Agent Control Plane Reliability

Status: proposed
Scope: Switchyard / kanban-board
Product role: Hermes agent control plane + developer task manager

## Goal

Make task execution observable and recoverable without manual SQLite or log inspection.
Keep existing task lifecycle, review gate, local dispatcher, SSH dispatcher, and node-agent transport contracts compatible.

## Scope

### Included

- Run control: retry, release stuck, clone.
- Existing stop endpoint review and integration with run control.
- Task health endpoint with explicit liveness states.
- Aggregated health summary in overview.
- Server-sent events (SSE) event stream for live UI refresh.
- Frontend live updates for board and task detail first.
- Tests and local/API verification.

### Excluded

- WebSocket.
- Task dependencies.
- Human assignee model.
- Review inbox.
- Generic workflow automation.
- Token/cost telemetry without real Hermes/provider data.
- Direct browser connection to node-agent gRPC.

## Product decisions

1. Task remains source of truth in board SQLite.
2. `running` remains dispatcher-owned. UI cannot retry or release a healthy running task.
3. `stop` remains graceful/dispatcher-aware. `release` is explicit recovery for stale execution only.
4. SSE is additive. Existing polling remains fallback until live refresh is proven.
5. Health state is diagnostic. It must not silently mutate task status.
6. Every mutation emits an auditable `task_events` row.
7. No fabricated progress, heartbeat, token, cost, or duration data.

## API design

### Retry

```text
POST /api/boards/{slug}/tasks/{id}/retry
```

Allowed source states: `blocked`, `review`, `done` only when explicitly requested by UI policy.

Behavior:

- Reset status to `todo`.
- Clear `consecutive_failures`.
- Preserve task body, workspace, assignee, and result history.
- Emit `status_changed` and `retry_requested` events.
- Reject `running` with HTTP 409.

### Release

```text
POST /api/boards/{slug}/tasks/{id}/release
```

Allowed only when task is `running` and health is stale (`stuck` or `lost`).

Behavior:

- Clear dispatcher-owned runtime fields through one domain method.
- Set status to `todo`.
- Emit `status_changed` and `run_released` events with source `run-control`.
- Reject healthy or recently-active runs with HTTP 409.
- Never delete logs or event history.

The stale decision must be rechecked inside the write transaction. UI health state is advisory only.

### Clone

```text
POST /api/boards/{slug}/tasks/{id}/clone
```

Behavior:

- Create new task with new ID and status `todo`.
- Copy title, body, workspace, priority, assignee, and kind where supported.
- Do not copy runtime fields, result, failure count, lock, PID, or run ID.
- Emit `task_cloned` on source and `task_created` on clone.
- Return created task.

### Task health

```text
GET /api/boards/{slug}/tasks/{id}/health
```

Response fields:

```json
{
  "task_id": "t_example",
  "status": "running",
  "health": "healthy",
  "last_activity_at": "2026-09-08T00:00:00Z",
  "age_seconds": 42,
  "source": "log_mtime",
  "reason": "recent task log activity"
}
```

Health states:

- `not_running`: task is not running.
- `healthy`: running task has activity within 5 minutes.
- `silent`: no activity for 5–10 minutes.
- `stuck`: no activity for more than 10 minutes.
- `lost`: known remote node is disconnected or unreachable.
- `unknown`: required activity data is unavailable.

Thresholds are server constants in the first slice. Do not expose settings until real usage proves need.

### Overview health

Extend existing `GET /api/overview` with a health summary only:

```json
{
  "task_health": {
    "healthy": 2,
    "silent": 1,
    "stuck": 0,
    "lost": 0,
    "unknown": 0
  }
}
```

Existing overview fields remain unchanged.

### SSE stream

```text
GET /api/events/stream
```

Initial event types:

- `task_created`
- `task_updated`
- `status_changed`
- `task_event`
- `workspace_ping`
- `node_health`

Event envelope:

```text
event: status_changed
id: 12345
data: {"board":"default","task_id":"t_example","status":"review"}
```

Rules:

- Require existing API session auth.
- Set `Content-Type: text/event-stream`, `Cache-Control: no-cache`, and connection flush.
- Use bounded in-memory subscriber channels.
- Slow/disconnected clients are removed; never block task writes.
- Send heartbeat comments periodically to keep proxies alive.
- Existing polling remains active as fallback.
- No replay store in first slice. Client reconnect triggers normal refetch.

## Backend design

- Add health calculation in `internal/kanban`, independent from HTTP handlers.
- Reuse existing board DB access and task event insertion helpers.
- Add a small event hub owned by the HTTP server process.
- Broadcast only after successful DB/state mutation.
- Keep event payloads small and human-debuggable.
- Avoid changing node-agent transport or worker protocol.
- Ensure release clears only fields already owned by dispatcher recovery semantics.

## Frontend design

### Board

- Subscribe once while board route is mounted.
- Invalidate/refetch board task query on relevant task events.
- Keep existing polling as fallback.
- Running cards show health state only when meaningful.
- Show `Release` only for `stuck` or `lost` tasks.

### Task detail

- Subscribe while detail page/drawer is open.
- Refresh events, comments, task row, and health on matching task events.
- Keep stop/retry/release actions visible according to server response.
- Render API errors in existing alert pattern.

### Flow and overview

Not part of first frontend slice. Keep current polling until board/detail SSE behavior is stable.

## Error handling

- `400`: malformed request or unsupported source state.
- `404`: board/task not found.
- `409`: state changed, task running, or health no longer qualifies.
- `503`: SSE unavailable only if server cannot establish stream; normal API remains usable.
- Frontend reconnects with bounded backoff, then refetches.
- No optimistic state for retry/release/clone.

## Tests

### Backend unit tests

- Retry allowed/denied states.
- Release allowed only for stale running task.
- Release rejected for healthy running task.
- Clone excludes runtime fields and result.
- Health threshold boundaries: 5m, 10m, just over 10m.
- Missing log and disconnected node produce `unknown`/`lost` as specified.
- Event hub subscriber receives event.
- Slow subscriber does not block publisher.

### Backend HTTP tests

- Auth required for SSE and mutations.
- Retry/release/clone response shapes.
- Concurrent stale release recheck returns 409 when state changed.
- SSE headers and event envelope.

### Frontend verification

- `pnpm build`.
- Board refetches on matching SSE event.
- Detail view refreshes on matching task event.
- Polling fallback remains enabled.
- Release action hidden for healthy tasks.

## Progress checklist

### Discovery and design

- [x] Confirm current API routes and task event model.
- [x] Confirm `stop` already exists; do not duplicate endpoint.
- [x] Confirm `running` and runtime columns are dispatcher-owned.
- [x] Define API contracts and health states.
- [x] Define SSE envelope and fallback behavior.
- [ ] User reviews and approves this design.

### Backend implementation

- [ ] Add health domain types and calculation tests.
- [ ] Add retry domain operation and route.
- [ ] Add stale release domain operation and route.
- [ ] Add clone domain operation and route.
- [ ] Add task health route.
- [ ] Extend overview with health summary.
- [ ] Add SSE event hub and stream route.
- [ ] Broadcast after successful task/workspace mutations.
- [ ] Add backend HTTP tests.

### Frontend implementation

- [ ] Add typed API methods.
- [ ] Add SSE client hook with reconnect/backoff.
- [ ] Connect board invalidation to SSE.
- [ ] Connect task detail refresh to SSE.
- [ ] Add health indicator to running task surfaces.
- [ ] Add retry/release/clone actions with error handling.
- [ ] Keep polling fallback.

### Verification

- [ ] `go vet ./...`.
- [ ] `go test ./...`.
- [ ] `go build ./cmd/server`.
- [ ] `pnpm build` in `web/`.
- [ ] Authenticated curl smoke test for new endpoints.
- [ ] SSE event smoke test after task mutation.
- [ ] Confirm git diff only contains requested scope.

## Acceptance criteria

- A stale running task is visible as `stuck` or `lost` without manual log inspection.
- Healthy running task cannot be released accidentally.
- Retry, release, and clone produce auditable events.
- Release race is safe when task state changes between read and write.
- Board and task detail update without waiting for polling when SSE is connected.
- Existing polling continues to work when SSE is unavailable.
- Existing dispatcher, SSH remote routing, node-agent transport, and review gate behavior remain intact.
- All verification commands pass before implementation is marked complete.

## Implementation order

1. Health domain + tests.
2. Retry/release/clone domain + tests.
3. HTTP routes + auth smoke tests.
4. SSE hub + mutation broadcasts.
5. Frontend API/client integration.
6. Fresh full verification.
