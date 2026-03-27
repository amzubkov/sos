# SOS Messenger

Personal E2E encrypted messenger. Go server + React Native Android client + Web client.

## Server

### Files on server (`/opt/sos-server/`)

| File | Description |
|------|------------|
| `sos-server` | Go binary |
| `sos.db` | SQLite database (users, pending messages) |
| `server_keys.json` | **Server X25519 keypair for auth encryption. MUST be migrated.** |
| `web/` | Web client static files |

### Running

```bash
./sos-server -addr :9090 -secret "your-jwt-secret" -turn-secret "your-coturn-secret"
```

### Systemd service

```
/etc/systemd/system/sos.service
```

### TURN server (coturn)

Config: `/etc/turnserver.conf`
- Port 3478 (STUN/TURN UDP+TCP)
- Port 5349 (TURN TLS — works in China)
- Shared secret auth (same `-turn-secret` as Go server)

### Migration to another server

1. Stop services: `systemctl stop sos coturn`
2. Copy `/opt/sos-server/` directory (especially `server_keys.json` and `sos.db`)
3. Install Go 1.23+, build: `cd /opt/sos-server && go build -o sos-server .`
4. Install coturn: `apt install coturn`, copy `/etc/turnserver.conf`
5. Update firewall: ports 9090, 3478, 5349, 49152-65535/udp
6. Create systemd service, start both `sos` and `coturn`
7. Update TURN server IP in `server/turn.go` if IP changed

## Web Client

Accessible at `http://<SERVER_IP>:9090/web/`

Built-in — served by Go server, no separate deploy needed.
Same E2E encryption as mobile client (tweetnacl in browser).

## Android Client

### Config

`client/src/config.ts` — server IP (not in git):
```ts
export const SERVER_URL = 'http://<SERVER_IP>:9090';
export const WS_URL = 'ws://<SERVER_IP>:9090';
```

### Build APK

```bash
cd client/android
ANDROID_HOME=$HOME/Library/Android/sdk \
JAVA_HOME=/Library/Java/JavaVirtualMachines/temurin-21.jdk/Contents/Home \
./gradlew assembleRelease
```

Output: `client/android/app/build/outputs/apk/release/app-release.apk`
Copy to: `apk/sos-<version>.apk`

### Features
- E2E encrypted text messages
- Audio calls (WebRTC P2P with TURN fallback)
- Background service — receives messages and shows notifications when app is in background
- Offline message queue — server holds encrypted messages until recipient connects

## Security

- **Messages**: E2E encrypted (X25519 + XSalsa20-Poly1305 / NaCl box)
- **Auth**: password encrypted with server's X25519 public key (ephemeral ECDH handshake per request)
- **Calls**: WebRTC SRTP+DTLS (encrypted by default), TURN relay for NAT/firewall traversal
- **Server never sees**: plaintext messages, call audio
- **Server sees**: usernames, public keys, encrypted message queue, auth passwords (after decryption)
