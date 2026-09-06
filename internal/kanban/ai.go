package kanban

import (
	"context"
	"fmt"
	"os/exec"
	"strings"
	"time"
)

// ImprovePrompt rewrites a rough task body into a clear, actionable prompt
// using the default profile's model via `hermes --oneshot`. Timeout 90s.
// Returns the improved text (whitespace-trimmed).
func ImprovePrompt(title, body string) (string, error) {
	sys := "You are a prompt engineer. Rewrite the user's task description into a clear, concise, actionable prompt for a coding agent. Keep the user's language (Indonesian stays Indonesian, English stays English). Output ONLY the improved prompt text — no preamble, no quotes, no markdown fences."
	user := "Task title: " + title + "\n\nRough description:\n" + body

	ctx, cancel := context.WithTimeout(context.Background(), 90*time.Second)
	defer cancel()
	cmd := exec.CommandContext(ctx, "hermes", "--cli", "--oneshot", sys+"\n\n"+user)
	out, err := cmd.Output()
	if err != nil {
		if ctx.Err() == context.DeadlineExceeded {
			return "", errTimeout
		}
		return "", fmt.Errorf("hermes oneshot failed: %s", trimErr(err))
	}
	text := strings.TrimSpace(string(out))
	// strip wrapping fences if the model added them anyway
	text = strings.TrimPrefix(text, "```")
	text = strings.TrimSuffix(text, "```")
	text = strings.TrimSpace(text)
	if text == "" {
		return "", errEmpty
	}
	if len(text) > 8000 {
		text = text[:8000]
	}
	return text, nil
}

type timeoutError struct{}

func (timeoutError) Error() string { return "AI improve timeout (>90s) — coba lagi" }

var (
	errTimeout = timeoutError{}
	errEmpty   = stringsError("AI returned empty response")
)

type stringsError string

func (s stringsError) Error() string { return string(s) }
