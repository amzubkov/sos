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
	turn := flag.String("turn-secret", "", "coturn shared secret")
	flag.Parse()

	if *secret != "" {
		jwtSecret = []byte(*secret)
	} else {
		log.Println("WARNING: using default JWT secret, set -secret for production")
	}
	if *turn != "" {
		turnSecret = *turn
	}

	initDB(*dbPath)
	initServerKeys()

	// Serve web client
	http.Handle("/web/", http.StripPrefix("/web/", http.FileServer(http.Dir("web"))))
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/" {
			http.Redirect(w, r, "/web/", http.StatusFound)
			return
		}
		http.NotFound(w, r)
	})

	http.HandleFunc("/handshake", handleHandshake)
	http.HandleFunc("/register", handleRegister)
	http.HandleFunc("/login", handleLogin)
	http.HandleFunc("/search", handleSearch)
	http.HandleFunc("/ws", handleWS)
	http.HandleFunc("/turn", handleTURN)

	log.Printf("SOS server starting on %s", *addr)
	if err := http.ListenAndServe(*addr, nil); err != nil {
		log.Fatal(err)
	}
}
