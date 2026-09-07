package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"kanban-board/internal/kanban"

	_ "modernc.org/sqlite"
)

// reviewGate implements the review column backend:
//   GET  /api/boards/{slug}/tasks/{id}/diff     -> git diff (full, inline)
//   POST /api/boards/{slug}/tasks/{id}/approve  -> {"action":"commit"|"commit_push"}
//
// Both run git ON the workspace host over SSH (workspace_transport=ssh).
// Approve is the ONLY path from review -> done; the plain status PATCH
// endpoint refuses that transition (see guard in main.go).

const diffLimit = 100 << 10 // 100KB truncation cap for raw diff output

type reviewTask struct {
	ID            string
	Title         string
	Status        string
	WorkspacePath string
	Transport     string
	SSHTarget     string
}

func loadReviewTask(slug, id string) (*reviewTask, error) {
	db, err := sql.Open("sqlite", "file:"+kanban.BoardDBPath(slug)+"?_pragma=busy_timeout(5000)&_pragma=journal_mode(WAL)")
	if err != nil {
		return nil, err
	}
	defer db.Close()
	t := &reviewTask{}
	err = db.QueryRow(`SELECT id, title, status, workspace_path,
		COALESCE(workspace_transport,''), COALESCE(workspace_ssh_target,'mac-tailscale')
		FROM tasks WHERE id=?`, id).
		Scan(&t.ID, &t.Title, &t.Status, &t.WorkspacePath, &t.Transport, &t.SSHTarget)
	if err != nil {
		return nil, err
	}
	return t, nil
}

// runGit executes a git command inside the task workspace over SSH.
func runGit(t *reviewTask, args string) (string, int) {
	target := taskSSHTarget(t.SSHTarget)
	return sshRun(target, t.WorkspacePath, args)
}

func handleTaskDiff(w http.ResponseWriter, r *http.Request) {
	slug, id := r.PathValue("slug"), r.PathValue("id")
	t, err := loadReviewTask(slug, id)
	if err != nil {
		fail(w, err, 404)
		return
	}
	if t.Status != "review" {
		fail(w, fmt.Errorf("task not in review (status=%s)", t.Status), 400)
		return
	}
	if t.Transport != "ssh" {
		fail(w, fmt.Errorf("unsupported transport %q for diff", t.Transport), 400)
		return
	}
	stat, code1 := runGit(t, `git diff --stat HEAD -- . | tail -20`)
	diff, code2 := runGit(t, `git diff HEAD -- .`)
	if code1 != 0 && code2 != 0 {
		fail(w, fmt.Errorf("git diff failed: %s", truncate(stat, 300)), 500)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{
		"stat": truncate(stat, 4000),
		"diff": truncate(diff, diffLimit),
	})
}

func handleTaskApprove(w http.ResponseWriter, r *http.Request) {
	slug, id := r.PathValue("slug"), r.PathValue("id")
	var req struct {
		Action  string `json:"action"`            // commit | commit_push
		Message string `json:"message,omitempty"` // optional commit message override
	}
	body, _ := io.ReadAll(io.LimitReader(r.Body, 1<<16))
	if err := json.Unmarshal(body, &req); err != nil {
		fail(w, err, 400)
		return
	}
	if req.Action != "commit" && req.Action != "commit_push" {
		fail(w, fmt.Errorf("action must be commit or commit_push"), 400)
		return
	}
	t, err := loadReviewTask(slug, id)
	if err != nil {
		fail(w, err, 404)
		return
	}
	if t.Status != "review" {
		fail(w, fmt.Errorf("task not in review (status=%s)", t.Status), 400)
		return
	}
	if t.Transport != "ssh" {
		fail(w, fmt.Errorf("unsupported transport %q for approve", t.Transport), 400)
		return
	}

	msg := req.Message
	if msg == "" {
		msg = t.Title
	}
	msg = strings.ReplaceAll(msg, "\"", "'") // shell-safe one level

	script := fmt.Sprintf("git add -A && git commit -m \"%s\"", msg)
	if req.Action == "commit_push" {
		script += " && git push"
	}
	out, code := runGit(t, script)
	if code != 0 {
		fail(w, fmt.Errorf("git failed (exit %d): %s", code, truncate(out, 500)), 500)
		return
	}
	if err := kanban.StatusTransition(slug, id, "done"); err != nil {
		fail(w, err, 500)
		return
	}
	db, err := sql.Open("sqlite", "file:"+kanban.BoardDBPath(slug)+"?_pragma=busy_timeout(5000)&_pragma=journal_mode(WAL)")
	if err == nil {
		_, _ = db.Exec(`UPDATE tasks SET completed_at=? WHERE id=?`, time.Now().Unix(), id)
		db.Close()
	}
	writeJSON(w, http.StatusOK, map[string]any{"status": "done", "output": truncate(out, 4000)})
}
