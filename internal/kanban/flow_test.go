package kanban

import (
	"testing"
	"time"
)

func TestFlowLifecycle(t *testing.T) {
	// fresh registry
	flowMu.Lock()
	flowTasks = map[string]FlowTask{}
	flowMu.Unlock()

	// dispatched -> running
	flowSet(FlowTask{TaskID: "t_dummy1", Board: "default", NodeID: "mac-1", Stage: FlowDispatched})
	flowSet(FlowTask{TaskID: "t_dummy2", Board: "default", NodeID: "win-1", Stage: FlowDispatched})
	flowSet(FlowTask{TaskID: "t_dummy1", Board: "default", NodeID: "mac-1", Stage: FlowRunning})

	act := FlowActive()
	if len(act) != 2 {
		t.Fatalf("want 2 active, got %d: %+v", len(act), act)
	}
	byID := map[string]FlowTask{}
	for _, ft := range act {
		byID[ft.TaskID] = ft
	}
	if byID["t_dummy1"].Stage != FlowRunning {
		t.Errorf("t_dummy1 want running, got %s", byID["t_dummy1"].Stage)
	}
	if byID["t_dummy2"].Stage != FlowDispatched {
		t.Errorf("t_dummy2 want dispatched, got %s", byID["t_dummy2"].Stage)
	}

	// done -> expired after TTL
	flowSet(FlowTask{TaskID: "t_dummy1", Board: "default", NodeID: "mac-1", Stage: FlowDone})
	doneTTL = 0 // force expiry
	time.Sleep(10 * time.Millisecond)
	act = FlowActive()
	if len(act) != 1 || act[0].TaskID != "t_dummy2" {
		t.Fatalf("want only t_dummy2 after done expiry, got %+v", act)
	}

	// failed also expires
	flowSet(FlowTask{TaskID: "t_dummy2", Board: "default", NodeID: "win-1", Stage: FlowFailed})
	time.Sleep(10 * time.Millisecond)
	if act := FlowActive(); len(act) != 0 {
		t.Fatalf("want 0 after failed expiry, got %+v", act)
	}
	doneTTL = 30 * time.Second // restore
}
