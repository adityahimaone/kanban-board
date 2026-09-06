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
// Remote paths that ARE registered in workspaces.json with a non-local host
// (mac-tailscale/windows-tailscale) are allowed — they will be routed via
// node-agent instead of the local hermes dispatcher. Everything else that
// does not exist locally is refused fail-closed.
//
// Rules:
//   - Windows drive paths (C:\...): allowed only if registered as a
//     windows remote workspace; otherwise refused.
//   - POSIX paths that exist locally: always allowed.
//   - POSIX paths registered as a remote workspace path: allowed (node-agent).
//   - Everything else absent locally: refused.
func validateWorkspacePath(p string) error {
	p = strings.TrimSpace(p)
	if p == "" {
		return nil
	}
	// If this exact path is a registered remote workspace, allow it — it'll
	// dispatch via node-agent, not the local mkdir path.
	if isRegisteredRemotePath(p) {
		return nil
	}
	// Windows drive path (C:\ or C:/) — never local on this Linux host.
	if len(p) >= 2 && p[1] == ':' {
		return fmt.Errorf(
			"workspace_path %q is a Windows path — this dispatcher runs on Linux and cannot use it. "+
				"Register it as a remote workspace (host windows-tailscale) to run via node-agent, or pick a local workspace", p)
	}
	if filepath.IsAbs(p) {
		if _, err := os.Stat(p); err != nil {
			if os.IsNotExist(err) {
				return fmt.Errorf(
					"workspace_path %q does not exist on this host — remote paths (e.g. /Users/... on the Mac) "+
						"crash the dispatcher with 'Permission denied'. Register the workspace as a remote (host mac-tailscale) to run via node-agent, or use a local/scratch workspace", p)
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

// isRegisteredRemotePath returns true when p exactly matches a workspace path
// whose host is non-local (i.e. it has a node-agent route).
func isRegisteredRemotePath(p string) bool {
	f, err := loadWorkspaces()
	if err != nil || f == nil {
		return false
	}
	for _, w := range f.Workspaces {
		if w.Path == p && w.Host != "" && w.Host != "localhost" && w.Host != "127.0.0.1" {
			return true
		}
	}
	return false
}
