package main

import (
	"database/sql"
	"log"

	_ "github.com/mattn/go-sqlite3"
)

var db *sql.DB

func initDB(path string) {
	var err error
	db, err = sql.Open("sqlite3", path+"?_journal_mode=WAL")
	if err != nil {
		log.Fatal("failed to open db:", err)
	}

	schema := `
	CREATE TABLE IF NOT EXISTS users (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		username TEXT UNIQUE NOT NULL,
		pass_hash TEXT NOT NULL,
		public_key TEXT NOT NULL DEFAULT '',
		created_at TEXT NOT NULL
	);
	CREATE TABLE IF NOT EXISTS pending_messages (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		from_user TEXT NOT NULL,
		to_user TEXT NOT NULL,
		ciphertext TEXT NOT NULL,
		nonce TEXT NOT NULL,
		created_at TEXT NOT NULL
	);
	CREATE INDEX IF NOT EXISTS idx_pending_to ON pending_messages(to_user);
	`
	if _, err := db.Exec(schema); err != nil {
		log.Fatal("failed to create schema:", err)
	}
	log.Println("database initialized")
}

func createUser(username, passHash, publicKey string) error {
	_, err := db.Exec(
		"INSERT INTO users (username, pass_hash, public_key, created_at) VALUES (?, ?, ?, ?)",
		username, passHash, publicKey, nowStr(),
	)
	return err
}

func getUserByUsername(username string) (*User, error) {
	u := &User{}
	err := db.QueryRow(
		"SELECT id, username, pass_hash, public_key, created_at FROM users WHERE username = ?",
		username,
	).Scan(&u.ID, &u.Username, &u.PassHash, &u.PublicKey, &u.CreatedAt)
	if err != nil {
		return nil, err
	}
	return u, nil
}

func searchUsers(query string) ([]SearchResult, error) {
	rows, err := db.Query(
		"SELECT username, public_key FROM users WHERE username LIKE ? LIMIT 20",
		"%"+query+"%",
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []SearchResult
	for rows.Next() {
		var r SearchResult
		if err := rows.Scan(&r.Username, &r.PublicKey); err != nil {
			continue
		}
		results = append(results, r)
	}
	return results, nil
}

func savePendingMessage(from, to, ciphertext, nonce string) (int64, error) {
	res, err := db.Exec(
		"INSERT INTO pending_messages (from_user, to_user, ciphertext, nonce, created_at) VALUES (?, ?, ?, ?, ?)",
		from, to, ciphertext, nonce, nowStr(),
	)
	if err != nil {
		return 0, err
	}
	return res.LastInsertId()
}

func getPendingMessages(username string) ([]PendingMessage, error) {
	rows, err := db.Query(
		"SELECT id, from_user, to_user, ciphertext, nonce, created_at FROM pending_messages WHERE to_user = ? ORDER BY id",
		username,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var msgs []PendingMessage
	for rows.Next() {
		var m PendingMessage
		if err := rows.Scan(&m.ID, &m.FromUser, &m.ToUser, &m.Ciphertext, &m.Nonce, &m.CreatedAt); err != nil {
			continue
		}
		msgs = append(msgs, m)
	}
	return msgs, nil
}

func deletePendingMessage(id int64) error {
	_, err := db.Exec("DELETE FROM pending_messages WHERE id = ?", id)
	return err
}

func deletePendingMessagesForUser(username string) error {
	_, err := db.Exec("DELETE FROM pending_messages WHERE to_user = ?", username)
	return err
}
