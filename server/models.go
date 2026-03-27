package main

import "time"

type User struct {
	ID        int64  `json:"id"`
	Username  string `json:"username"`
	PassHash  string `json:"-"`
	PublicKey string `json:"public_key"`
	CreatedAt string `json:"created_at"`
}

type PendingMessage struct {
	ID         int64  `json:"id"`
	FromUser   string `json:"from_user"`
	ToUser     string `json:"to_user"`
	Ciphertext string `json:"ciphertext"`
	Nonce      string `json:"nonce"`
	CreatedAt  string `json:"created_at"`
}

type WSMessage struct {
	Type       string `json:"type"`
	From       string `json:"from,omitempty"`
	To         string `json:"to,omitempty"`
	Ciphertext string `json:"ciphertext,omitempty"`
	Nonce      string `json:"nonce,omitempty"`
	PublicKey  string `json:"public_key,omitempty"`
	MessageID  int64  `json:"message_id,omitempty"`
	Text       string `json:"text,omitempty"`
	Timestamp  string `json:"timestamp,omitempty"`
}

type AuthRequest struct {
	Username     string `json:"username"`
	Password     string `json:"password,omitempty"`      // plaintext (deprecated)
	PublicKey    string `json:"public_key,omitempty"`     // user's E2E public key
	EphemeralKey string `json:"ephemeral_key,omitempty"` // encrypted auth
	Encrypted    string `json:"encrypted,omitempty"`     // encrypted password
	Nonce        string `json:"nonce,omitempty"`          // nonce for decryption
}

type AuthResponse struct {
	Token    string `json:"token"`
	Username string `json:"username"`
}

type SearchResult struct {
	Username  string `json:"username"`
	PublicKey string `json:"public_key"`
}

func nowStr() string {
	return time.Now().UTC().Format(time.RFC3339)
}
