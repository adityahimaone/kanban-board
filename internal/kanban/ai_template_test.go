package kanban

import (
	"strings"
	"testing"
	"time"
)

func TestImprovePromptFast_ContainsStructure(t *testing.T) {
	out := ImprovePromptFast("fix kanban card overlap", "card numpuk pas banyak task")
	if out == "" {
		t.Fatal("expected non-empty fast prompt")
	}
	for _, want := range []string{"Goal", "Requirements", "Acceptance", "Verification"} {
		if !strings.Contains(out, want) {
			t.Fatalf("fast prompt missing %q in: %q", want, out)
		}
	}
}

func TestImprovePromptFast_DetectKind(t *testing.T) {
	cases := []struct{ title, body, want string }{
		{"bug: login error", "crash on submit", "bug"},
		{"tampilan card berantakan", "ui overlap di kanban", "ui"},
		{"refactor workspace ping", "rapikan logic debounce", "refactor"},
		{"cek kenapa ping lambat", "investigate latency", "investigation"},
		{"add export csv", "fitur baru export", "feature"},
	}
	for _, c := range cases {
		if got := DetectKind(c.title, c.body); got != c.want {
			t.Errorf("DetectKind(%q,%q)=%q want %q", c.title, c.body, got, c.want)
		}
	}
}

func TestImprovePromptFast_Speed(t *testing.T) {
	start := time.Now()
	_ = ImprovePromptFast("speed test", "check fast path")
	if elapsed := time.Since(start); elapsed > 50*time.Millisecond {
		t.Fatalf("fast path too slow: %v", elapsed)
	}
}

func TestImprovePromptFast_EmptyTitleStillStructured(t *testing.T) {
	out := ImprovePromptFast("", "card numpuk")
	if !strings.Contains(out, "Goal") {
		t.Fatalf("expected structured output even without title, got %q", out)
	}
}
