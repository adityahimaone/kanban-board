package kanban

import (
	"testing"
	"time"
)

func TestAuthSeedDefaultPassword(t *testing.T) {
	t.Setenv("HERMES_HOME", t.TempDir())
	if err := EnsureAuthSeed(); err != nil {
		t.Fatalf("seed: %v", err)
	}
	ok, err := VerifyPassword("123456")
	if err != nil {
		t.Fatalf("verify: %v", err)
	}
	if !ok {
		t.Fatal("default password 123456 should verify after seed")
	}
	ok, _ = VerifyPassword("wrong")
	if ok {
		t.Fatal("wrong password should not verify")
	}
}

func TestAuthVerifyAndChange(t *testing.T) {
	t.Setenv("HERMES_HOME", t.TempDir())
	if err := EnsureAuthSeed(); err != nil {
		t.Fatalf("seed: %v", err)
	}
	// change with correct current
	if err := ChangePassword("123456", "newpass123"); err != nil {
		t.Fatalf("change: %v", err)
	}
	ok, _ := VerifyPassword("newpass123")
	if !ok {
		t.Fatal("new password should verify")
	}
	ok, _ = VerifyPassword("123456")
	if ok {
		t.Fatal("old password should not verify after change")
	}
	// change with wrong current should fail
	if err := ChangePassword("wrong", "another"); err == nil {
		t.Fatal("change with wrong current should fail")
	}
}

func TestAuthChangeValidation(t *testing.T) {
	t.Setenv("HERMES_HOME", t.TempDir())
	if err := EnsureAuthSeed(); err != nil {
		t.Fatalf("seed: %v", err)
	}
	if err := ChangePassword("123456", "123"); err == nil {
		t.Fatal("too short password should be rejected")
	}
	if err := ChangePassword("123456", ""); err == nil {
		t.Fatal("empty password should be rejected")
	}
}

func TestAuthSessionCreateValidateExpiry(t *testing.T) {
	t.Setenv("HERMES_HOME", t.TempDir())
	if err := EnsureAuthSeed(); err != nil {
		t.Fatalf("seed: %v", err)
	}
	token, err := CreateSession()
	if err != nil {
		t.Fatalf("create session: %v", err)
	}
	if token == "" {
		t.Fatal("token empty")
	}
	ok, err := ValidateSession(token)
	if err != nil {
		t.Fatalf("validate: %v", err)
	}
	if !ok {
		t.Fatal("fresh session should be valid")
	}
	// invalid token
	ok, _ = ValidateSession("invalid-token")
	if ok {
		t.Fatal("invalid token should not validate")
	}
	// delete
	if err := DeleteSession(token); err != nil {
		t.Fatalf("delete: %v", err)
	}
	ok, _ = ValidateSession(token)
	if ok {
		t.Fatal("deleted session should not validate")
	}
}

func TestAuthSessionExpiry(t *testing.T) {
	t.Setenv("HERMES_HOME", t.TempDir())
	if err := EnsureAuthSeed(); err != nil {
		t.Fatalf("seed: %v", err)
	}
	token, _ := CreateSession()
	// force expire by setting expires_at in past
	db, _ := openAuthDB()
	_, _ = db.Exec(`UPDATE sessions SET expires_at=? WHERE token_hash=?`, time.Now().Add(-time.Hour).Unix(), hashToken(token))
	db.Close()
	ok, _ := ValidateSession(token)
	if ok {
		t.Fatal("expired session should not validate")
	}
}

func TestAuthChangeRevokesSessions(t *testing.T) {
	t.Setenv("HERMES_HOME", t.TempDir())
	if err := EnsureAuthSeed(); err != nil {
		t.Fatalf("seed: %v", err)
	}
	tok, _ := CreateSession()
	if err := ChangePassword("123456", "newpass456"); err != nil {
		t.Fatalf("change: %v", err)
	}
	ok, _ := ValidateSession(tok)
	if ok {
		t.Fatal("sessions should be revoked after password change")
	}
}

func authTestHashToken(tok string) string {
	return hashToken(tok)
}
