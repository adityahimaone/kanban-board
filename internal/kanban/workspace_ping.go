package kanban

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"
)

// PingPoint is one probe result kept for the wave + logs.
type PingPoint struct {
	At  int64    `json:"at"`           // unix seconds
	Ms  *float64 `json:"ms,omitempty"` // latency ms when measured
	Ok  bool     `json:"ok"`
	Msg string   `json:"msg,omitempty"` // status_message truncated
}

var pingMu sync.Mutex

func pingHistoryPath() string {
	return filepath.Join(hermesHome(), "kanban", "workspace-pings.json")
}

func loadPingMap() (map[string][]PingPoint, error) {
	raw, err := os.ReadFile(pingHistoryPath())
	if err != nil {
		if os.IsNotExist(err) {
			return map[string][]PingPoint{}, nil
		}
		return nil, err
	}
	var m map[string][]PingPoint
	if err := json.Unmarshal(raw, &m); err != nil {
		return map[string][]PingPoint{}, nil
	}
	if m == nil {
		m = map[string][]PingPoint{}
	}
	return m, nil
}

func savePingMap(m map[string][]PingPoint) error {
	if err := os.MkdirAll(filepath.Dir(pingHistoryPath()), 0o755); err != nil {
		return err
	}
	raw, err := json.MarshalIndent(m, "", "  ")
	if err != nil {
		return err
	}
	tmp := pingHistoryPath() + ".tmp"
	if err := os.WriteFile(tmp, append(raw, '\n'), 0o600); err != nil {
		return err
	}
	return os.Rename(tmp, pingHistoryPath())
}

func pingLogPath() string {
	return filepath.Join(hermesHome(), "kanban", "workspace-ping.log")
}

func appendPingLog(id string, res Workspace) {
	line := time.Now().Format(time.RFC3339) + " [" + id + "] " + res.Status
	if res.PingMs != nil {
		line += fmt.Sprintf(" ping_ms=%.1f", *res.PingMs)
	}
	if res.StatusMsg != "" {
		line += " — " + res.StatusMsg
	}
	line += "\n"
	_ = os.MkdirAll(filepath.Dir(pingLogPath()), 0o755)
	f, err := os.OpenFile(pingLogPath(), os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o600)
	if err != nil {
		return
	}
	_, _ = f.WriteString(line)
	_ = f.Close()
}

// AppendPingHistory records one PingWorkspace result. Keeps last 30 per id
// and appends a line to workspace-ping.log for WorkspaceLogs.
func AppendPingHistory(id string, res Workspace) {
	pingMu.Lock()
	defer pingMu.Unlock()
	m, _ := loadPingMap()
	now := time.Now().Unix()
	pts := m[id]
	pts = append(pts, PingPoint{At: now, Ms: res.PingMs, Ok: res.Status == "connected" || res.Status == "local", Msg: res.StatusMsg})
	if len(pts) > 30 {
		pts = pts[len(pts)-30:]
	}
	m[id] = pts
	_ = savePingMap(m)
	appendPingLog(id, res)
}

// GetPingHistory returns last 30 points for one workspace (oldest→newest).
func GetPingHistory(id string) ([]PingPoint, error) {
	pingMu.Lock()
	defer pingMu.Unlock()
	m, err := loadPingMap()
	if err != nil {
		return nil, err
	}
	pts := m[id]
	if pts == nil {
		return []PingPoint{}, nil
	}
	out := make([]PingPoint, len(pts))
	copy(out, pts)
	return out, nil
}

// debouncedStatus prevents single transient probe failures from flipping a
// previously-connected workspace to offline. Offline only after 3 consecutive
// failed probes (including the current one).
func debouncedStatus(id string, raw Workspace) Workspace {
	if raw.Status != "unreachable" {
		return raw
	}
	m, _ := loadPingMap()
	pts := m[id]
	consecutive := 1 // current fail
	for i := len(pts) - 1; i >= 0 && consecutive < 3; i-- {
		if !pts[i].Ok {
			consecutive++
		} else {
			break
		}
	}
	if consecutive < 3 {
		raw.Status = "connected"
		raw.StatusMsg = fmt.Sprintf("connected (retry %d/3) — %s", consecutive, raw.StatusMsg)
	}
	return raw
}

// DebouncedStatus is the exported form used by single-ping routes too:
// offline only after 3 consecutive failed probes (including current).
func DebouncedStatus(id string, raw Workspace) Workspace {
	return debouncedStatus(id, raw)
}

// PingAll probes every workspace sequentially (ssh is serial to avoid storm),
// logs each result, and returns the updated list with Status/PingMs filled.
// A single transient failure stays reported as connected until 3 in a row —
// history still records the raw fail so the EKG shows the dip.
func PingAll() ([]Workspace, error) {
	ws, err := ListWorkspaces()
	if err != nil {
		return nil, err
	}
	out := make([]Workspace, 0, len(ws))
	for i := range ws {
		raw := PingWorkspace(&ws[i])
		eff := debouncedStatus(raw.ID, raw)
		AppendPingHistory(raw.ID, raw) // store raw, not debounced
		broadcastEvent("workspace_ping", map[string]any{"workspace_id": raw.ID, "status": eff.Status, "status_message": eff.StatusMsg, "ping_ms": eff.PingMs})
		out = append(out, eff)
	}
	return out, nil
}
