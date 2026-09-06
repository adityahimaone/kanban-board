package kanban

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

// AgentProfile is a hermes agent profile: ~/.hermes/profiles/<name>/.
// config.yaml holds model/provider, SOUL.md is the system prompt, skills/ is
// the list of skill dirs. CRUD edits only these three surfaces.
type AgentProfile struct {
	Name     string `json:"name"`
	Model    string `json:"model"`
	Provider string `json:"provider"`
	Active   bool   `json:"active"`
	Valid    bool   `json:"valid"`
	BaseURL  string `json:"base_url,omitempty"`

	SystemPrompt string   `json:"system_prompt"` // SOUL.md content
	Skills       []string `json:"skills"`        // dir names under skills/
}

type ProfileInput struct {
	Model        string   `json:"model"`
	Provider     string   `json:"provider"`
	SystemPrompt *string  `json:"system_prompt"` // nil = leave untouched
	Skills       []string `json:"skills"`
}

func profileDir(name string) string {
	if name == "default" {
		return hermesHome()
	}
	return filepath.Join(hermesHome(), "profiles", name)
}

func profileExists(name string) bool {
	name = strings.TrimSpace(name)
	if name == "" || strings.Contains(name, "/") || strings.Contains(name, "..") {
		return false
	}
	if name == "default" {
		return true // implicit profile backed by ~/.hermes/config.yaml
	}
	st, err := os.Stat(filepath.Join(hermesHome(), "profiles", name))
	return err == nil && st.IsDir()
}

func listProfileSkills(dir string) []string {
	out := []string{}
	entries, err := os.ReadDir(filepath.Join(dir, "skills"))
	if err != nil {
		return out
	}
	for _, e := range entries {
		if e.IsDir() {
			out = append(out, e.Name())
		}
	}
	sort.Strings(out)
	return out
}

// GetProfile returns one profile with SOUL.md + skills.
func GetProfile(name string) (*AgentProfile, error) {
	if !profileExists(name) {
		return nil, fmt.Errorf("profile %q not found", name)
	}
	dir := profileDir(name)
	p := &AgentProfile{Name: name, Skills: []string{}}
	if name == "default" {
		p.Active = true
	}
	if raw, err := os.ReadFile(filepath.Join(dir, "config.yaml")); err == nil {
		p.Model, p.Provider, p.BaseURL = parseModelYAML(string(raw))
	}
	p.Valid = profileValid(p.Provider)
	if raw, err := os.ReadFile(filepath.Join(dir, "SOUL.md")); err == nil {
		p.SystemPrompt = string(raw)
	}
	p.Skills = listProfileSkills(dir)
	return p, nil
}

// ListProfilesFull = ListProfiles + prompt/skills presence (cheap variant for cards).
func ListProfilesFull() ([]*AgentProfile, error) {
	out := []*AgentProfile{}
	proot := filepath.Join(hermesHome(), "profiles")
	entries, err := os.ReadDir(proot)
	if err == nil {
		for _, e := range entries {
			if !e.IsDir() {
				continue
			}
			p, err := GetProfile(e.Name())
			if err != nil {
				continue
			}
			out = append(out, p)
		}
	}
	if _, err := os.Stat(filepath.Join(hermesHome(), "config.yaml")); err == nil || profileExists("default") {
		if p, err := GetProfile("default"); err == nil {
			out = append(out, p)
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Name < out[j].Name })
	return out, nil
}

// CreateProfile makes a new profile dir with config.yaml (+ optional SOUL.md),
// copying model defaults from an existing template profile so the worker can
// actually boot (api_key/base_url come along — same trust domain, VPS-local).
func CreateProfile(name string, in ProfileInput) error {
	name = strings.TrimSpace(name)
	if name == "" || !validProfileName(name) {
		return fmt.Errorf("invalid profile name %q", name)
	}
	if profileExists(name) {
		return fmt.Errorf("profile %q already exists", name)
	}
	if !profileValid(in.Provider) {
		return fmt.Errorf("invalid provider %q — worker would crash (Unknown provider)", in.Provider)
	}
	dir := filepath.Join(hermesHome(), "profiles", name)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return err
	}
	// copy config from default if present (brings api_key/base_url), then patch model
	if raw, err := os.ReadFile(filepath.Join(hermesHome(), "config.yaml")); err == nil {
		_ = os.WriteFile(filepath.Join(dir, "config.yaml"), raw, 0o600)
	}
	if err := PatchProfile(name, ProfileInput{Model: in.Model, Provider: in.Provider}); err != nil {
		return err
	}
	if in.SystemPrompt != nil && strings.TrimSpace(*in.SystemPrompt) != "" {
		if err := os.WriteFile(filepath.Join(dir, "SOUL.md"), []byte(*in.SystemPrompt), 0o644); err != nil {
			return err
		}
	}
	return nil
}

// PatchProfile edits model/provider in config.yaml and/or rewrites SOUL.md.
// Skills list is read-only here (skill dirs are managed by hermes CLI).
func PatchProfile(name string, in ProfileInput) error {
	if !profileExists(name) {
		return fmt.Errorf("profile %q not found", name)
	}
	dir := profileDir(name)
	cfgPath := filepath.Join(dir, "config.yaml")

	if in.Model != "" || in.Provider != "" {
		raw, err := os.ReadFile(cfgPath)
		if err != nil {
			return fmt.Errorf("config.yaml missing: %w", err)
		}
		updated, err := patchModelYAML(string(raw), in.Model, in.Provider)
		if err != nil {
			return err
		}
		if err := os.WriteFile(cfgPath, []byte(updated), 0o600); err != nil {
			return err
		}
	}
	if in.SystemPrompt != nil {
		if err := os.WriteFile(filepath.Join(dir, "SOUL.md"), []byte(*in.SystemPrompt), 0o644); err != nil {
			return err
		}
	}
	return nil
}

// DeleteProfile removes a profile dir (never "default").
func DeleteProfile(name string) error {
	if name == "default" {
		return fmt.Errorf("cannot delete default profile")
	}
	if !profileExists(name) {
		return fmt.Errorf("profile %q not found", name)
	}
	return os.RemoveAll(filepath.Join(hermesHome(), "profiles", name))
}

func validProfileName(s string) bool {
	if len(s) > 32 {
		return false
	}
	for _, r := range s {
		ok := r == '-' || r == '_' || (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9')
		if !ok {
			return false
		}
	}
	return len(s) > 0
}

// patchModelYAML sets model.default / model.provider inside the `model:` block,
// preserving the rest of the file byte-for-byte (api_key, base_url, ...).
func patchModelYAML(src, model, provider string) (string, error) {
	lines := strings.Split(src, "\n")
	inModel := false
	sawModel, sawProvider := false, false
	for i, line := range lines {
		trimmed := strings.TrimRight(line, " \t\r")
		switch {
		case trimmed == "model:":
			inModel = true
		case inModel && strings.HasPrefix(trimmed, "  "):
			k, _, ok := strings.Cut(strings.TrimSpace(trimmed), ":")
			if !ok {
				continue
			}
			switch k {
			case "default":
				if model != "" {
					lines[i] = fmt.Sprintf("  default: %s", model)
				}
				sawModel = true
			case "provider":
				if provider != "" {
					lines[i] = fmt.Sprintf("  provider: %s", provider)
				}
				sawProvider = true
			}
		case inModel && trimmed != "" && !strings.HasPrefix(trimmed, " "):
			inModel = false
		}
	}
	if model != "" && !sawModel {
		return "", fmt.Errorf("model.default key not found in config.yaml")
	}
	if provider != "" && !sawProvider {
		return "", fmt.Errorf("model.provider key not found in config.yaml")
	}
	return strings.Join(lines, "\n"), nil
}

var _ = json.Marshal
