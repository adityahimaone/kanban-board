package kanban

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// writeWorkspaces seeds a workspaces.json inside the temp HERMES_HOME.
func writeWorkspaces(t *testing.T, entries map[string]string) {
	t.Helper()
	var list []map[string]string
	for host, path := range entries {
		list = append(list, map[string]string{"id": "w-" + host, "name": host, "host": host, "path": path, "kind": "dir"})
	}
	if list == nil {
		list = []map[string]string{}
	}
	raw, _ := json.Marshal(map[string]any{"version": 1, "workspaces": list})
	if err := os.WriteFile(filepath.Join(hermesHome(), "workspaces.json"), raw, 0o600); err != nil {
		t.Fatal(err)
	}
}

func TestValidateWorkspacePath(t *testing.T) {
	t.Setenv("HERMES_HOME", t.TempDir())
	// No workspaces.json: remote-shaped / inaccessible paths must be refused
	// (fail closed).
	remoteCases := []string{
		"/Users/adityahimawan/Development/bisadaya-monorepo", // real Mac path — t_0b6b086c
		"/Users/shared/whatever",
		"C:\\Users\\user\\repo", // windows drive
	}
	for _, p := range remoteCases {
		err := validateWorkspacePath(p)
		if err == nil {
			t.Errorf("validateWorkspacePath(%q) = nil, want error (remote path)", p)
		} else if !strings.Contains(err.Error(), "cannot") && !strings.Contains(err.Error(), "does not exist") && !strings.Contains(err.Error(), "not accessible") && !strings.Contains(err.Error(), "Register") {
			t.Errorf("validateWorkspacePath(%q) error lacks remote hint: %v", p, err)
		}
	}
	// Local paths must pass.
	localCases := []string{
		"", // scratch
		"/tmp",
		"/home/adityahimaone/apps/kanban-board",
		"relative/path/is/checked/by-dispatcher", // relative → dispatcher's own guard
	}
	for _, p := range localCases {
		if err := validateWorkspacePath(p); err != nil {
			t.Errorf("validateWorkspacePath(%q) = %v, want nil", p, err)
		}
	}
}

func TestValidateWorkspacePathRegisteredRemote(t *testing.T) {
	t.Setenv("HERMES_HOME", t.TempDir())
	macPath := "/Users/adityahimawan/Development/saas"
	writeWorkspaces(t, map[string]string{"mac-tailscale": macPath})
	// Registered remote path is allowed (routes via node-agent).
	if err := validateWorkspacePath(macPath); err != nil {
		t.Errorf("registered remote path %q rejected: %v", macPath, err)
	}
	// Same shape but NOT registered → still refused.
	if err := validateWorkspacePath("/Users/adityahimawan/Development/other"); err == nil {
		t.Error("unregistered /Users path should be refused")
	}
	// Windows path registered as remote → allowed too.
	winPath := "C:\\Users\\user\\repo"
	writeWorkspaces(t, map[string]string{"windows-tailscale": winPath})
	if err := validateWorkspacePath(winPath); err != nil {
		t.Errorf("registered windows path rejected: %v", err)
	}
}

func TestCreateTaskRejectsRemoteWorkspace(t *testing.T) {
	slug := testBoard(t)
	task := &Task{Title: "remote ws", WorkspaceKind: "dir", WorkspacePath: "/Users/mac/only/path", Status: "todo"}
	if err := CreateTask(slug, task); err == nil {
		t.Fatal("CreateTask with remote /Users path should fail, got nil")
	}
}

func TestCreateTaskAllowsRegisteredRemoteWorkspace(t *testing.T) {
	slug := testBoard(t)
	macPath := "/Users/adityahimawan/Development/saas"
	writeWorkspaces(t, map[string]string{"mac-tailscale": macPath})
	task := &Task{Title: "remote via node-agent", WorkspaceKind: "dir", WorkspacePath: macPath, Status: "todo"}
	if err := CreateTask(slug, task); err != nil {
		t.Fatalf("registered remote workspace should pass create guard: %v", err)
	}
}
