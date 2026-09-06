package kanban

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"
)

// nodeAgent dispatches remote-workspace tasks through the node-agent server
// (~/apps/node-agent, pm2 :8788). The agent on each host long-polls
// /api/nodes/{id}/poll, runs the prompt (hermes chat or shell) in the
// workspace, and posts a result. This is the permanent fix for remote paths:
// the VPS hermes dispatcher can only mkdir/chdir LOCALLY, so /Users/...
// workspaces must never reach it — they route here instead.

func nodeAgentBase() string {
	if v := os.Getenv("KANBAN_NODE_AGENT"); v != "" {
		return strings.TrimRight(v, "/")
	}
	return "http://127.0.0.1:8788"
}

// NodeDispatchRequest mirrors transport.DispatchRequest on the node-agent.
type NodeDispatchRequest struct {
	TaskID    string `json:"task_id"`
	Board     string `json:"board"`
	Message   string `json:"message"`
	Workspace string `json:"workspace"`
	Model     string `json:"model,omitempty"`
	Provider  string `json:"provider,omitempty"`
}

// NodeDispatchResult mirrors transport.ResultRequest.
type NodeDispatchResult struct {
	TaskID     string `json:"task_id"`
	Success    bool   `json:"success"`
	Output     string `json:"output"`
	Error      string `json:"error,omitempty"`
	DurationMs int64  `json:"duration_ms"`
}

// NodeAgentStatus is what GET /api/remote/nodes returns.
type NodeAgentStatus struct {
	Status string `json:"status"` // up | down
	Nodes  []struct {
		NodeID     string   `json:"NodeID"`
		Hostname   string   `json:"Hostname"`
		Workspaces []string `json:"Workspaces"`
		Status     string   `json:"Status"`
		LastSeen   string   `json:"LastSeen"`
	} `json:"nodes,omitempty"`
	Error string `json:"error,omitempty"`
}

// NodeAgentHealth proxies node-agent /health.
func NodeAgentHealth() (*NodeAgentStatus, error) {
	c := &http.Client{Timeout: 2 * time.Second}
	resp, err := c.Get(nodeAgentBase() + "/health")
	if err != nil {
		return &NodeAgentStatus{Status: "down", Error: err.Error()}, nil
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<16))
	var st NodeAgentStatus
	if err := json.Unmarshal(body, &st); err != nil {
		return &NodeAgentStatus{Status: "down", Error: err.Error()}, nil
	}
	st.Status = "up"
	return &st, nil
}

// DispatchRemote sends one task to the node-agent and waits (bounded) for the
// result. node-agent routes by workspace prefix; an unknown workspace falls
// back to the first online node.
func DispatchRemote(req NodeDispatchRequest, wait time.Duration) (*NodeDispatchResult, error) {
	if strings.TrimSpace(req.TaskID) == "" {
		return nil, fmt.Errorf("task_id required")
	}
	if strings.TrimSpace(req.Workspace) == "" {
		return nil, fmt.Errorf("workspace required (remote dispatch is workspace-scoped)")
	}
	c := &http.Client{Timeout: 10 * time.Second}
	buf, _ := json.Marshal(req)
	resp, err := c.Post(nodeAgentBase()+"/api/dispatch", "application/json", bytes.NewReader(buf))
	if err != nil {
		return nil, fmt.Errorf("node-agent unreachable: %w", err)
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<16))
	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("node-agent dispatch %d: %s", resp.StatusCode, trimErrStr(string(body)))
	}
	var ack struct {
		Status string `json:"status"`
		NodeID string `json:"node_id"`
	}
	if err := json.Unmarshal(body, &ack); err != nil {
		return nil, fmt.Errorf("node-agent bad ack: %s", trimErrStr(string(body)))
	}

	// poll result
	deadline := time.Now().Add(wait)
	pc := &http.Client{Timeout: 5 * time.Second}
	for time.Now().Before(deadline) {
		time.Sleep(2 * time.Second)
		r2, err := pc.Get(nodeAgentBase() + "/api/results/" + req.TaskID)
		if err != nil {
			continue
		}
		if r2.StatusCode == 404 {
			r2.Body.Close()
			continue
		}
		b2, _ := io.ReadAll(io.LimitReader(r2.Body, 1<<20))
		r2.Body.Close()
		if r2.StatusCode != 200 {
			continue
		}
		var res NodeDispatchResult
		if err := json.Unmarshal(b2, &res); err != nil {
			continue
		}
		return &res, nil
	}
	return nil, fmt.Errorf("timeout after %s waiting for result of %s (node %s)", wait, req.TaskID, ack.NodeID)
}

func trimErrStr(s string) string {
	s = strings.TrimSpace(s)
	if len(s) > 200 {
		s = s[:200] + "..."
	}
	return s
}
