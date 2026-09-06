package kanban

import (
	"strings"
	"testing"
)

func TestValidateWorkspacePath(t *testing.T) {
	// Remote-shaped / inaccessible paths must be refused (fail closed).
	remoteCases := []string{
		"/Users/adityahimawan/Development/bisadaya-monorepo", // real Mac path — t_0b6b086c
		"/Users/shared/whatever",
		"C:\\Users\\user\\repo", // windows drive
	}
	for _, p := range remoteCases {
		err := validateWorkspacePath(p)
		if err == nil {
			t.Errorf("validateWorkspacePath(%q) = nil, want error (remote path)", p)
		} else if !strings.Contains(err.Error(), "cannot") && !strings.Contains(err.Error(), "does not exist") && !strings.Contains(err.Error(), "not accessible") {
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

func TestCreateTaskRejectsRemoteWorkspace(t *testing.T) {
	slug := testBoard(t)
	task := &Task{Title: "remote ws", WorkspaceKind: "dir", WorkspacePath: "/Users/mac/only/path", Status: "todo"}
	if err := CreateTask(slug, task); err == nil {
		t.Fatal("CreateTask with remote /Users path should fail, got nil")
	}
}
