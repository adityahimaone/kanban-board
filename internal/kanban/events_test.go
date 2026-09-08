package kanban

import (
	"testing"
	"time"
)

func TestEventHubBroadcastAndUnsubscribe(t *testing.T) {
	ch := Hub.Subscribe()
	broadcastEvent("node_health", map[string]string{"status": "up"})

	h := Hub
	select {
	case event := <-ch:
		if event.Kind != "node_health" {
			t.Fatalf("event kind = %q, want node_health", event.Kind)
		}
	case <-time.After(time.Second):
		t.Fatal("timed out waiting for event")
	}

	h.Unsubscribe(ch)
	if len(h.subs) != 0 {
		t.Fatalf("subscriber count = %d, want 0", len(h.subs))
	}
}
