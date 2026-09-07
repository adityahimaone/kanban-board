# kanban-board

Kanban board (Go + React) buat Adit's agentic flow — boards, tasks, flow graph,
workspaces ping, dan dispatcher yang nggak pernah spawn hermes di path yang salah.

## Dispatcher arsitektur (rev 5, 2026-09-07)

**Single dispatcher + hard guard + review gate.** Dirancang buat membunuh permanen
error `pid ... exited with code 3` (hermes di-spawn lokal dengan cwd `/Users/...`
yang nggak ada di Linux VPS).

```
kanban todo ──► ssh-dispatcher (cmd/server/ssh_dispatch.go, poll 30s, single owner)
                 │
                 ├─ hard guard: workspace /Users/... atau C:\ + transport kosong
                 │  → auto-fix transport='ssh' + target='mac-tailscale' SEBELUM spawn
                 │  → hermes lokal TIDAK PERNAH lihat path remote lagi
                 │
                 ├─ transport=ssh → `hermes chat -q … --oneshot --cli` di VPS;
                 │                    agent akses file Mac via `ssh mac-tailscale "…"`
                 │                    (codegraph/FILE_INDEX → grep/read/edit → verify)
                 │
                 └─ transport=node-agent → POST :8788 /api/dispatch (queue node-agent)

success → status='review' (BUKAN done)
failure → retry ×3 → blocked
gateway dispatch_in_gateway=false → tidak ada race claim lagi
```

### Review gate (kolom review)

Task sukses **wajib** lewat kolom `review`; satu-satunya jalan ke `done` adalah approve:

- `GET /api/boards/{slug}/tasks/{id}/diff` — `git diff --stat HEAD` + `git diff HEAD`
  dijalankan DI host workspace via SSH (scoped `-- .`, truncate 100KB).
- `POST /api/boards/{slug}/tasks/{id}/approve` — body `{"action":"commit"|"commit_push"}`
  (opsional `message`). Menjalankan `git add -A && git commit [-m msg] [&& git push]`
  via SSH, lalu `StatusTransition → done`.
- PATCH status biasa **menolak** `review → done` (400) — cuma lewat approve.

UI: `TaskDetailPage` → `ReviewSection` (full diff inline scrollable + dropdown
Commit / Commit & Push). Catatan: workspace harus repo git beneran (mis. `saas/gadjian/app`);
workspace folder biasa yang kebetulan di bawah repo HOME akan resolve ke repo salah.

### Validasi workspace

`internal/kanban/workspace_validate.go`: exact-match **dan sub-path** dari workspace
remote ter-register (workspaces.json, host non-lokal) diterima; sisanya yang nggak
ada lokal ditolak fail-closed.

### node-agent hook

`internal/kanban/nodeagent.go` `DispatchRemote`: sukses → `review` (konsisten dengan
review gate). Server node-agent meng-inject `PrequestNote` dari field `note`
workspaces.json; agent menjalankan `ensureCodegraph` + `readPrequest` sebelum eksekusi.

## API utama

| Method | Path | Fungsi |
|---|---|---|
| GET/POST | `/api/boards`, `/api/boards/{slug}/tasks` | board & task CRUD |
| PATCH | `/api/boards/{slug}/tasks/{id}/status` | pindah kolom (review→done ditolak) |
| GET | `/api/boards/{slug}/tasks/{id}/diff` | git diff remote workspace (review) |
| POST | `/api/boards/{slug}/tasks/{id}/approve` | commit / commit&push → done |
| GET/POST/PUT/DELETE | `/api/workspaces*` | workspaces.json + ping/health |
| GET | `/api/flow/active` | live flow graph (dispatch→running→done/failed) |
| POST | `/api/remote/dispatch` | manual dispatch via node-agent |

## Build & deploy (VPS)

```sh
cd ~/apps/kanban-board
go vet ./... && go test ./internal/kanban/
go build -o bin/kanban-board ./cmd/server
cd web && pnpm build          # output web/dist, diserve SPA
pm2 restart kanban-board      # :8790, nginx → kanban.adityahimaone.space
```

Catatan VPS RAM 2GB: stop app PM2 besar sebelum `pnpm build` kalau perlu.

## Config terkait

- `~/.hermes/config.yaml` → `kanban.dispatch_in_gateway: false` (WAJIB — race claim)
- `~/.hermes/workspaces.json` → sumber kebenaran workspace + `note` (prequest)
- `~/.hermes/node-agent.env` → `NODE_AGENT_TOKEN` (chmod 600)
- Env opsional: `KANBAN_NODE_AGENT` (base URL node-agent), `KANBAN_SSH_TARGET` (override target)

## Desain

`docs/specs/2026-09-07-single-dispatcher-review-gate-design.md` — keputusan lengkap
(single dispatcher, hard guard, review gate, codegraph di node-agent, non-goals).
