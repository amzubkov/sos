package main

import (
	"crypto/hmac"
	"crypto/sha1"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

var turnSecret = ""

type TURNCredentials struct {
	Username string   `json:"username"`
	Password string   `json:"password"`
	TTL      int      `json:"ttl"`
	URIs     []string `json:"uris"`
}

// generateTURNCredentials creates time-limited TURN credentials
// using the shared secret (RFC 5766 long-term credentials with HMAC)
func generateTURNCredentials(username string) TURNCredentials {
	ttl := 24 * 3600 // 24 hours
	timestamp := time.Now().Unix() + int64(ttl)
	turnUsername := fmt.Sprintf("%d:%s", timestamp, username)

	mac := hmac.New(sha1.New, []byte(turnSecret))
	mac.Write([]byte(turnUsername))
	password := base64.StdEncoding.EncodeToString(mac.Sum(nil))

	return TURNCredentials{
		Username: turnUsername,
		Password: password,
		TTL:      ttl,
		URIs: []string{
			"stun:148.253.212.8:3478",
			"turn:148.253.212.8:3478?transport=udp",
			"turn:148.253.212.8:3478?transport=tcp",
			"turn:148.253.212.8:5349?transport=tcp",
		},
	}
}

func handleTURN(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	claims, err := validateToken(extractToken(r))
	if err != nil {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	creds := generateTURNCredentials(claims.Username)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(creds)
}
