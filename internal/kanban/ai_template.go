package kanban

import "strings"

// DetectKind selects smallest useful task template from title and body.
func DetectKind(title, body string) string {
	text := strings.ToLower(title + " " + body)
	switch {
	case containsAny(text, "bug", "error", "crash", "broken", "fail"):
		return "bug"
	case containsAny(text, "ui", "layout", "css", "tampilan", "design", "visual", "card"):
		return "ui"
	case containsAny(text, "refactor", "rapikan", "cleanup", "simplify"):
		return "refactor"
	case containsAny(text, "investigate", "investigasi", "kenapa", "analyze", "cek"):
		return "investigation"
	default:
		return "feature"
	}
}

func ImprovePromptFast(title, body string) string {
	title = strings.TrimSpace(title)
	body = strings.TrimSpace(body)
	if title == "" {
		title = "Improve task"
	}
	if body == "" {
		body = "No additional description provided."
	}
	kind := DetectKind(title, body)
	return "Goal\n" + title + "\n\n" +
		"Context\n" + body + "\n\n" +
		"Requirements\n- Keep scope focused on this " + kind + " task.\n- Preserve existing behavior outside requested change.\n\n" +
		"Acceptance\n- Requested behavior works for normal and relevant edge cases.\n- No regression in related flow.\n\n" +
		"Verification\n- Run focused tests.\n- Run project build or lint check."
}

func containsAny(text string, words ...string) bool {
	for _, word := range words {
		if strings.Contains(text, word) {
			return true
		}
	}
	return false
}
