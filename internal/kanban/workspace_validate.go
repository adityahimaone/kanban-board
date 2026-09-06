package kanban

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// validateWorkspacePath refuses workspace paths the VPS dispatcher cannot
// actually use. Hermes dispatcher resolves workspaces LOCALLY (mkdir -p on
// workspace_path, Popen cwd=workspace). A remote Mac/Windows path that does
// not exist on this host crashes every spawn attempt with
// `workspace: [Errno 13] Permission denied: '/Users'` and the task loops
// ready → spawn_failed → ready (seen on t_03ede921 and t_0b6b086c).
//
// Rules:
//   - POSIX paths (/Users/..., /home/other-host/...): must already exist as a
//     directory on this host. mkdir side effects are fine for local paths,
//     but a non-existent /Users-style path is treated as remote and refused.
//   - Windows drive paths (C:\...): always remote, always refused.
func validateWorkspacePath(p string) error {
	p = strings.TrimSpace(p)
	if p == "" {
		return nil
	}
	// Windows drive path (C:\ or C:/) — never local on this Linux host.
	if len(p) >= 2 && p[1] == ':' {
		return fmt.Errorf(
			"workspace_path %q is a Windows path — this dispatcher runs on Linux and cannot use it. "+
				"Run the task on the Windows host (node-agent) or pick a local workspace", p)
	}
	if filepath.IsAbs(p) {
		if _, err := os.Stat(p); err != nil {
			if os.IsNotExist(err) {
				return fmt.Errorf(
					"workspace_path %q does not exist on this host — remote paths (e.g. /Users/... on the Mac) "+
						"crash the dispatcher with 'Permission denied'. Use a local workspace, a scratch workspace, "+
						"or run the task on the machine that owns the path", p)
			}
			// Exists but not stat-able (permission denied on a parent like /Users) —
			// same class of failure: the dispatcher's mkdir/chdir would fail too.
			return fmt.Errorf(
				"workspace_path %q is not accessible on this host (%v) — likely a remote path; "+
					"the dispatcher can only use paths that exist locally", p, err)
		}
	}
	return nil
}
