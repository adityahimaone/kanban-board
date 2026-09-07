package kanban

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// PatchBoard updates board.json metadata (name/icon/color) for an existing board.
func PatchBoard(slug, name, icon, color string) (*Board, error) {
	dir := boardDir(slug)
	metaPath := filepath.Join(dir, "board.json")
	raw, err := os.ReadFile(metaPath)
	if err != nil {
		return nil, fmt.Errorf("board %q not found", slug)
	}
	var meta map[string]any
	if err := json.Unmarshal(raw, &meta); err != nil {
		return nil, err
	}
	b := Board{Slug: slug}
	if v, ok := meta["icon"].(string); ok {
		b.Icon = v
	}
	if v, ok := meta["color"].(string); ok {
		b.Color = v
	}
	if name != "" {
		meta["name"] = name
		b.Name = name
	} else if v, ok := meta["name"].(string); ok {
		b.Name = v
	}
	if icon != "" {
		meta["icon"] = icon
		b.Icon = icon
	}
	if color != "" {
		meta["color"] = color
		b.Color = color
	}
	out, err := json.MarshalIndent(meta, "", "  ")
	if err != nil {
		return nil, err
	}
	if err := os.WriteFile(metaPath, append(out, '\n'), 0o644); err != nil {
		return nil, err
	}
	return &b, nil
}

// CreateBoard makes a new board directory with a minimal board.json and an
// empty kanban.db (schema created lazily by openDB callers / hermes CLI init).
func CreateBoard(slug, name, icon, color string) (*Board, error) {
	slug = strings.ToLower(strings.TrimSpace(slug))
	if slug == "" {
		return nil, fmt.Errorf("slug required")
	}
	if strings.ContainsAny(slug, "/\\ ") {
		return nil, fmt.Errorf("invalid slug %q", slug)
	}
	if name == "" {
		name = slug
	}
	if icon == "" {
		icon = "🗂"
	}
	if color == "" {
		color = "#10e0dd"
	}
	dir := filepath.Join(hermesHome(), "kanban", "boards", slug)
	if _, err := os.Stat(filepath.Join(dir, "board.json")); err == nil {
		return nil, fmt.Errorf("board %q already exists", slug)
	}
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return nil, err
	}
	b := Board{Slug: slug, Name: name, Icon: icon, Color: color}
	meta := map[string]any{
		"slug": slug, "name": name, "description": "", "icon": icon,
		"color": color, "default_workdir": nil, "project_id": nil,
		"created_at": time.Now().Unix(), "archived": false,
	}
	raw, err := json.MarshalIndent(meta, "", "  ")
	if err != nil {
		return nil, err
	}
	if err := os.WriteFile(filepath.Join(dir, "board.json"), append(raw, '\n'), 0o644); err != nil {
		return nil, err
	}
	return &b, nil
}
