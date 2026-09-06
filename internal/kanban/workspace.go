package kanban

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"
)

// workspaceFile is the on-disk shape of ~/.hermes/workspaces.json (shared with
// hermes CLI / node-agent). Entries carry extra keys we don't model
// (luvus_workspace_id, remote, apps, ...); saveWorkspaces preserves them.
type workspaceFile struct {
	Version    int          `json:"version"`
	Source     string       `json:"source,omitempty"`
	Workspaces []Workspace  `json:"workspaces"`
}

// typed keys that win over the original file on save
var workspaceKnownKeys = map[string]bool{
	"id": true, "name": true, "path": true, "host": true, "kind": true,
	"note": true, "apps": true,
}

var wsMu sync.Mutex

func workspacesPath() string {
	return filepath.Join(hermesHome(), "workspaces.json")
}

func loadWorkspaces() (*workspaceFile, error) {
	raw, err := os.ReadFile(workspacesPath())
	if err != nil {
		return nil, err
	}
	var f workspaceFile
	if err := json.Unmarshal(raw, &f); err != nil {
		return nil, err
	}
	if f.Workspaces == nil {
		f.Workspaces = []Workspace{}
	}
	return &f, nil
}

// saveWorkspaces writes atomically under a process lock. Unknown keys of each
// original entry (luvus_workspace_id, remote, ...) survive: our known fields
// win, everything else is carried over as-is.
func saveWorkspaces(f *workspaceFile) error {
	// originals by id
	origByID := map[string]map[string]json.RawMessage{}
	if raw, err := os.ReadFile(workspacesPath()); err == nil {
		var orig map[string]json.RawMessage
		if json.Unmarshal(raw, &orig) == nil {
			var origList []map[string]json.RawMessage
			if v, ok := orig["workspaces"]; ok && json.Unmarshal(v, &origList) == nil {
				for _, m := range origList {
					var id string
					if json.Unmarshal(m["id"], &id) == nil {
						origByID[id] = m
					}
				}
			}
		}
	}

	mergedList := make([]json.RawMessage, 0, len(f.Workspaces))
	for i := range f.Workspaces {
		w := &f.Workspaces[i]
		cur, err := json.Marshal(w)
		if err != nil {
			return err
		}
		var curMap map[string]json.RawMessage
		if err := json.Unmarshal(cur, &curMap); err != nil {
			return err
		}
		merged := map[string]json.RawMessage{}
		for k, v := range origByID[w.ID] {
			if !workspaceKnownKeys[k] {
				merged[k] = v
			}
		}
		for k, v := range curMap {
			merged[k] = v
		}
		enc, err := json.Marshal(merged)
		if err != nil {
			return err
		}
		mergedList = append(mergedList, enc)
	}

	out := map[string]any{"version": f.Version, "workspaces": mergedList}
	if f.Source != "" {
		out["source"] = f.Source
	}
	raw, err := json.MarshalIndent(out, "", "  ")
	if err != nil {
		return err
	}
	tmp := workspacesPath() + ".tmp"
	if err := os.WriteFile(tmp, append(raw, '\n'), 0o600); err != nil {
		return err
	}
	return os.Rename(tmp, workspacesPath())
}

// ListWorkspaces reads + annotates each entry with a cheap static status.
func ListWorkspaces() ([]Workspace, error) {
	wsMu.Lock()
	defer wsMu.Unlock()
	f, err := loadWorkspaces()
	if err != nil {
		if os.IsNotExist(err) {
			return []Workspace{}, nil
		}
		return nil, err
	}
	out := f.Workspaces
	for i := range out {
		w := &out[i]
		w.Status = "unknown"
		if w.Host == "" || w.Host == "localhost" || w.Host == "127.0.0.1" {
			w.Status = "local"
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].ID < out[j].ID })
	return out, nil
}

// SaveWorkspace creates or updates one workspace entry (by id).
func SaveWorkspace(w *Workspace) error {
	if strings.TrimSpace(w.ID) == "" {
		return fmt.Errorf("id required")
	}
	w.ID = strings.ToLower(strings.TrimSpace(w.ID))
	if strings.ContainsAny(w.ID, "/\\ ") {
		return fmt.Errorf("invalid id %q", w.ID)
	}
	if strings.TrimSpace(w.Name) == "" {
		w.Name = w.ID
	}
	if w.Kind == "" {
		w.Kind = "dir"
	}
	wsMu.Lock()
	defer wsMu.Unlock()
	f, err := loadWorkspaces()
	if err != nil {
		if os.IsNotExist(err) {
			f = &workspaceFile{Version: 1, Source: "kanban-board"}
		} else {
			return err
		}
	}
	found := false
	for i := range f.Workspaces {
		if f.Workspaces[i].ID == w.ID {
			keep := f.Workspaces[i].Status // runtime field, not persisted anyway
			f.Workspaces[i] = *w
			f.Workspaces[i].Status = keep
			found = true
			break
		}
	}
	if !found {
		f.Workspaces = append(f.Workspaces, *w)
	}
	return saveWorkspaces(f)
}

// DeleteWorkspace removes an entry by id.
func DeleteWorkspace(id string) error {
	wsMu.Lock()
	defer wsMu.Unlock()
	f, err := loadWorkspaces()
	if err != nil {
		return err
	}
	kept := f.Workspaces[:0]
	deleted := false
	for _, e := range f.Workspaces {
		if e.ID == id {
			deleted = true
			continue
		}
		kept = append(kept, e)
	}
	if !deleted {
		return fmt.Errorf("workspace %q not found", id)
	}
	f.Workspaces = kept
	return saveWorkspaces(f)
}

// PingWorkspace probes the workspace: local → stat path; remote → ssh
// `test -d <path>` with 5s connect timeout. Reports latency in ms.
func PingWorkspace(w *Workspace) Workspace {
	res := *w
	res.Status = "unknown"
	res.StatusMsg = ""
	res.PingMs = nil
	start := time.Now()
	if res.Host == "" || res.Host == "localhost" || res.Host == "127.0.0.1" {
		if _, err := os.Stat(res.Path); err == nil {
			res.Status, res.StatusMsg = "connected", "path ok"
		} else {
			res.Status, res.StatusMsg = "unreachable", trimErr(err)
		}
	} else {
		ctx, cancel := context.WithTimeout(context.Background(), 8*time.Second)
		defer cancel()
		cmd := exec.CommandContext(ctx, "ssh", "-o", "ConnectTimeout=5", "-o", "BatchMode=yes", res.Host,
			"test -d "+shellQuote(res.Path)+" && echo ok")
		out, err := cmd.Output()
		ms := float64(time.Since(start).Microseconds()) / 1000.0
		res.PingMs = &ms
		if ctx.Err() == context.DeadlineExceeded {
			res.Status, res.StatusMsg = "unreachable", "timeout >8s"
		} else if err != nil {
			res.Status, res.StatusMsg = "unreachable", trimErr(err)
		} else if strings.TrimSpace(string(out)) == "ok" {
			res.Status, res.StatusMsg = "connected", fmt.Sprintf("path ok via %s", res.Host)
		} else {
			res.Status, res.StatusMsg = "connected", "host reachable, path missing"
		}
	}
	return res
}

func trimErr(err error) string {
	s := err.Error()
	if len(s) > 160 {
		s = s[:160]
	}
	return s
}

func shellQuote(s string) string {
	return "'" + strings.ReplaceAll(s, "'", `'\''`) + "'"
}

// WorkspaceLogs greps board dispatcher logs for this workspace's id/path —
// a cheap stand-in for hermes-webui's workspace activity view.
func WorkspaceLogs(w *Workspace, n int) ([]string, error) {
	if n <= 0 || n > 500 {
		n = 50
	}
	var lines []string
	root := filepath.Join(hermesHome(), "kanban", "boards")
	entries, err := os.ReadDir(root)
	if err == nil {
		for _, e := range entries {
			if !e.IsDir() {
				continue
			}
			f, err := os.Open(filepath.Join(root, e.Name(), "dispatcher.log"))
			if err != nil {
				continue
			}
			sc := bufio.NewScanner(f)
			for sc.Scan() {
				t := sc.Text()
				if strings.Contains(t, w.ID) || strings.Contains(t, w.Path) {
					lines = append(lines, e.Name()+" | "+t)
				}
			}
			f.Close()
		}
	}
	if len(lines) > n {
		lines = lines[len(lines)-n:]
	}
	if lines == nil {
		lines = []string{}
	}
	return lines, nil
}
