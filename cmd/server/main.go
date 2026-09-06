package main

import (
	"encoding/json"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"kanban-board/internal/kanban"
)

func envOr(k, d string) string {
	if v := os.Getenv(k); v != "" { return v }
	return d
}

func writeJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	enc := json.NewEncoder(w)
	enc.SetEscapeHTML(false)
	_ = enc.Encode(v)
}

func fail(w http.ResponseWriter, err error, code int) {
	writeJSON(w, code, map[string]string{"error": err.Error()})
}

func main() {
	addr := envOr("KANBAN_ADDR", "127.0.0.1:8790")
	dist := envOr("KANBAN_WEB_DIST", "web/dist")

	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/boards", func(w http.ResponseWriter, r *http.Request) {
		boards, err := kanban.ListBoards()
		if err != nil { fail(w, err, 500); return }
		writeJSON(w, http.StatusOK, boards)
	})
	mux.HandleFunc("GET /api/boards/{slug}/tasks", func(w http.ResponseWriter, r *http.Request) {
		tasks, err := kanban.ListTasks(r.PathValue("slug"))
		if err != nil { fail(w, err, 500); return }
		writeJSON(w, http.StatusOK, tasks)
	})
	mux.HandleFunc("POST /api/boards/{slug}/tasks", func(w http.ResponseWriter, r *http.Request) {
		var t kanban.Task
		if err := json.NewDecoder(io.LimitReader(r.Body, 1<<20)).Decode(&t); err != nil { fail(w, err, 400); return }
		if err := kanban.CreateTask(r.PathValue("slug"), &t); err != nil { fail(w, err, 400); return }
		writeJSON(w, http.StatusCreated, t)
	})
	mux.HandleFunc("PATCH /api/boards/{slug}/tasks/{id}/status", func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Status string `json:"status"`
		}
		if err := json.NewDecoder(io.LimitReader(r.Body, 1<<16)).Decode(&req); err != nil { fail(w, err, 400); return }
		if err := kanban.StatusTransition(r.PathValue("slug"), r.PathValue("id"), req.Status); err != nil { fail(w, err, 400); return }
		writeJSON(w, http.StatusOK, map[string]string{"status": req.Status})
	})
	mux.HandleFunc("DELETE /api/boards/{slug}/tasks/{id}", func(w http.ResponseWriter, r *http.Request) {
		if err := kanban.ArchiveTask(r.PathValue("slug"), r.PathValue("id")); err != nil { fail(w, err, 400); return }
		writeJSON(w, http.StatusOK, map[string]string{"status": "archived"})
	})
	mux.HandleFunc("GET /api/boards/{slug}/tasks/{id}/events", func(w http.ResponseWriter, r *http.Request) {
		events, err := kanban.TaskEvents(r.PathValue("slug"), r.PathValue("id"))
		if err != nil { fail(w, err, 500); return }
		writeJSON(w, http.StatusOK, events)
	})
	mux.HandleFunc("GET /api/workspaces", func(w http.ResponseWriter, r *http.Request) {
		raw, err := os.ReadFile(filepath.Join(kanban.HermesHome(), "workspaces.json"))
		if err != nil { fail(w, err, 500); return }
		var f struct {
			Workspaces []kanban.Workspace `json:"workspaces"`
		}
		if err := json.Unmarshal(raw, &f); err != nil { fail(w, err, 500); return }
		writeJSON(w, http.StatusOK, f.Workspaces)
	})
	mux.HandleFunc("GET /api/nodes", func(w http.ResponseWriter, r *http.Request) {
		c := &http.Client{Timeout: 2 * time.Second}
		resp, err := c.Get(envOr("KANBAN_NODE_AGENT", "http://127.0.0.1:8788/health"))
		if err != nil {
			writeJSON(w, http.StatusOK, map[string]string{"status": "down", "error": err.Error()})
			return
		}
		defer resp.Body.Close()
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<16))
		writeJSON(w, http.StatusOK, json.RawMessage(body))
	})
	mux.Handle("/", spa(dist))

	log.Printf("kanban-board listening on %s (dist=%s)", addr, dist)
	log.Fatal(http.ListenAndServe(addr, mux))
}

// spa serves the built frontend with index.html fallback for client routes.
func spa(dir string) http.Handler {
	fs := http.FileServer(http.Dir(dir))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.URL.Path, "/api/") {
			http.NotFound(w, r)
			return
		}
		p := filepath.Join(dir, filepath.Clean(r.URL.Path))
		if st, err := os.Stat(p); err == nil && !st.IsDir() {
			fs.ServeHTTP(w, r)
			return
		}
		http.ServeFile(w, r, filepath.Join(dir, "index.html"))
	})
}
