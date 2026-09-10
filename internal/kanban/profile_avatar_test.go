package kanban

import (
	"os"
	"path/filepath"
	"testing"
)

func TestSetProfileAvatarWritesAndReads(t *testing.T) {
	patchProfilesHome(t)
	// minimal real GIF bytes (1x1 transparent) — format sniffed by content
	gif := []byte("GIF89a\x01\x00\x01\x00\x80\x00\x00\x00\x00\x00\xff\xff\xff!\xf9\x04\x01\x00\x00\x00\x00,\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02D\x01\x00;")
	if err := SetProfileAvatar("base", "image/gif", gif); err != nil {
		t.Fatal(err)
	}
	got, mt, ok := ProfileAvatar("base")
	if !ok || mt != "image/gif" || string(got) != string(gif) {
		t.Fatalf("avatar roundtrip failed: ok=%v mt=%q len=%d", ok, mt, len(got))
	}
	// avatar.json should sit inside the profile dir, not pollute config.yaml
	if _, err := os.Stat(filepath.Join(profileDir("base"), "avatar.json")); err != nil {
		t.Fatalf("avatar.json missing: %v", err)
	}
	if raw, err := os.ReadFile(filepath.Join(profileDir("base"), "config.yaml")); err == nil {
		if len(raw) > 0 && raw[0] != 'm' {
			t.Errorf("config.yaml polluted: %q", string(raw[:min(len(raw), 20)]))
		}
	}
}

func TestProfileAvatarAcceptsGenericMultipartMime(t *testing.T) {
	patchProfilesHome(t)
	gif := []byte("GIF89a\x01\x00\x01\x00\x80\x00\x00\x00\x00\x00\xff\xff\xff!\xf9\x04\x01\x00\x00\x00\x00,\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02D\x01\x00;")
	if err := SetProfileAvatar("base", "application/octet-stream", gif); err != nil {
		t.Fatalf("generic multipart mime rejected: %v", err)
	}
	if _, mime, ok := ProfileAvatar("base"); !ok || mime != "image/gif" {
		t.Fatalf("generic mime did not persist sniffed mime: ok=%v mime=%q", ok, mime)
	}
}

func TestProfileAvatarAcceptsPngJpegWebp(t *testing.T) {
	patchProfilesHome(t)
	// PNG signature
	png := []byte("\x89PNG\r\n\x1a\n" + string(make([]byte, 32)))
	if err := SetProfileAvatar("base", "image/png", png); err != nil {
		t.Fatalf("png rejected: %v", err)
	}
	// JPEG signature
	jpg := []byte("\xff\xd8\xff\xe0" + string(make([]byte, 32)))
	if err := SetProfileAvatar("base", "image/jpeg", jpg); err != nil {
		t.Fatalf("jpeg rejected: %v", err)
	}
	// WebP signature (RIFF....WEBP)
	webp := []byte("RIFF\x24\x00\x00\x00WEBPVP8 " + string(make([]byte, 24)))
	if err := SetProfileAvatar("base", "image/webp", webp); err != nil {
		t.Fatalf("webp rejected: %v", err)
	}
	// animated gif = plain gif, same path
	gif := []byte("GIF89a\x01\x00\x01\x00\x80\x00\x00\x00\x00\x00\xff\xff\xff!\xf9\x04\x01\x00\x00\x00\x00,\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02D\x01\x00;")
	if err := SetProfileAvatar("base", "image/gif", gif); err != nil {
		t.Fatalf("gif rejected: %v", err)
	}
	if _, mt, _ := ProfileAvatar("base"); mt != "image/gif" {
		t.Fatalf("mime: %q", mt)
	}
}

func TestProfileAvatarRejectsBadInput(t *testing.T) {
	patchProfilesHome(t)
	// bad format
	if err := SetProfileAvatar("base", "application/pdf", []byte("%PDF-1.4 fake")); err == nil {
		t.Error("pdf accepted")
	}
	if err := SetProfileAvatar("base", "text/html", []byte("<script>alert(1)</script>")); err == nil {
		t.Error("html accepted")
	}
	if err := SetProfileAvatar("base", "image/svg+xml", []byte("<svg onload=alert(1)>")); err == nil {
		t.Error("svg accepted — scriptable vector must fail closed")
	}
	// oversized payload rejected (no truncation writes)
	if err := SetProfileAvatar("base", "image/gif", make([]byte, maxAvatarBytes+1)); err == nil {
		t.Error("oversized accepted")
	}
	// ghost profile refused
	if err := SetProfileAvatar("ghost", "image/gif", []byte("GIF89a")); err == nil {
		t.Error("ghost profile accepted")
	}
	// traversal-style name refused
	if err := SetProfileAvatar("../evil", "image/gif", []byte("GIF89a")); err == nil {
		t.Error("traversal name accepted")
	}
}

func TestSetProfileAvatarURLValid(t *testing.T) {
	patchProfilesHome(t)
	if err := SetProfileAvatarURL("base", "https://picsum.photos/200"); err != nil {
		t.Fatalf("set url: %v", err)
	}
	if got := ProfileAvatarURL("base"); got != "https://picsum.photos/200" {
		t.Fatalf("url read back: %q", got)
	}
	if _, _, ok := ProfileAvatar("base"); ok {
		t.Fatal("url mode should not fake bytes")
	}
}

func TestSetProfileAvatarURLFailsClosed(t *testing.T) {
	patchProfilesHome(t)
	if err := SetProfileAvatarURL("base", "not-a-url"); err == nil {
		t.Error("bad url accepted")
	}
	if err := SetProfileAvatarURL("base", "http://127.0.0.1/x.png"); err == nil {
		t.Error("loopback accepted")
	}
	if err := SetProfileAvatarURL("base", "http://10.0.0.1/x.png"); err == nil {
		t.Error("private ip accepted")
	}
	if err := SetProfileAvatarURL("base", "http://user:pass@example.com/x.png"); err == nil {
		t.Error("user-info accepted")
	}
	if err := SetProfileAvatarURL("ghost", "https://example.com/x.png"); err == nil {
		t.Error("ghost profile accepted")
	}
}

func TestRemoveProfileAvatar(t *testing.T) {
	patchProfilesHome(t)
	gif := []byte("GIF89a")
	if err := SetProfileAvatar("base", "image/gif", gif); err != nil {
		t.Fatal(err)
	}
	if err := RemoveProfileAvatar("base"); err != nil {
		t.Fatal(err)
	}
	if _, _, ok := ProfileAvatar("base"); ok {
		t.Error("avatar still present after remove")
	}
	// remove again is idempotent (no error)
	if err := RemoveProfileAvatar("base"); err != nil {
		t.Errorf("second remove failed: %v", err)
	}
}

func TestProfileAvatarGhostRead(t *testing.T) {
	patchProfilesHome(t)
	if _, _, ok := ProfileAvatar("ghost"); ok {
		t.Error("ghost profile avatar reported present")
	}
}
