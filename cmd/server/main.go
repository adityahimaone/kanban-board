package main

import (
	"encoding/json"
	"fmt"
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
		var req struct{ Status string `json:"status"` }
		if err := json.NewDecoder(io.LimitReader(r.Body, 1<<16)).Decode(&req); err != nil { fail(w, err, 400); return }
		// review gate: review->done only via /approve (commit / commit&push)
		if req.Status == "done" {
			if cur, err := kanban.TaskStatus(r.PathValue("slug"), r.PathValue("id")); err == nil && cur == "review" {
				fail(w, fmt.Errorf("review->done only via approve endpoint"), 400); return
			}
		}
		if err := kanban.StatusTransition(r.PathValue("slug"), r.PathValue("id"), req.Status); err != nil { fail(w, err, 400); return }
		writeJSON(w, http.StatusOK, map[string]string{"status": req.Status})
	})
	mux.HandleFunc("DELETE /api/boards/{slug}/tasks/{id}", func(w http.ResponseWriter, r *http.Request) {
		if err := kanban.ArchiveTask(r.PathValue("slug"), r.PathValue("id")); err != nil { fail(w, err, 400); return }
		writeJSON(w, http.StatusOK, map[string]string{"status": "archived"})
	})
	mux.HandleFunc("POST /api/boards", func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Slug  string `json:"slug"`
			Name  string `json:"name"`
			Icon  string `json:"icon"`
			Color string `json:"color"`
		}
		if err := json.NewDecoder(io.LimitReader(r.Body, 1<<16)).Decode(&req); err != nil { fail(w, err, 400); return }
		b, err := kanban.CreateBoard(req.Slug, req.Name, req.Icon, req.Color)
		if err != nil { fail(w, err, 400); return }
		writeJSON(w, http.StatusCreated, b)
	})
	mux.HandleFunc("PATCH /api/boards/{slug}", func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Name  string `json:"name"`
			Icon  string `json:"icon"`
			Color string `json:"color"`
		}
		if err := json.NewDecoder(io.LimitReader(r.Body, 1<<16)).Decode(&req); err != nil { fail(w, err, 400); return }
		b, err := kanban.PatchBoard(r.PathValue("slug"), req.Name, req.Icon, req.Color)
		if err != nil { fail(w, err, 400); return }
		writeJSON(w, http.StatusOK, b)
	})
	mux.HandleFunc("GET /api/boards/{slug}/tasks/{id}/events", func(w http.ResponseWriter, r *http.Request) {
		events, err := kanban.TaskEvents(r.PathValue("slug"), r.PathValue("id"))
		if err != nil { fail(w, err, 500); return }
		writeJSON(w, http.StatusOK, events)
	})
	mux.HandleFunc("GET /api/boards/{slug}/tasks/{id}/comments", func(w http.ResponseWriter, r *http.Request) {
		comments, err := kanban.ListComments(r.PathValue("slug"), r.PathValue("id"))
		if err != nil { fail(w, err, 500); return }
		writeJSON(w, http.StatusOK, comments)
	})
	mux.HandleFunc("POST /api/boards/{slug}/tasks/{id}/comments", func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Author string `json:"author,omitempty"`
			Body   string `json:"body"`
		}
		if err := json.NewDecoder(io.LimitReader(r.Body, 1<<16)).Decode(&req); err != nil { fail(w, err, 400); return }
		c, err := kanban.AddComment(r.PathValue("slug"), r.PathValue("id"), req.Author, req.Body)
		if err != nil { fail(w, err, 400); return }
		writeJSON(w, http.StatusCreated, c)
	})

	// review gate: diff + approve (commit / commit&push) — only path review->done
	mux.HandleFunc("GET /api/boards/{slug}/tasks/{id}/diff", handleTaskDiff)
	mux.HandleFunc("POST /api/boards/{slug}/tasks/{id}/approve", handleTaskApprove)

	// workspaces (shared source of truth: ~/.hermes/workspaces.json)
	mux.HandleFunc("GET /api/workspaces", func(w http.ResponseWriter, r *http.Request) {
		ws, err := kanban.ListWorkspaces()
		if err != nil { fail(w, err, 500); return }
		writeJSON(w, http.StatusOK, ws)
	})
	mux.HandleFunc("POST /api/workspaces", func(w http.ResponseWriter, r *http.Request) {
		var ws kanban.Workspace
		if err := json.NewDecoder(io.LimitReader(r.Body, 1<<16)).Decode(&ws); err != nil { fail(w, err, 400); return }
		if err := kanban.SaveWorkspace(&ws); err != nil { fail(w, err, 400); return }
		writeJSON(w, http.StatusCreated, ws)
	})
	mux.HandleFunc("PUT /api/workspaces/{id}", func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		var ws kanban.Workspace
		if err := json.NewDecoder(io.LimitReader(r.Body, 1<<16)).Decode(&ws); err != nil { fail(w, err, 400); return }
		ws.ID = id
		if err := kanban.SaveWorkspace(&ws); err != nil { fail(w, err, 400); return }
		writeJSON(w, http.StatusOK, ws)
	})
	mux.HandleFunc("DELETE /api/workspaces/{id}", func(w http.ResponseWriter, r *http.Request) {
		if err := kanban.DeleteWorkspace(r.PathValue("id")); err != nil { fail(w, err, 404); return }
		writeJSON(w, http.StatusOK, map[string]string{"deleted": r.PathValue("id")})
	})
	mux.HandleFunc("POST /api/workspaces/ping", func(w http.ResponseWriter, r *http.Request) {
		out, err := kanban.PingAll()
		if err != nil { fail(w, err, 500); return }
		writeJSON(w, http.StatusOK, out)
	})
	mux.HandleFunc("GET /api/workspaces/{id}/ping", func(w http.ResponseWriter, r *http.Request) {
		ws, err := kanban.ListWorkspaces()
		if err != nil { fail(w, err, 500); return }
		for _, e := range ws {
			if e.ID == r.PathValue("id") {
				raw := kanban.PingWorkspace(&e)
				eff := kanban.DebouncedStatus(raw.ID, raw)
				kanban.AppendPingHistory(raw.ID, raw) // raw fail goes to history/EKG
				writeJSON(w, http.StatusOK, eff)
				return
			}
		}
		fail(w, http.ErrMissingFile, 404)
	})
	mux.HandleFunc("GET /api/workspaces/{id}/history", func(w http.ResponseWriter, r *http.Request) {
		pts, err := kanban.GetPingHistory(r.PathValue("id"))
		if err != nil { fail(w, err, 500); return }
		writeJSON(w, http.StatusOK, pts)
	})
	mux.HandleFunc("GET /api/workspaces/{id}/logs", func(w http.ResponseWriter, r *http.Request) {
		ws, err := kanban.ListWorkspaces()
		if err != nil { fail(w, err, 500); return }
		for _, e := range ws {
			if e.ID == r.PathValue("id") {
				logs, err := kanban.WorkspaceLogs(&e, 80)
				if err != nil { fail(w, err, 500); return }
				writeJSON(w, http.StatusOK, logs)
				return
			}
		}
		fail(w, http.ErrMissingFile, 404)
	})

	mux.HandleFunc("GET /api/profiles", func(w http.ResponseWriter, r *http.Request) {
		profiles, err := kanban.ListProfiles()
		if err != nil { fail(w, err, 500); return }
		writeJSON(w, http.StatusOK, profiles)
	})
	mux.HandleFunc("PATCH /api/boards/{slug}/tasks/{id}/assignee", func(w http.ResponseWriter, r *http.Request) {
		var req struct{ Assignee string `json:"assignee"` }
		if err := json.NewDecoder(io.LimitReader(r.Body, 1<<16)).Decode(&req); err != nil { fail(w, err, 400); return }
		if err := kanban.Assign(r.PathValue("slug"), r.PathValue("id"), req.Assignee); err != nil { fail(w, err, 400); return }
		writeJSON(w, http.StatusOK, map[string]string{"assignee": req.Assignee})
	})
	// profiles: full CRUD (mirrors hermes-webui spaces/profile UI)
	mux.HandleFunc("GET /api/profiles-full", func(w http.ResponseWriter, r *http.Request) {
		profiles, err := kanban.ListProfilesFull()
		if err != nil { fail(w, err, 500); return }
		writeJSON(w, http.StatusOK, profiles)
	})
	mux.HandleFunc("GET /api/profiles/{name}", func(w http.ResponseWriter, r *http.Request) {
		p, err := kanban.GetProfile(r.PathValue("name"))
		if err != nil { fail(w, err, 404); return }
		writeJSON(w, http.StatusOK, p)
	})
	mux.HandleFunc("POST /api/profiles", func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Name         string `json:"name"`
			Model        string `json:"model"`
			Provider     string `json:"provider"`
			SystemPrompt string `json:"system_prompt"`
		}
		if err := json.NewDecoder(io.LimitReader(r.Body, 1<<20)).Decode(&req); err != nil { fail(w, err, 400); return }
		in := kanban.ProfileInput{Model: req.Model, Provider: req.Provider}
		sp := req.SystemPrompt
		// treat empty string as "no prompt" only if key missing; JSON can't tell — assume always present
		in.SystemPrompt = &sp
		if err := kanban.CreateProfile(req.Name, in); err != nil { fail(w, err, 400); return }
		p, _ := kanban.GetProfile(req.Name)
		writeJSON(w, http.StatusCreated, p)
	})
	mux.HandleFunc("PUT /api/profiles/{name}", func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Model        *string `json:"model"`
			Provider     *string `json:"provider"`
			SystemPrompt *string `json:"system_prompt"`
		}
		if err := json.NewDecoder(io.LimitReader(r.Body, 1<<20)).Decode(&req); err != nil { fail(w, err, 400); return }
		in := kanban.ProfileInput{}
		if req.Model != nil { in.Model = *req.Model }
		if req.Provider != nil { in.Provider = *req.Provider }
		in.SystemPrompt = req.SystemPrompt
		if err := kanban.PatchProfile(r.PathValue("name"), in); err != nil { fail(w, err, 400); return }
		p, _ := kanban.GetProfile(r.PathValue("name"))
		writeJSON(w, http.StatusOK, p)
	})
	mux.HandleFunc("DELETE /api/profiles/{name}", func(w http.ResponseWriter, r *http.Request) {
		if err := kanban.DeleteProfile(r.PathValue("name")); err != nil { fail(w, err, 400); return }
		writeJSON(w, http.StatusOK, map[string]string{"deleted": r.PathValue("name")})
	})
	mux.HandleFunc("GET /api/providers", func(w http.ResponseWriter, r *http.Request) {
		providers, err := kanban.ListProviders()
		if err != nil { fail(w, err, 500); return }
		writeJSON(w, http.StatusOK, providers)
	})
	mux.HandleFunc("POST /api/ai/improve-prompt", func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Title string `json:"title"`
			Body  string `json:"body"`
		}
		if err := json.NewDecoder(io.LimitReader(r.Body, 1<<16)).Decode(&req); err != nil { fail(w, err, 400); return }
		if strings.TrimSpace(req.Body) == "" { fail(w, fmt.Errorf("body required"), 400); return }
		improved, err := kanban.ImprovePrompt(req.Title, req.Body)
		if err != nil { fail(w, err, 502); return }
		writeJSON(w, http.StatusOK, map[string]string{"improved": improved})
	})
	mux.HandleFunc("GET /api/nodes", func(w http.ResponseWriter, r *http.Request) {
		st, err := kanban.NodeAgentHealth()
		if err != nil { fail(w, err, 500); return }
		writeJSON(w, http.StatusOK, st)
	})
	mux.HandleFunc("GET /api/flow/active", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]any{"tasks": kanban.FlowActive()})
	})
	mux.HandleFunc("POST /api/flow/seed", func(w http.ResponseWriter, r *http.Request) {
		var tasks []kanban.FlowTask
		if err := json.NewDecoder(io.LimitReader(r.Body, 1<<16)).Decode(&tasks); err != nil { fail(w, err, 400); return }
		kanban.FlowSeed(tasks)
		writeJSON(w, http.StatusOK, map[string]string{"seeded": fmt.Sprintf("%d", len(tasks))})
	})
	// remote task dispatch via node-agent (mac/windows workspaces)
	mux.HandleFunc("POST /api/remote/dispatch", func(w http.ResponseWriter, r *http.Request) {
		var req kanban.NodeDispatchRequest
		if err := json.NewDecoder(io.LimitReader(r.Body, 1<<20)).Decode(&req); err != nil { fail(w, err, 400); return }
		res, err := kanban.DispatchRemote(req, 10*time.Minute)
		if err != nil { fail(w, err, 502); return }
		writeJSON(w, http.StatusOK, res)
	})

	// hermes logs (read-only, whitelisted files, bounded tail)
	mux.HandleFunc("GET /api/logs", func(w http.ResponseWriter, r *http.Request) {
		tail, err := kanban.ReadLogTail(r.URL.Query().Get("file"), r.URL.Query().Get("tail"))
		if err != nil { fail(w, err, 400); return }
		// optional server-side filter: keep lines containing q (case-insensitive)
		if q := strings.TrimSpace(r.URL.Query().Get("q")); q != "" {
			lq := strings.ToLower(q)
			kept := make([]string, 0, len(tail.Lines))
			for _, l := range tail.Lines {
				if strings.Contains(strings.ToLower(l), lq) {
					kept = append(kept, l)
				}
			}
			tail.Lines = kept
		}
		writeJSON(w, http.StatusOK, tail)
	})

	// skills (read-only registry from ~/.hermes/skills)
	mux.HandleFunc("GET /api/skills", func(w http.ResponseWriter, r *http.Request) {
		skills, err := kanban.ListSkills()
		if err != nil { fail(w, err, 500); return }
		if q := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("q"))); q != "" {
			kept := skills[:0]
			for _, s := range skills {
				if strings.Contains(strings.ToLower(s.Name), q) || strings.Contains(strings.ToLower(s.Description), q) {
					kept = append(kept, s)
				}
			}
			skills = kept
		}
		writeJSON(w, http.StatusOK, skills)
	})
	mux.HandleFunc("GET /api/skills/content", func(w http.ResponseWriter, r *http.Request) {
		c, err := kanban.SkillContent(r.URL.Query().Get("name"))
		if err != nil { fail(w, err, 404); return }
		writeJSON(w, http.StatusOK, c)
	})

	// memory (read-only snapshot MEMORY.md / USER.md / SOUL.md)
	mux.HandleFunc("GET /api/memory", func(w http.ResponseWriter, r *http.Request) {
		mem, err := kanban.ReadMemory()
		if err != nil { fail(w, err, 500); return }
		writeJSON(w, http.StatusOK, mem)
	})

	mux.Handle("/", spa(dist))

	StartSSHDispatcher()
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
