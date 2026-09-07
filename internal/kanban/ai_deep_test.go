package kanban

import (
	"strings"
	"testing"
)

func TestDeepPromptArgsUseLowLatencyMode(t *testing.T) {
	args := deepPromptArgs()
	joined := strings.Join(args, " ")
	for _, want := range []string{"chat", "-Q", "--reasoning", "minimal", "--query-file", "-"} {
		if !strings.Contains(joined, want) {
			t.Fatalf("deep args missing %q: %v", want, args)
		}
	}
}

func TestDeepPromptTextKeepsTaskData(t *testing.T) {
	text := deepPromptText("fix card", "card overlap")
	for _, want := range []string{"fix card", "card overlap", "Output ONLY"} {
		if !strings.Contains(text, want) {
			t.Fatalf("deep prompt missing %q: %q", want, text)
		}
	}
}
