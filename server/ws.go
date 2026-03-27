package main

import (
	"encoding/json"
	"log"
	"net/http"
	"sync"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

type Hub struct {
	mu    sync.RWMutex
	conns map[string]*websocket.Conn // username -> connection
}

var hub = &Hub{
	conns: make(map[string]*websocket.Conn),
}

func (h *Hub) register(username string, conn *websocket.Conn) {
	h.mu.Lock()
	// Close old connection if exists
	if old, ok := h.conns[username]; ok {
		old.Close()
	}
	h.conns[username] = conn
	h.mu.Unlock()
}

func (h *Hub) unregister(username string) {
	h.mu.Lock()
	delete(h.conns, username)
	h.mu.Unlock()
}

func (h *Hub) send(username string, msg WSMessage) bool {
	h.mu.RLock()
	conn, ok := h.conns[username]
	h.mu.RUnlock()

	if !ok {
		return false
	}

	data, err := json.Marshal(msg)
	if err != nil {
		return false
	}

	if err := conn.WriteMessage(websocket.TextMessage, data); err != nil {
		return false
	}
	return true
}

func handleWS(w http.ResponseWriter, r *http.Request) {
	// Auth via query param
	claims, err := validateToken(extractToken(r))
	if err != nil {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	username := claims.Username

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("ws upgrade error:", err)
		return
	}

	hub.register(username, conn)
	log.Printf("[ws] %s connected", username)

	// Deliver pending messages
	go deliverPending(username)

	defer func() {
		hub.unregister(username)
		conn.Close()
		log.Printf("[ws] %s disconnected", username)
	}()

	for {
		_, raw, err := conn.ReadMessage()
		if err != nil {
			break
		}

		var msg WSMessage
		if err := json.Unmarshal(raw, &msg); err != nil {
			continue
		}

		msg.From = username // server always sets the sender
		msg.Timestamp = nowStr()

		switch msg.Type {
		case "chat":
			handleChat(username, msg)
		case "ack":
			handleAck(msg)
		case "key_request":
			handleKeyRequest(username, msg)
		case "call_offer", "call_answer", "call_ice", "call_hangup":
			handleCallSignal(username, msg)
		}
	}
}

func handleChat(from string, msg WSMessage) {
	if msg.To == "" || msg.Ciphertext == "" || msg.Nonce == "" {
		hub.send(from, WSMessage{Type: "error", Text: "missing fields"})
		return
	}

	// Try direct delivery
	if hub.send(msg.To, msg) {
		return
	}

	// Recipient offline — save to pending
	id, err := savePendingMessage(from, msg.To, msg.Ciphertext, msg.Nonce)
	if err != nil {
		log.Println("failed to save pending:", err)
		hub.send(from, WSMessage{Type: "error", Text: "failed to queue message"})
		return
	}

	hub.send(from, WSMessage{Type: "ack", MessageID: id, Text: "queued"})
}

func handleAck(msg WSMessage) {
	if msg.MessageID > 0 {
		deletePendingMessage(msg.MessageID)
	}
}

func handleKeyRequest(from string, msg WSMessage) {
	if msg.To == "" {
		return
	}
	user, err := getUserByUsername(msg.To)
	if err != nil {
		hub.send(from, WSMessage{Type: "error", Text: "user not found"})
		return
	}
	hub.send(from, WSMessage{
		Type:      "key_response",
		From:      msg.To,
		PublicKey: user.PublicKey,
	})
}

func handleCallSignal(from string, msg WSMessage) {
	if msg.To == "" {
		hub.send(from, WSMessage{Type: "error", Text: "missing 'to' field"})
		return
	}
	if !hub.send(msg.To, msg) {
		hub.send(from, WSMessage{Type: "call_hangup", From: msg.To, Text: "user offline"})
	}
}

func deliverPending(username string) {
	msgs, err := getPendingMessages(username)
	if err != nil {
		log.Println("failed to get pending:", err)
		return
	}

	for _, m := range msgs {
		sent := hub.send(username, WSMessage{
			Type:       "chat",
			From:       m.FromUser,
			To:         m.ToUser,
			Ciphertext: m.Ciphertext,
			Nonce:      m.Nonce,
			MessageID:  m.ID,
			Timestamp:  m.CreatedAt,
		})
		if sent {
			deletePendingMessage(m.ID)
		}
	}
}
