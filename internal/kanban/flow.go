package kanban

import (
	"log"
	"strings"
	"sync"
	"time"
)

type FlowStage string

const (
	FlowDispatched FlowStage = "dispatched"
	FlowRunning    FlowStage = "running"
	FlowDone       FlowStage = "done"
	FlowFailed     FlowStage = "failed"
)

type FlowTask struct {
	TaskID    string    `json:"task_id"`
	Title     string    `json:"title"`
	Board     string    `json:"board"`
	NodeID    string    `json:"node_id"`
	Stage     FlowStage `json:"stage"`
	UpdatedAt time.Time `json:"updated_at"`
}

var (
	flowMu    sync.Mutex
	flowTasks = map[string]FlowTask{}
	doneTTL   = 30 * time.Second
)

func init() {
	go func() {
		ticker := time.NewTicker(10 * time.Second)
		defer ticker.Stop()
		for range ticker.C {
			flowEvict()
		}
	}()
}

func flowSet(t FlowTask) {
	t.UpdatedAt = time.Now()
	flowMu.Lock()
	flowTasks[t.TaskID] = t
	flowMu.Unlock()
}

func flowEvict() {
	now := time.Now()
	flowMu.Lock()
	defer flowMu.Unlock()
	for id, t := range flowTasks {
		if (t.Stage == FlowDone || t.Stage == FlowFailed) && now.Sub(t.UpdatedAt) > doneTTL {
			delete(flowTasks, id)
		}
	}
}

// FlowSeed injects flow tasks (test/demo hook).
func FlowSeed(tasks []FlowTask) {
	flowMu.Lock()
	defer flowMu.Unlock()
	for _, t := range tasks {
		t.UpdatedAt = time.Now()
		flowTasks[t.TaskID] = t
	}
}

func flowStageForTask(status, transport string) (FlowStage, bool) {
	if transport != "ssh" {
		return "", false
	}
	switch status {
	case "todo", "ready":
		return FlowDispatched, true
	case "running":
		return FlowRunning, true
	default:
		return "", false
	}
}

func flowNodeID(sshTarget string) string {
	if strings.Contains(sshTarget, "windows") {
		return "windows"
	}
	return "mac"
}

// syncFlowFromDB makes task DB source of truth. Dispatcher events can be missed;
// status rows cannot. Remote todo/ready/running tasks always appear on map.
func syncFlowFromDB() {
	boards, err := ListBoards()
	if err != nil {
		return
	}
	seen := map[string]bool{}
	for _, b := range boards {
		db, err := openDB(b.Slug)
		if err != nil {
			continue
		}
		rows, err := db.Query(`SELECT id, title, status, COALESCE(workspace_ssh_target,'') FROM tasks WHERE workspace_transport='ssh' AND status IN ('todo','ready','running')`)
		if err != nil {
			db.Close()
			continue
		}
		for rows.Next() {
			var id, title, status, target string
			if rows.Scan(&id, &title, &status, &target) != nil {
				continue
			}
			stage, ok := flowStageForTask(status, "ssh")
			if !ok {
				continue
			}
			seen[id] = true
			FlowTrack(id, title, b.Slug, flowNodeID(target), stage)
		}
		rows.Close()
		db.Close()
	}
	flowMu.Lock()
	defer flowMu.Unlock()
	for id, t := range flowTasks {
		if (t.Stage == FlowDispatched || t.Stage == FlowRunning) && !seen[id] {
			delete(flowTasks, id)
		}
	}
}

// FlowTrack records live dispatcher stage transitions.
func FlowTrack(taskID, title, board, nodeID string, stage FlowStage) {
	flowSet(FlowTask{TaskID: taskID, Title: title, Board: board, NodeID: nodeID, Stage: stage})
}

func FlowActive() []FlowTask {
	flowEvict()
	flowMu.Lock()
	defer flowMu.Unlock()
	out := make([]FlowTask, 0, len(flowTasks))
	for _, t := range flowTasks {
		out = append(out, t)
	}
	return out
}

// StartFlowSync polls DB so board UI, CLI, gateway, and node-agent task paths
// share same flow lifecycle. Immediate sweep avoids initial blank map.
func StartFlowSync() {
	go func() {
		syncFlowFromDB()
		ticker := time.NewTicker(5 * time.Second)
		defer ticker.Stop()
		for range ticker.C {
			syncFlowFromDB()
		}
	}()
	log.Println("flow-sync: started (poll 5s, DB source of truth)")
}
