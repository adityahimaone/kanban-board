package kanban

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	_ "modernc.org/sqlite"
)

// Valid statuses (mirror hermes kanban_db.py VALID_STATUSES).
var ValidStatuses = map[string]bool{
	"triage": true, "todo": true, "scheduled": true, "ready": true, "running": true,
	"blocked": true, "review": true, "done": true, "archived": true,
}

// Columns the dispatcher owns — board UI must never write these.
var dispatcherOwned = []string{"claim_lock", "consecutive_failures", "worker_pid", "current_run_id", "last_heartbeat_at"}

type Board struct {
	Slug           string `json:"slug"`
	Name           string `json:"name"`
	Icon           string `json:"icon"`
	Color          string `json:"color"`
	DefaultWorkdir string `json:"default_workdir"`
}

type Task struct {
	ID            string  `json:"id"`
	Title         string  `json:"title"`
	Body          string  `json:"body"`
	Status        string  `json:"status"`
	Priority      int     `json:"priority"`
	Assignee      string  `json:"assignee"`
	WorkspaceKind string  `json:"workspace_kind"`
	WorkspacePath string  `json:"workspace_path"`
	Result        string  `json:"result"`
	CreatedBy     string  `json:"created_by"`
	CreatedAt     int64   `json:"created_at"`
	StartedAt     *int64  `json:"started_at"`
	CompletedAt   *int64  `json:"completed_at"`
	Failures      int     `json:"consecutive_failures"`
	LastError     string  `json:"last_failure_error"`
}

type TaskEvent struct {
	ID        int64  `json:"id"`
	TaskID    string `json:"task_id"`
	Kind      string `json:"kind"`
	Payload   string `json:"payload"`
	CreatedAt int64  `json:"created_at"`
}

func hermesHome() string {
	if h := os.Getenv("HERMES_HOME"); h != "" { return h }
	home, _ := os.UserHomeDir()
	return filepath.Join(home, ".hermes")
}

func HermesHome() string { return hermesHome() }

func boardDir(slug string) string {
	if slug == "default" { return filepath.Join(hermesHome()) }
	return filepath.Join(hermesHome(), "kanban", "boards", slug)
}

func BoardDBPath(slug string) string { return filepath.Join(boardDir(slug), "kanban.db") }

type Workspace struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	Path string `json:"path"`
	Host string `json:"host"`
	Kind string `json:"kind"`
}

func openDB(slug string) (*sql.DB, error) {
	path := BoardDBPath(slug)
	if _, err := os.Stat(path); err != nil { return nil, fmt.Errorf("board %q not found: %w", slug, err) }
	// WAL + busy_timeout so hermes CLI and this server can share the file.
	dsn := fmt.Sprintf("file:%s?_pragma=busy_timeout(5000)&_pragma=journal_mode(WAL)", path)
	db, err := sql.Open("sqlite", dsn)
	if err != nil { return nil, err }
	db.SetMaxOpenConns(1) // serialize writers; SQLite single-writer anyway
	return db, nil
}

// ListBoards scans ~/.hermes/kanban/boards/*/board.json (+ legacy default kanban.db).
func ListBoards() ([]Board, error) {
	out := []Board{}
	root := filepath.Join(hermesHome(), "kanban", "boards")
	entries, err := os.ReadDir(root)
	if err == nil {
		for _, e := range entries {
			if !e.IsDir() { continue }
			metaPath := filepath.Join(root, e.Name(), "board.json")
			raw, err := os.ReadFile(metaPath)
			if err != nil { continue }
			var b Board
			if err := json.Unmarshal(raw, &b); err != nil { continue }
			if b.ArchivedSkip() { continue }
			out = append(out, b)
		}
	}
	// legacy default board — skip if a boards/default/board.json already provided it
	seen := map[string]bool{}
	for _, b := range out { seen[b.Slug] = true }
	if !seen["default"] {
		if _, err := os.Stat(filepath.Join(hermesHome(), "kanban.db")); err == nil {
			out = append(out, Board{Slug: "default", Name: "Default", Icon: "default"})
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Slug < out[j].Slug })
	return out, nil
}

type boardMeta struct {
	Archived bool `json:"archived"`
}

func (b Board) ArchivedSkip() bool {
	raw, err := os.ReadFile(filepath.Join(boardDir(b.Slug), "board.json"))
	if err != nil { return false }
	var m boardMeta
	if json.Unmarshal(raw, &m) == nil { return m.Archived }
	return false
}

func ListTasks(slug string) ([]Task, error) {
	db, err := openDB(slug)
	if err != nil { return nil, err }
	defer db.Close()
	rows, err := db.Query(`
		SELECT id, title, COALESCE(body,''), status, priority, COALESCE(assignee,''),
		       workspace_kind, COALESCE(workspace_path,''), COALESCE(result,''),
		       COALESCE(created_by,''), created_at, started_at, completed_at,
		       consecutive_failures, COALESCE(last_failure_error,'')
		FROM tasks ORDER BY priority DESC, created_at DESC`)
	if err != nil { return nil, err }
	defer rows.Close()
	out := []Task{}
	for rows.Next() {
		var t Task
		var started, completed sql.NullInt64
		if err := rows.Scan(&t.ID, &t.Title, &t.Body, &t.Status, &t.Priority, &t.Assignee,
			&t.WorkspaceKind, &t.WorkspacePath, &t.Result, &t.CreatedBy, &t.CreatedAt,
			&started, &completed, &t.Failures, &t.LastError); err != nil { return nil, err }
		if started.Valid { v := started.Int64; t.StartedAt = &v }
		if completed.Valid { v := completed.Int64; t.CompletedAt = &v }
		out = append(out, t)
	}
	return out, rows.Err()
}

func CreateTask(slug string, t *Task) error {
	if strings.TrimSpace(t.Title) == "" { return fmt.Errorf("title required") }
	if t.Status == "" { t.Status = "todo" }
	if !ValidStatuses[t.Status] { return fmt.Errorf("invalid status %q", t.Status) }
	if t.Status == "running" { return fmt.Errorf("status 'running' is dispatcher-owned; use todo/ready/triage") }
	if t.ID == "" { t.ID = newTaskID() }
	if t.CreatedBy == "" { t.CreatedBy = "board-ui" }
	if t.WorkspaceKind == "" { t.WorkspaceKind = "scratch" }
	t.Title = strings.TrimSpace(t.Title)
	t.CreatedAt = time.Now().Unix()
	db, err := openDB(slug)
	if err != nil { return err }
	defer db.Close()
	_, err = db.Exec(`INSERT INTO tasks (id, title, body, status, priority, assignee, workspace_kind, workspace_path, created_by, created_at)
		VALUES (?,?,?,?,?,?,?,?,?,?)`,
		t.ID, t.Title, t.Body, t.Status, t.Priority, t.Assignee, t.WorkspaceKind, t.WorkspacePath, t.CreatedBy, t.CreatedAt)
	if err != nil { return err }
	return insertEvent(db, t.ID, "created", map[string]any{"source": "board-ui", "status": t.Status})
}

// StatusTransition moves a task between board-managed statuses. Refuses to touch
// dispatcher-owned fields or an in-flight running task's claims.
func StatusTransition(slug, taskID, to string) error {
	if !ValidStatuses[to] { return fmt.Errorf("invalid status %q", to) }
	if to == "running" { return fmt.Errorf("status 'running' is dispatcher-owned") }
	db, err := openDB(slug)
	if err != nil { return err }
	defer db.Close()
	var current string
	if err := db.QueryRow(`SELECT status FROM tasks WHERE id=?`, taskID).Scan(&current); err != nil {
		return fmt.Errorf("task not found: %w", err)
	}
	if current == "running" && to != "blocked" && to != "done" && to != "review" {
		return fmt.Errorf("task is running (dispatcher-owned); allowed: blocked/done/review")
	}
	now := time.Now().Unix()
	var completed any
	if to == "done" || to == "archived" { completed = now }
	if _, err := db.Exec(`UPDATE tasks SET status=?, completed_at=COALESCE(?, completed_at) WHERE id=?`, to, completed, taskID); err != nil {
		return err
	}
	return insertEvent(db, taskID, "status_changed", map[string]any{"source": "board-ui", "from": current, "to": to})
}

func ArchiveTask(slug, taskID string) error { return StatusTransition(slug, taskID, "archived") }

func TaskEvents(slug, taskID string) ([]TaskEvent, error) {
	db, err := openDB(slug)
	if err != nil { return nil, err }
	defer db.Close()
	// payload column is `payload` on this host, `payload_json` on newer hermes — probe.
	payloadCol := "payload"
	if rows2, err2 := db.Query(`PRAGMA table_info(task_events)`); err2 == nil {
		for rows2.Next() {
			var cid int
			var cname, ctype string
			var nn int
			var dflt any
			var pk int
			_ = rows2.Scan(&cid, &cname, &ctype, &nn, &dflt, &pk)
			if cname == "payload_json" { payloadCol = "payload_json" }
		}
		rows2.Close()
	}
	q := fmt.Sprintf(`SELECT id, task_id, kind, COALESCE(%s,''), created_at FROM task_events WHERE task_id=? ORDER BY id DESC LIMIT 100`, payloadCol)
	rows, err := db.Query(q, taskID)
	if err != nil { return nil, err }
	defer rows.Close()
	out := []TaskEvent{}
	for rows.Next() {
		var e TaskEvent
		if err := rows.Scan(&e.ID, &e.TaskID, &e.Kind, &e.Payload, &e.CreatedAt); err != nil { return nil, err }
		out = append(out, e)
	}
	return out, rows.Err()
}

func insertEvent(db *sql.DB, taskID, kind string, payload any) error {
	raw, _ := json.Marshal(payload)
	// hermes schema stores json payload in payload_json (newer) or payload (older)
	cols, err := db.Query(`PRAGMA table_info(task_events)`)
	if err != nil { return err }
	defer cols.Close()
	name := "payload"
	hasTS := false
	for cols.Next() {
		var cid int
		var cname, ctype string
		var notNull int
		var dflt any
		var pk int
		if err := cols.Scan(&cid, &cname, &ctype, &notNull, &dflt, &pk); err != nil { continue }
		if cname == "payload_json" { name = "payload_json" }
		if cname == "created_at" { hasTS = true }
	}
	if hasTS {
		q := fmt.Sprintf(`INSERT INTO task_events (task_id, kind, %s, created_at) VALUES (?,?,?,?)`, name)
		_, err = db.Exec(q, taskID, kind, string(raw), time.Now().Unix())
		return err
	}
	q := fmt.Sprintf(`INSERT INTO task_events (task_id, kind, %s) VALUES (?,?,?)`, name)
	_, err = db.Exec(q, taskID, kind, string(raw))
	return err
}

func newTaskID() string {
	b := time.Now().UnixNano()
	return fmt.Sprintf("t_%08x", b&0xffffffff)
}

var _ = dispatcherOwned
