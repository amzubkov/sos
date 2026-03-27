package main

import (
	"flag"
	"log"
	"net/http"
)

func main() {
	addr := flag.String("addr", ":8080", "listen address")
	dbPath := flag.String("db", "sos.db", "sqlite database path")
	secret := flag.String("secret", "", "jwt secret (required)")
	flag.Parse()

	if *secret != "" {
		jwtSecret = []byte(*secret)
	} else {
		log.Println("WARNING: using default JWT secret, set -secret for production")
	}

	initDB(*dbPath)
	initServerKeys()

	http.HandleFunc("/handshake", handleHandshake)
	http.HandleFunc("/register", handleRegister)
	http.HandleFunc("/login", handleLogin)
	http.HandleFunc("/search", handleSearch)
	http.HandleFunc("/ws", handleWS)

	log.Printf("SOS server starting on %s", *addr)
	if err := http.ListenAndServe(*addr, nil); err != nil {
		log.Fatal(err)
	}
}
