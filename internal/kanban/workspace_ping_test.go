package kanban

import (
	"os"
	"path/filepath"
	"testing"
)

func TestPingHistoryRoundtrip(t *testing.T) {
	t.Setenv("HERMES_HOME", t.TempDir())
	if err := os.MkdirAll(hermesHome(), 0o755); err != nil {
		t.Fatal(err)
	}
	ms := 42.5
	AppendPingHistory("ws1", Workspace{ID: "ws1", Status: "connected", PingMs: &ms, StatusMsg: "path ok"})
	AppendPingHistory("ws1", Workspace{ID: "ws1", Status: "unreachable", StatusMsg: "timeout"})
	pts, err := GetPingHistory("ws1")
	if err != nil {
		t.Fatal(err)
	}
	if len(pts) != 2 {
		t.Fatalf("want 2 points, got %d", len(pts))
	}
	if !pts[0].Ok || pts[0].Ms == nil || *pts[0].Ms != 42.5 {
		t.Errorf("bad first point: %+v", pts[0])
	}
	if pts[1].Ok || pts[1].Ms != nil {
		t.Errorf("bad second point: %+v", pts[1])
	}
	// cap at 30
	for i := 0; i < 40; i++ {
		AppendPingHistory("ws2", Workspace{ID: "ws2", Status: "connected"})
	}
	pts, _ = GetPingHistory("ws2")
	if len(pts) != 30 {
		t.Errorf("want capped 30, got %d", len(pts))
	}
	// empty id → empty slice, no error
	pts, err = GetPingHistory("nope")
	if err != nil || len(pts) != 0 {
		t.Errorf("unknown id: want empty, got %d err=%v", len(pts), err)
	}
	// file exists at expected path
	if _, err := os.Stat(pingHistoryPath()); err != nil {
		t.Errorf("history file missing: %v", err)
	}
	_ = filepath.Separator // keep filepath import used if dir removed
}
