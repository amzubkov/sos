package main

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"

	"golang.org/x/crypto/nacl/box"
)

var serverPublicKey [32]byte
var serverPrivateKey [32]byte

const keyFile = "server_keys.json"

type serverKeys struct {
	Public  string `json:"public"`
	Private string `json:"private"`
}

func initServerKeys() {
	// Try to load existing keys
	data, err := os.ReadFile(keyFile)
	if err == nil {
		var keys serverKeys
		if json.Unmarshal(data, &keys) == nil {
			pub, _ := base64.StdEncoding.DecodeString(keys.Public)
			priv, _ := base64.StdEncoding.DecodeString(keys.Private)
			if len(pub) == 32 && len(priv) == 32 {
				copy(serverPublicKey[:], pub)
				copy(serverPrivateKey[:], priv)
				log.Println("server keys loaded from", keyFile)
				return
			}
		}
	}

	// Generate new keys
	pub, priv, err := box.GenerateKey(rand.Reader)
	if err != nil {
		log.Fatal("failed to generate server keys:", err)
	}
	serverPublicKey = *pub
	serverPrivateKey = *priv

	// Save to file
	keys := serverKeys{
		Public:  base64.StdEncoding.EncodeToString(pub[:]),
		Private: base64.StdEncoding.EncodeToString(priv[:]),
	}
	data, _ = json.Marshal(keys)
	os.WriteFile(keyFile, data, 0600)
	log.Println("server keys generated and saved")
}

func handleHandshake(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"public_key": base64.StdEncoding.EncodeToString(serverPublicKey[:]),
	})
}

// decryptPassword decrypts password sent by client using NaCl box.
// Client sends: ephemeral_public_key (base64), encrypted (base64), nonce (base64)
func decryptPassword(ephemeralPubB64, encryptedB64, nonceB64 string) (string, error) {
	ephemeralPub, err := base64.StdEncoding.DecodeString(ephemeralPubB64)
	if err != nil {
		return "", fmt.Errorf("invalid ephemeral key")
	}
	encrypted, err := base64.StdEncoding.DecodeString(encryptedB64)
	if err != nil {
		return "", fmt.Errorf("invalid ciphertext")
	}
	nonceBytes, err := base64.StdEncoding.DecodeString(nonceB64)
	if err != nil {
		return "", fmt.Errorf("invalid nonce")
	}

	if len(ephemeralPub) != 32 || len(nonceBytes) != 24 {
		return "", fmt.Errorf("invalid key/nonce length")
	}

	var epk [32]byte
	var nonce [24]byte
	copy(epk[:], ephemeralPub)
	copy(nonce[:], nonceBytes)

	decrypted, ok := box.Open(nil, encrypted, &nonce, &epk, &serverPrivateKey)
	if !ok {
		return "", fmt.Errorf("decryption failed")
	}

	return string(decrypted), nil
}
