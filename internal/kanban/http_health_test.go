package kanban

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestHealthRouteRejectsGhostRunning(t *testing.T) {
	slug := testBoard(t)
	if err := mustDirectRunning(t, slug, "t_running"); err != nil {
		t.Fatalf("seed running: %v", err)
	}
	id := "t_running"
	mux := buildHealthOnlyMux()
	req := httptest.NewRequest(http.MethodGet, "/api/boards/"+slug+"/tasks/"+id+"/health", nil)
	req.SetPathValue("slug", slug)
	req.SetPathValue("id", id)
	rw := httptest.NewRecorder()
	mux.ServeHTTP(rw, req)
	if rw.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200, body=%s", rw.Code, rw.Body.String())
	}
}

func buildHealthOnlyMux() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/boards/{slug}/tasks/{id}/health", func(w http.ResponseWriter, r *http.Request) {
		h, err := TaskHealthFor(r.PathValue("slug"), r.PathValue("id"))
		if err != nil {
			http.Error(w, err.Error(), http.StatusNotFound)
			return
		}
		writeAuthJSON(w, h)
	})
	mux.HandleFunc("GET /api/boards/{slug}/health", func(w http.ResponseWriter, r *http.Request) {
		m, err := BoardTaskHealth(r.PathValue("slug"))
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		writeAuthJSON(w, m)
	})
	return mux
}

func mustDirectRunning(t *testing.T, slug, id string) error {
	t.Helper()
	db, err := openDB(slug)
	if err != nil {
		return err
	}
	defer db.Close()
	_, err = db.Exec(`INSERT INTO tasks (id, title, status, created_at, workspace_kind, workspace_path) VALUES (?,?,?,?, 'scratch','')`, id, "inflight", "running", 0)
	return err
}

func writeAuthJSON(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(v)
}
