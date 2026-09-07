package kanban

import (
	"context"
	"fmt"
	"os/exec"
	"strings"
	"time"
)

// deepPromptText builds the compact rewrite query. Short system preamble
// keeps model latency low while preserving language + output rules.
func deepPromptText(title, body string) string {
	sys := "You are a prompt engineer. Rewrite the task description into a clear, concise, actionable prompt for a coding agent. Keep the user's language. Output ONLY the improved prompt text — no preamble, no quotes, no markdown fences."
	return sys + "\n\nTask title: " + title + "\n\nRough description:\n" + body
}

// deepPromptArgs uses the modern low-latency invocation: quiet chat with
// minimal reasoning instead of the legacy --cli --oneshot flow.
func deepPromptArgs() []string {
	return []string{"chat", "-Q", "--reasoning", "minimal", "--query-file", "-"}
}

// ImprovePrompt rewrites a rough task body into a clear, actionable prompt
// using the default profile's model via `hermes chat -Q --reasoning minimal`.
// Timeout 45s. Returns the improved text (whitespace-trimmed).
func ImprovePrompt(title, body string) (string, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 45*time.Second)
	defer cancel()
	cmd := exec.CommandContext(ctx, "hermes", deepPromptArgs()...)
	cmd.Stdin = strings.NewReader(deepPromptText(title, body))
	out, err := cmd.Output()
	if err != nil {
		if ctx.Err() == context.DeadlineExceeded {
			return "", errTimeout
		}
		return "", fmt.Errorf("hermes chat failed: %s", trimErr(err))
	}
	text := strings.TrimSpace(string(out))
	// strip wrapping fences if the model added them anyway
	text = strings.TrimPrefix(text, "```\n")
	text = strings.TrimSuffix(text, "\n```")
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

func (timeoutError) Error() string { return "AI improve timeout (>45s) — coba lagi" }

var (
	errTimeout = timeoutError{}
	errEmpty   = stringsError("AI returned empty response")
)

type stringsError string

func (s stringsError) Error() string { return string(s) }
