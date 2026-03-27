# SOS Messenger

Personal E2E encrypted messenger. Go server + React Native Android client.

## Server

### Files on server (`/opt/sos-server/`)

| File | Description |
|------|------------|
| `sos-server` | Go binary |
| `sos.db` | SQLite database (users, pending messages) |
| `server_keys.json` | **Server X25519 keypair for auth encryption. MUST be migrated with the server.** |

### Migration to another server

1. Stop the service: `systemctl stop sos`
2. Copy the entire `/opt/sos-server/` directory to the new server
3. The critical files are:
   - `server_keys.json` — without this, existing clients won't be able to authenticate (their encrypted passwords will fail to decrypt)
   - `sos.db` — user accounts and pending messages
4. Install Go, build, create systemd service, start

### Running

```bash
./sos-server -addr :9090 -secret "your-jwt-secret"
```

### Systemd service

```
/etc/systemd/system/sos.service
```

## Client

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

## Security

- Messages: E2E encrypted (X25519 + XSalsa20-Poly1305)
- Auth: password encrypted with server's X25519 public key (ephemeral ECDH handshake)
- Server never sees plaintext messages
- Server sees plaintext only after decrypting auth requests
