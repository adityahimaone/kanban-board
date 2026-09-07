package kanban

import (
	"testing"
	"time"
)

func TestFlowStageForTaskStatus(t *testing.T) {
	tests := []struct {
		name      string
		status    string
		transport string
		want      FlowStage
		ok        bool
	}{
		{"remote todo enters dispatch lane", "todo", "ssh", FlowDispatched, true},
		{"remote ready enters dispatch lane", "ready", "ssh", FlowDispatched, true},
		{"remote running enters worker lane", "running", "ssh", FlowRunning, true},
		{"board todo enters dispatch lane", "todo", "", FlowDispatched, true},
		{"board ready enters dispatch lane", "ready", "", FlowDispatched, true},
		{"local running stays out of flow", "running", "", "", false},
		{"review leaves active flow", "review", "ssh", "", false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, ok := flowStageForTask(tt.status, tt.transport)
			if got != tt.want || ok != tt.ok {
				t.Fatalf("flowStageForTask(%q, %q) = (%q, %v), want (%q, %v)", tt.status, tt.transport, got, ok, tt.want, tt.ok)
			}
		})
	}
}

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

	// done -> retained until session retention elapses
	flowSet(FlowTask{TaskID: "t_dummy1", Board: "default", NodeID: "mac-1", Stage: FlowDone})
	retention := flowRetention()
	if retention < 5*time.Minute || retention > 10*time.Minute {
		t.Errorf("retention = %v, want within 5m-10m window", retention)
	}

	// still visible immediately after terminal stage
	if act := FlowActive(); len(act) != 2 {
		t.Fatalf("want done task retained, got %+v", act)
	}

	// expired only after retention window passes
	setFlowRetentionForTest(0)
	time.Sleep(10 * time.Millisecond)
	act = FlowActive()
	if len(act) != 1 || act[0].TaskID != "t_dummy2" {
		t.Fatalf("want only t_dummy2 after retention expiry, got %+v", act)
	}

	// failed also expires on the same window
	flowSet(FlowTask{TaskID: "t_dummy2", Board: "default", NodeID: "win-1", Stage: FlowFailed})
	time.Sleep(10 * time.Millisecond)
	if act := FlowActive(); len(act) != 0 {
		t.Fatalf("want 0 after failed expiry, got %+v", act)
	}
	setFlowRetentionForTest(-1) // restore env-backed retention
}

func TestFlowRetentionConfig(t *testing.T) {
	cases := map[string]time.Duration{
		"":        10 * time.Minute, // default
		"10m":     10 * time.Minute,
		"5m":      5 * time.Minute,
		"300s":    5 * time.Minute,
		"1m":      5 * time.Minute, // below window clamps up to 5m
		"1h":      10 * time.Minute,
		"garbage": 10 * time.Minute,
	}
	for env, want := range cases {
		t.Setenv("FLOW_SESSION_RETENTION", env)
		if got := flowRetention(); got != want {
			t.Errorf("FLOW_SESSION_RETENTION=%q -> %v, want %v", env, got, want)
		}
	}
}
