package kanban

import (
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	_ "modernc.org/sqlite"
)

const authSessionDays = 14

func authDBPath() string { return filepath.Join(hermesHome(), "kanban", "auth.db") }

func openAuthDB() (*sql.DB, error) {
	if err := os.MkdirAll(filepath.Dir(authDBPath()), 0o700); err != nil {
		return nil, err
	}
	db, err := sql.Open("sqlite", fmt.Sprintf("file:%s?_pragma=busy_timeout(5000)&_pragma=journal_mode(WAL)", authDBPath()))
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(1)
	if _, err := db.Exec(`CREATE TABLE IF NOT EXISTS auth_config (id INTEGER PRIMARY KEY CHECK (id=1), salt TEXT NOT NULL, password_hash TEXT NOT NULL); CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, expires_at INTEGER NOT NULL);`); err != nil {
		db.Close()
		return nil, err
	}
	return db, nil
}

func hashPassword(password, salt string) string {
	v := []byte(salt + ":" + password)
	for i := 0; i < 120000; i++ {
		sum := sha256.Sum256(v)
		v = sum[:]
	}
	return hex.EncodeToString(v)
}

func newSalt() (string, error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}
func hashToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

func EnsureAuthSeed() error {
	db, err := openAuthDB()
	if err != nil {
		return err
	}
	defer db.Close()
	var count int
	if err := db.QueryRow(`SELECT COUNT(*) FROM auth_config`).Scan(&count); err != nil {
		return err
	}
	if count > 0 {
		return nil
	}
	salt, err := newSalt()
	if err != nil {
		return err
	}
	_, err = db.Exec(`INSERT INTO auth_config (id,salt,password_hash) VALUES (1,?,?)`, salt, hashPassword("123456", salt))
	return err
}

func VerifyPassword(password string) (bool, error) {
	db, err := openAuthDB()
	if err != nil {
		return false, err
	}
	defer db.Close()
	var salt, expected string
	if err := db.QueryRow(`SELECT salt,password_hash FROM auth_config WHERE id=1`).Scan(&salt, &expected); err != nil {
		return false, err
	}
	return hashPassword(password, salt) == expected, nil
}

func ChangePassword(current, next string) error {
	if len([]rune(next)) < 6 {
		return errors.New("password must be at least 6 characters")
	}
	ok, err := VerifyPassword(current)
	if err != nil {
		return err
	}
	if !ok {
		return errors.New("current password is incorrect")
	}
	db, err := openAuthDB()
	if err != nil {
		return err
	}
	defer db.Close()
	salt, err := newSalt()
	if err != nil {
		return err
	}
	if _, err := db.Exec(`UPDATE auth_config SET salt=?,password_hash=? WHERE id=1`, salt, hashPassword(next, salt)); err != nil {
		return err
	}
	_, err = db.Exec(`DELETE FROM sessions`)
	return err
}

func CreateSession() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	token := hex.EncodeToString(b)
	db, err := openAuthDB()
	if err != nil {
		return "", err
	}
	defer db.Close()
	_, err = db.Exec(`INSERT INTO sessions (token_hash,expires_at) VALUES (?,?)`, hashToken(token), time.Now().Add(authSessionDays*24*time.Hour).Unix())
	return token, err
}

func ValidateSession(token string) (bool, error) {
	if strings.TrimSpace(token) == "" {
		return false, nil
	}
	db, err := openAuthDB()
	if err != nil {
		return false, err
	}
	defer db.Close()
	var expires int64
	if err := db.QueryRow(`SELECT expires_at FROM sessions WHERE token_hash=?`, hashToken(token)).Scan(&expires); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return false, nil
		}
		return false, err
	}
	if expires <= time.Now().Unix() {
		_, _ = db.Exec(`DELETE FROM sessions WHERE token_hash=?`, hashToken(token))
		return false, nil
	}
	return true, nil
}

func DeleteSession(token string) error {
	db, err := openAuthDB()
	if err != nil {
		return err
	}
	defer db.Close()
	_, err = db.Exec(`DELETE FROM sessions WHERE token_hash=?`, hashToken(token))
	return err
}
