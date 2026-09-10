package kanban

import (
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
)

const maxAvatarBytes = 2 * 1024 * 1024 // 2 MiB

var allowedAvatarMimes = map[string]bool{
	"image/png":  true,
	"image/jpeg": true,
	"image/gif":  true,
	"image/webp": true,
}

type avatarMeta struct {
	Mime string `json:"mime,omitempty"`
	URL  string `json:"url,omitempty"`
}

func validAvatarURL(raw string) bool {
	u, err := url.Parse(strings.TrimSpace(raw))
	if err != nil || u.User != nil || u.Host == "" || u.Path == "" {
		return false
	}
	if u.Scheme != "https" && u.Scheme != "http" {
		return false
	}
	host := u.Hostname()
	if ip := net.ParseIP(host); ip != nil && (ip.IsLoopback() || ip.IsPrivate() || ip.IsLinkLocalUnicast() || ip.IsUnspecified()) {
		return false
	}
	return true
}

func SetProfileAvatarURL(name, rawURL string) error {
	name = strings.TrimSpace(name)
	if !profileExists(name) {
		return fmt.Errorf("profile %q not found", name)
	}
	rawURL = strings.TrimSpace(rawURL)
	if rawURL == "" {
		return fmt.Errorf("avatar URL empty")
	}
	if len(rawURL) > 2048 {
		return fmt.Errorf("avatar URL too long")
	}
	if !validAvatarURL(rawURL) {
		return fmt.Errorf("avatar URL must be public http(s) URL")
	}
	dir := profileDir(name)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return err
	}
	rawPath, metaPath := avatarPaths(name)
	_ = os.Remove(rawPath)
	metaRaw, _ := json.Marshal(avatarMeta{URL: rawURL})
	return os.WriteFile(metaPath, metaRaw, 0o644)
}

func ProfileAvatarURL(name string) string {
	_, metaPath := avatarPaths(name)
	raw, err := os.ReadFile(metaPath)
	if err != nil {
		return ""
	}
	var meta avatarMeta
	if json.Unmarshal(raw, &meta) != nil {
		return ""
	}
	return meta.URL
}

func avatarPaths(name string) (string, string) {
	dir := profileDir(name)
	return filepath.Join(dir, "avatar"), filepath.Join(dir, "avatar.json")
}

func hasAvatar(name string) bool {
	rawPath, metaPath := avatarPaths(name)
	if _, err := os.Stat(rawPath); err != nil {
		return false
	}
	if _, err := os.Stat(metaPath); err != nil {
		return false
	}
	return true
}

// ProfileAvatar returns raw bytes + mime when avatar exists.
func ProfileAvatar(name string) ([]byte, string, bool) {
	if !profileExists(name) {
		return nil, "", false
	}
	rawPath, metaPath := avatarPaths(name)
	metaRaw, err := os.ReadFile(metaPath)
	if err != nil {
		return nil, "", false
	}
	var m avatarMeta
	if err := json.Unmarshal(metaRaw, &m); err != nil || m.Mime == "" {
		return nil, "", false
	}
	data, err := os.ReadFile(rawPath)
	if err != nil {
		return nil, "", false
	}
	return data, m.Mime, true
}

// SetProfileAvatar validates and stores avatar for a profile.
// mime is the multipart part Content-Type (untrusted). The trust boundary
// is the sniffed content type — browsers and Go's CreateFormFile default to
// application/octet-stream, so we cannot fail on declared mime alone.
func SetProfileAvatar(name, mime string, data []byte) error {
	name = strings.TrimSpace(name)
	if name == "" || strings.Contains(name, "/") || strings.Contains(name, "..") {
		return fmt.Errorf("invalid profile name %q", name)
	}
	if !profileExists(name) {
		return fmt.Errorf("profile %q not found", name)
	}
	mime = strings.ToLower(strings.TrimSpace(mime))
	if mime == "image/jpg" {
		mime = "image/jpeg"
	}
	isGeneric := mime == "" || mime == "application/octet-stream" || mime == "binary/octet-stream"
	if !isGeneric && !allowedAvatarMimes[mime] {
		return fmt.Errorf("unsupported avatar type %q", mime)
	}
	if len(data) == 0 {
		return fmt.Errorf("avatar empty")
	}
	if len(data) > maxAvatarBytes {
		return fmt.Errorf("avatar too large (%d > %d)", len(data), maxAvatarBytes)
	}
	sniffed := http.DetectContentType(data)
	if !allowedAvatarMimes[sniffed] {
		return fmt.Errorf("avatar content type %q not allowed", sniffed)
	}
	if !isGeneric && sniffed != mime {
		return fmt.Errorf("mime %q does not match content %q", mime, sniffed)
	}
	dir := profileDir(name)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return err
	}
	rawPath, metaPath := avatarPaths(name)
	tmpRaw := rawPath + ".tmp"
	if err := os.WriteFile(tmpRaw, data, 0o644); err != nil {
		return err
	}
	if err := os.Rename(tmpRaw, rawPath); err != nil {
		_ = os.Remove(tmpRaw)
		return err
	}
	meta := avatarMeta{Mime: sniffed}
	metaRaw, _ := json.Marshal(meta)
	tmpMeta := metaPath + ".tmp"
	if err := os.WriteFile(tmpMeta, metaRaw, 0o644); err != nil {
		return err
	}
	if err := os.Rename(tmpMeta, metaPath); err != nil {
		_ = os.Remove(tmpMeta)
		return err
	}
	return nil
}

// RemoveProfileAvatar deletes avatar files if present.
func RemoveProfileAvatar(name string) error {
	if !profileExists(name) {
		return fmt.Errorf("profile %q not found", name)
	}
	rawPath, metaPath := avatarPaths(name)
	_ = os.Remove(rawPath)
	_ = os.Remove(metaPath)
	return nil
}
