package kanban

import (
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
	for id, t := range flowTasks {
		if (t.Stage == FlowDone || t.Stage == FlowFailed) && now.Sub(t.UpdatedAt) > doneTTL {
			delete(flowTasks, id)
		}
	}
	flowMu.Unlock()
}

// FlowSeed injects flow tasks (test/demo hook).
func FlowSeed(tasks []FlowTask) {
	flowMu.Lock()
	for _, t := range tasks {
		t.UpdatedAt = time.Now()
		flowTasks[t.TaskID] = t
	}
	flowMu.Unlock()
}

func FlowActive() []FlowTask {
	now := time.Now()
	flowMu.Lock()
	defer flowMu.Unlock()
	out := make([]FlowTask, 0, len(flowTasks))
	for id, t := range flowTasks {
		if (t.Stage == FlowDone || t.Stage == FlowFailed) && now.Sub(t.UpdatedAt) > doneTTL {
			delete(flowTasks, id)
			continue
		}
		out = append(out, t)
	}
	return out
}
