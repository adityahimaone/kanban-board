package kanban

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"
)

// Reliability core: task run-control (retry/release/clone) + liveness health.
// Spec: docs/specs/2026-09-08-agent-control-plane-reliability-design.md
//
// running is dispatcher-owned: the board never flips a healthy running task.
// Release is the single recovery path for a stale run, guarded by a health
// recheck INSIDE the write transaction so the dispatcher cannot claim the task
// between the API read and the UPDATE.

// Health thresholds (server constants until real usage proves the need for
// tuning UI — spec decision).
const (
	healthSilentAfter = 5 * time.Minute
	healthStuckAfter  = 10 * time.Minute
)

// TaskHealth is the response shape for GET /api/boards/{slug}/tasks/{id}/health.
type TaskHealth struct {
	TaskID         string `json:"task_id"`
	Status         string `json:"status"`
	Health         string `json:"health"`
	LastActivityAt int64  `json:"last_activity_at"`
	AgeSeconds     int64  `json:"age_seconds"`
	Source         string `json:"source"`
	Reason         string `json:"reason"`
}

// classifyHealth is pure so thresholds are unit-testable. nodeLost marks a
// remote workspace whose node is disconnected (health=lost wins over age).
func classifyHealth(status string, lastActivity, now time.Time, nodeLost bool) string {
	if nodeLost && status == "running" {
		return "lost"
	}
	if status != "running" {
		return "not_running"
	}
	age := now.Sub(lastActivity)
	switch {
	case lastActivity.IsZero():
		return "unknown"
	case age >= healthStuckAfter:
		return "stuck"
	case age >= healthSilentAfter:
		return "silent"
	default:
		return "healthy"
	}
}

// taskLogActivity returns the newest mtime among the task's worker log file
// (the worker appends to it while alive) and the task row's own timestamps
// (started_at is the fallback when the log does not exist yet).
func taskLogActivity(slug, taskID string, startedAt *int64) (time.Time, string) {
	logPath := filepath.Join(boardDir(slug), "logs", taskID+".log")
	var newest time.Time
	source := "task_row"
	if st, err := os.Stat(logPath); err == nil {
		newest = st.ModTime()
		source = "log_mtime"
	}
	if startedAt != nil {
		st := time.Unix(*startedAt, 0)
		if st.After(newest) {
			newest = st
			source = "task_row"
		}
	}
	return newest, source
}

// TaskHealthFor computes liveness for one task.
func TaskHealthFor(slug, taskID string) (TaskHealth, error) {
	db, err := openDB(slug)
	if err != nil {
		return TaskHealth{}, err
	}
	defer db.Close()
	var status string
	var started, completed sql.NullInt64
	err = db.QueryRow(`SELECT status, started_at, completed_at FROM tasks WHERE id=?`, taskID).Scan(&status, &started, &completed)
	if err == sql.ErrNoRows {
		return TaskHealth{}, fmt.Errorf("task not found: %s", taskID)
	}
	if err != nil {
		return TaskHealth{}, err
	}
	h := TaskHealth{TaskID: taskID, Status: status}
	if status != "running" {
		h.Health = "not_running"
		return h, nil
	}
	var startedPtr *int64
	if started.Valid {
		v := started.Int64
		startedPtr = &v
	}
	last, source := taskLogActivity(slug, taskID, startedPtr)
	h.LastActivityAt = last.Unix()
	h.Source = source
	h.Health = classifyHealth(status, last, time.Now(), false)
	h.AgeSeconds = int64(time.Since(last).Seconds())
	switch h.Health {
	case "silent":
		h.Reason = fmt.Sprintf("no activity for %d minutes", int(h.AgeSeconds/60))
	case "stuck":
		h.Reason = fmt.Sprintf("no activity for %d minutes — safe to release", int(h.AgeSeconds/60))
	case "unknown":
		h.Reason = "no log file and no started_at — activity unknown"
	default:
		h.Reason = "recent task log activity"
	}
	return h, nil
}

// RunControlError distinguishes guard failures (409/400) from real errors (500).
type RunControlError struct {
	Code int
	Err  error
}

func (e *RunControlError) Error() string { return e.Err.Error() }

// RetryTask resets a failed/blocked/settled task back to todo so the
// dispatcher respawns it. running is rejected — stop it first.
func RetryTask(slug, taskID string) (Task, error) {
	db, err := openDB(slug)
	if err != nil {
		return Task{}, err
	}
	defer db.Close()
	var status string
	if err := db.QueryRow(`SELECT status FROM tasks WHERE id=?`, taskID).Scan(&status); err == sql.ErrNoRows {
		return Task{}, &RunControlError{Code: 404, Err: fmt.Errorf("task not found: %s", taskID)}
	} else if err != nil {
		return Task{}, err
	}
	if status == "running" {
		return Task{}, &RunControlError{Code: 409, Err: fmt.Errorf("task is running; stop it before retrying")}
	}
	if status == "archived" {
		return Task{}, &RunControlError{Code: 409, Err: fmt.Errorf("task is archived; clone instead")}
	}
	if _, err := db.Exec(`UPDATE tasks SET status='todo', completed_at=NULL, consecutive_failures=0 WHERE id=?`, taskID); err != nil {
		return Task{}, err
	}
	if err := insertEvent(db, taskID, "retry_requested", map[string]any{"source": "run-control", "from": status, "to": "todo"}); err != nil {
		return Task{}, err
	}
	if err := insertEvent(db, taskID, "status_changed", map[string]any{"source": "run-control", "from": status, "to": "todo"}); err != nil {
		return Task{}, err
	}
	broadcastEvent("status_changed", map[string]any{"board": slug, "task_id": taskID, "from": status, "to": "todo"})
	return taskByID(db, taskID)
}

// ReleaseStaleTask force-releases a running task whose log has gone silent
// past the stuck threshold. The health recheck happens inside the same
// transaction as the UPDATE, so a dispatcher claiming the task concurrently
// fails the release instead of double-running.
func ReleaseStaleTask(slug, taskID string) (Task, error) {
	db, err := openDB(slug)
	if err != nil {
		return Task{}, err
	}
	defer db.Close()
	tx, err := db.Begin()
	if err != nil {
		return Task{}, err
	}
	defer tx.Rollback()
	var status string
	var started sql.NullInt64
	if err := tx.QueryRow(`SELECT status, started_at FROM tasks WHERE id=?`, taskID).Scan(&status, &started); err == sql.ErrNoRows {
		return Task{}, &RunControlError{Code: 404, Err: fmt.Errorf("task not found: %s", taskID)}
	} else if err != nil {
		return Task{}, err
	}
	if status != "running" {
		return Task{}, &RunControlError{Code: 409, Err: fmt.Errorf("task is not running (status=%s); nothing to release", status)}
	}
	var startedPtr *int64
	if started.Valid {
		v := started.Int64
		startedPtr = &v
	}
	last, _ := taskLogActivity(slug, taskID, startedPtr)
	if h := classifyHealth("running", last, time.Now(), false); h != "stuck" && h != "lost" {
		return Task{}, &RunControlError{Code: 409, Err: fmt.Errorf("task looks active (health=%s); release is only for stuck/lost runs", h)}
	}
	// Clear dispatcher-owned runtime fields so the respawn starts clean.
	if _, err := tx.Exec(`UPDATE tasks SET status='todo', started_at=NULL, completed_at=NULL, consecutive_failures=0, worker_pid=NULL, current_run_id=NULL, last_heartbeat_at=NULL WHERE id=?`, taskID); err != nil {
		return Task{}, err
	}
	if err := insertEventTx(tx, taskID, "run_released", map[string]any{"source": "run-control", "reason": "stale run released"}); err != nil {
		return Task{}, err
	}
	if err := insertEventTx(tx, taskID, "status_changed", map[string]any{"source": "run-control", "from": "running", "to": "todo"}); err != nil {
		return Task{}, err
	}
	if err := tx.Commit(); err != nil {
		return Task{}, err
	}
	broadcastEvent("status_changed", map[string]any{"board": slug, "task_id": taskID, "from": "running", "to": "todo"})
	return taskByID(db, taskID)
}

// CloneTask copies body/workspace/priority/assignee into a NEW todo task.
// Runtime fields, result, and failure counters are never copied.
func CloneTask(slug, taskID string) (Task, error) {
	db, err := openDB(slug)
	if err != nil {
		return Task{}, err
	}
	defer db.Close()
	var src Task
	err = db.QueryRow(`SELECT id, title, COALESCE(body,''), status, priority, COALESCE(assignee,''), COALESCE(executor,'auto'), COALESCE(command,''), workspace_kind, COALESCE(workspace_path,''), COALESCE(created_by,'') FROM tasks WHERE id=?`, taskID).
		Scan(&src.ID, &src.Title, &src.Body, &src.Status, &src.Priority, &src.Assignee, &src.Executor, &src.Command, &src.WorkspaceKind, &src.WorkspacePath, &src.CreatedBy)
	if err == sql.ErrNoRows {
		return Task{}, &RunControlError{Code: 404, Err: fmt.Errorf("task not found: %s", taskID)}
	} else if err != nil {
		return Task{}, err
	}
	if src.Status == "running" {
		return Task{}, &RunControlError{Code: 409, Err: fmt.Errorf("task is running; clone after it settles")}
	}
	clone := Task{
		Title:         src.Title,
		Body:          src.Body,
		Status:        "todo",
		Priority:      src.Priority,
		Assignee:      src.Assignee,
		Executor:      src.Executor,
		Command:       src.Command,
		WorkspaceKind: src.WorkspaceKind,
		WorkspacePath: src.WorkspacePath,
		CreatedBy:     "run-control-clone",
	}
	if err := CreateTask(slug, &clone); err != nil {
		return Task{}, err
	}
	if db2, err := openDB(slug); err == nil {
		_ = insertEvent(db2, taskID, "task_cloned", map[string]any{"source": "run-control", "clone_id": clone.ID})
		db2.Close()
	}
	broadcastEvent("task_created", map[string]any{"board": slug, "task_id": clone.ID, "cloned_from": taskID})
	return clone, nil
}

func taskByID(db *sql.DB, taskID string) (Task, error) {
	var t Task
	var started, completed sql.NullInt64
	err := db.QueryRow(`SELECT id, title, COALESCE(body,''), status, priority, COALESCE(assignee,''), COALESCE(executor,'auto'), COALESCE(command,''),
		workspace_kind, COALESCE(workspace_path,''), COALESCE(result,''), COALESCE(created_by,''), created_at, started_at, completed_at, consecutive_failures, COALESCE(last_failure_error,'')
		FROM tasks WHERE id=?`, taskID).
		Scan(&t.ID, &t.Title, &t.Body, &t.Status, &t.Priority, &t.Assignee, &t.Executor, &t.Command,
			&t.WorkspaceKind, &t.WorkspacePath, &t.Result, &t.CreatedBy, &t.CreatedAt, &started, &completed, &t.Failures, &t.LastError)
	if err != nil {
		return Task{}, err
	}
	if started.Valid {
		v := started.Int64
		t.StartedAt = &v
	}
	if completed.Valid {
		v := completed.Int64
		t.CompletedAt = &v
	}
	return t, nil
}

// insertEventTx mirrors insertEvent inside an explicit transaction
// (insertEvent opens its own PRAGMA probe on the parent db handle).
func insertEventTx(tx *sql.Tx, taskID, kind string, payload any) error {
	raw, _ := json.Marshal(payload)
	q := `INSERT INTO task_events (task_id, kind, payload, created_at) VALUES (?,?,?,?)`
	_, err := tx.Exec(q, taskID, kind, string(raw), time.Now().Unix())
	return err
}

// OverviewHealthSummary counts liveness across every running task on every board.
func OverviewHealthSummary() map[string]int {
	out := map[string]int{"healthy": 0, "silent": 0, "stuck": 0, "lost": 0, "unknown": 0}
	boards, err := ListBoards()
	if err != nil {
		return out
	}
	now := time.Now()
	for _, b := range boards {
		db, err := openDB(b.Slug)
		if err != nil {
			continue
		}
		rows, err := db.Query(`SELECT id, status, started_at FROM tasks WHERE status='running'`)
		if err != nil {
			db.Close()
			continue
		}
		for rows.Next() {
			var id, status string
			var started sql.NullInt64
			if err := rows.Scan(&id, &status, &started); err != nil {
				continue
			}
			var startedPtr *int64
			if started.Valid {
				v := started.Int64
				startedPtr = &v
			}
			last, _ := taskLogActivity(b.Slug, id, startedPtr)
			out[classifyHealth(status, last, now, false)]++
		}
		rows.Close()
		db.Close()
	}
	return out
}
