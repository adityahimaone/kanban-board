package main

import (
	"bytes"
	"database/sql"
	"fmt"
	"log"
	"os"
	"os/exec"
	"strings"
	"time"

	"kanban-board/internal/kanban"

	_ "modernc.org/sqlite"
)

// StartSSHDispatcher polls all boards every 30s for todo tasks with
// workspace_transport='ssh' and runs them via hermes chat on VPS,
// using SSH to access remote Mac filesystem. No local Mac hermes needed.
// This is the SINGLE dispatcher (gateway dispatch_in_gateway=false): every
// success lands in 'review', never 'done' — approval via /approve only.
func StartSSHDispatcher() {
	go func() {
		for {
			time.Sleep(30 * time.Second)
			dispatchSSHTasks()
		}
	}()
	log.Println("ssh-dispatcher: started (poll 30s)")
}

// hardGuardTransport is the permanent exit-code-3 killer: any todo task whose
// workspace path can't exist on this VPS (/Users/..., C:\...) but has no ssh
// transport gets auto-fixed to ssh BEFORE anything spawns. If a path looks
// remote and transport is already 'node-agent' or 'ssh', it is left alone.
func hardGuardTransport(db *sql.DB, id, ws, transport, target string) (string, string) {
	remote := strings.HasPrefix(ws, "/Users/") || strings.HasPrefix(ws, "C:\\") || strings.HasPrefix(ws, "C:/")
	if !remote || transport == "ssh" || transport == "node-agent" {
		return transport, target
	}
	tgt := target
	if tgt == "" {
		tgt = "mac-tailscale"
	}
	_, _ = db.Exec(`UPDATE tasks SET workspace_transport='ssh', workspace_ssh_target=? WHERE id=?`, tgt, id)
	log.Printf("ssh-dispatcher: hard guard fixed %s transport %q->ssh (remote path %s)", id, transport, ws)
	return "ssh", tgt
}

func dispatchSSHTasks() {
	boards, err := kanban.ListBoards()
	if err != nil {
		return
	}
	for _, b := range boards {
		dbPath := kanban.BoardDBPath(b.Slug)
		db, err := sql.Open("sqlite", "file:"+dbPath+"?_pragma=busy_timeout(5000)&_pragma=journal_mode(WAL)")
		if err != nil {
			continue
		}
		rows, err := db.Query(`SELECT id, title, COALESCE(body,''), workspace_path, workspace_transport, COALESCE(workspace_ssh_target,'mac-tailscale') FROM tasks WHERE status='todo' AND workspace_transport='ssh' LIMIT 2`)
		if err != nil {
			db.Close()
			continue
		}
		type row struct{ id, title, body, ws, transport, sshTarget string }
		var pending []row
		for rows.Next() {
			var r row
			if err := rows.Scan(&r.id, &r.title, &r.body, &r.ws, &r.transport, &r.sshTarget); err == nil && r.ws != "" {
				pending = append(pending, r)
			}
		}
		rows.Close()

		for _, r := range pending {
			// hard guard runs before claim: never spawn local for remote paths
			r.transport, r.sshTarget = hardGuardTransport(db, r.id, r.ws, r.transport, r.sshTarget)

			// claim: persist start time so every UI surface measures same run
			startedAt := time.Now().Unix()
			_, _ = db.Exec(`UPDATE tasks SET status='running', started_at=?, completed_at=NULL, consecutive_failures=0 WHERE id=? AND status='todo'`, startedAt, r.id)
			db.Close()

			msg := r.body
			if msg == "" {
				msg = r.title
			}
			target := r.sshTarget
			if target == "" {
				target = "mac-tailscale"
			}

			log.Printf("ssh-dispatcher: running %s (%s) via hermes chat + SSH to %s", r.id, b.Slug, target)
			// sync Flow view: orchestrator (VPS hermes) -> mac lane while running
			node := "mac"
			if target == "windows-tailscale" {
				node = "windows"
			}
			kanban.FlowTrack(r.id, r.title, b.Slug, node, kanban.FlowRunning)

			output, success := runHemesViaSSH(r.id, r.title, msg, r.ws, target, b.Slug)

			// reopen DB for result write
			db2, err := sql.Open("sqlite", "file:"+dbPath+"?_pragma=busy_timeout(5000)&_pragma=journal_mode(WAL)")
			if err != nil {
				continue
			}
			now := time.Now().Unix()
			if success {
				// review gate: success NEVER lands done — approve flow moves it
				_, _ = db2.Exec(`UPDATE tasks SET status='review', completed_at=?, result=? WHERE id=?`, now, output, r.id)
				kanban.FlowTrack(r.id, r.title, b.Slug, node, kanban.FlowDone)
				log.Printf("ssh-dispatcher: %s completed -> review", r.id)
			} else {
				failures := 1
				_ = db2.QueryRow(`SELECT COALESCE(consecutive_failures,0)+1 FROM tasks WHERE id=?`, r.id).Scan(&failures)
				newStatus := "blocked"
				if failures < 3 {
					newStatus = "todo" // retry
				}
				_, _ = db2.Exec(`UPDATE tasks SET status=?, consecutive_failures=?, last_failure_error=?, completed_at=? WHERE id=?`,
					newStatus, failures, truncate(output, 500), now, r.id)
				kanban.FlowTrack(r.id, r.title, b.Slug, node, kanban.FlowFailed)
				log.Printf("ssh-dispatcher: %s failed (attempt %d): %s", r.id, failures, truncate(output, 200))
			}
			db2.Close()
		}
		if len(pending) == 0 {
			db.Close()
		}
	}
}

func runHemesViaSSH(taskID, title, message, workspacePath, sshTarget, board string) (string, bool) {
	systemPrompt := fmt.Sprintf(`You are a coding agent running on a VPS. The project files are on a remote Mac accessible via SSH.

WORKSPACE: %s (on Mac, SSH target: %s)
TASK: %s

RULES:
1. To read/edit/search files, use: ssh -o BatchMode=yes -o ConnectTimeout=10 %s "<command>"
   Example: ssh %s "cat %s/gadjian/app/controller/Tagihan.php | head -50"
   Example: ssh %s "cd %s && grep -rn 'notes_log' gadjian/"
2. Always prefix file paths with the workspace path when running commands on Mac.
3. If you need to edit a file, use: ssh %s "sed -i '' 's/old/new/g' %s/path/to/file"
4. Before starting, check if FILE_INDEX.json exists: ssh %s "cat %s/FILE_INDEX.json 2>/dev/null | head -100"
   This is the codegraph index — use it to understand project structure.
5. Work step by step: read codegraph -> find relevant files -> read files -> make changes -> verify.
6. Do NOT commit or push — changes stay uncommitted in the working tree; a human reviews and approves.
7. When done, summarize what you changed.

Be concise. Do the work. Don't ask questions.`,
		workspacePath, sshTarget, message,
		sshTarget, sshTarget, workspacePath,
		sshTarget, workspacePath,
		sshTarget, workspacePath,
		sshTarget, workspacePath,
	)

	fullPrompt := fmt.Sprintf("%s\n\nTask details:\n%s", systemPrompt, message)

	// Run hermes chat on VPS (oneshot: answer and exit, no TTY hang)
	cmd := exec.Command("hermes", "chat", "-q", fullPrompt, "--oneshot", "--cli")
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	// Timeout: 25 minutes max per task (coding tasks need many tool calls)
	done := make(chan error, 1)
	go func() { done <- cmd.Run() }()

	select {
	case err := <-done:
		output := stdout.String()
		if output == "" {
			output = stderr.String()
		}
		if err != nil {
			return fmt.Sprintf("hermes chat error: %v\n%s", err, output), false
		}
		return output, true
	case <-time.After(25 * time.Minute):
		if cmd.Process != nil {
			_ = cmd.Process.Kill()
		}
		return "timeout after 25 minutes", false
	}
}

// sshRun executes one command on the given SSH target and returns combined
// output. Used by the diff/approve endpoints. BatchMode: no prompts ever.
func sshRun(target, workdir, script string) (string, int) {
	if workdir != "" {
		script = "cd " + workdir + " && " + script
	}
	cmd := exec.Command("ssh", "-o", "BatchMode=yes", "-o", "ConnectTimeout=15", target, script)
	var out bytes.Buffer
	cmd.Stdout = &out
	cmd.Stderr = &out
	err := cmd.Run()
	code := 0
	if err != nil {
		code = 1
		if ee, ok := err.(*exec.ExitError); ok {
			code = ee.ExitCode()
		}
	}
	return out.String(), code
}

// taskSSHTarget resolves the ssh target for a task row (default mac-tailscale).
func taskSSHTarget(target string) string {
	if target == "" {
		return "mac-tailscale"
	}
	if os.Getenv("KANBAN_SSH_TARGET") != "" {
		return os.Getenv("KANBAN_SSH_TARGET")
	}
	return target
}

func truncate(s string, max int) string {
	s = strings.TrimSpace(s)
	if len(s) > max {
		return s[:max] + "..."
	}
	return s
}
