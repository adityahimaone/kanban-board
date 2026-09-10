package kanban

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLocalWorkspaceExpandsTildeAndMissingPathIsNotHealthy(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)
	if err := os.MkdirAll(filepath.Join(home, "apps", "kanban-board"), 0o755); err != nil {
		t.Fatal(err)
	}
	if got := localWorkspacePath("~/apps/kanban-board"); got != filepath.Join(home, "apps", "kanban-board") {
		t.Fatalf("expanded path = %q", got)
	}
	ok := Workspace{ID: "ok", Path: "~/apps/kanban-board"}
	got := PingWorkspace(&ok)
	if got.Status != "connected" {
		t.Fatalf("existing tilde workspace status = %q (%s)", got.Status, got.StatusMsg)
	}
	missing := Workspace{ID: "missing", Path: "~/apps/nope"}
	got = PingWorkspace(&missing)
	if got.Status != "unreachable" {
		t.Fatalf("missing local workspace status = %q", got.Status)
	}
}
