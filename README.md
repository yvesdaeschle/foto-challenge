# 📸 Foto-Challenge — 12½ Jahre Adams Family

Foto-Challenge Web-App für die Party von Arienne & Andy. Gäste fotografieren 5 Challenges und laden die Bilder direkt hoch.

## Tech Stack

- **Frontend:** React + Vite, gehostet auf Cloudflare Pages
- **Backend:** Cloudflare Worker + R2 Storage
- **Fonts:** Bodoni Moda + Lora (Google Fonts)

## URLs

| Seite | Pfad |
|-------|------|
| Landing (QR-Hinweis) | `/` |
| Challenge-App | `/125` |
| Admin-Galerie | `/admin` |

## Setup

```bash
npm install
npm run dev          # Frontend lokal starten
npm run build        # Production Build
npm test             # Tests ausführen
```

### Environment-Variablen

**Cloudflare Pages:**
```
VITE_API_BASE_URL=https://your-worker.workers.dev
```

**Cloudflare Worker (wrangler.toml / Secrets):**
```
ALLOWED_ORIGIN=https://foto-challenge.pages.dev
MAX_FILE_SIZE_MB=12
wrangler secret put ADMIN_TOKEN
```

## Testing

### Unit-Tests

```bash
npm test             # einmalig
npm run test:watch   # Watch-Modus
```

28 Tests in `src/App.test.jsx` decken Routing, Challenge-State, Upload-Flow (mit MockXHR), Admin-Galerie, ConfirmDialog, Idempotenz und Reset-Flow ab.

### Smoke-Test gegen Worker

End-to-End-Tests gegen einen lebenden Worker (CORS, Auth, Upload-Validierung, Idempotenz, echtes Replace, ZIP-Integrität, Bulk-Delete). Voraussetzungen: `bash`, `curl`, `jq`, `python3`, `unzip`.

```bash
# Standard-Run gegen Production
ADMIN_TOKEN=xxx ./smoke-test.sh

# Gegen Staging-Worker
WORKER_URL=https://staging.example.workers.dev \
  ORIGIN=https://staging.foto-challenge.pages.dev \
  ADMIN_TOKEN=xxx ./smoke-test.sh
```

#### Lasttest (optional)

Lädt N Fotos parallel hoch, verifiziert die Anzahl, ruft Bulk-Delete und prüft, dass der Bucket danach leer ist.

```bash
LOAD_COUNT=100 LOAD_PARALLEL=8 ADMIN_TOKEN=xxx ./smoke-test.sh
```

| Variable        | Default | Bedeutung                                      |
|-----------------|---------|------------------------------------------------|
| `LOAD_COUNT`    | 0 (off) | Anzahl Test-Uploads. 0 deaktiviert den Test.   |
| `LOAD_PARALLEL` | 8       | Parallele Upload-Worker (`xargs -P`).          |
| `ADMIN_TOKEN`   | —       | Pflicht für Admin-Endpunkte (sonst werden sie übersprungen). |
| `WORKER_URL`    | Prod-Worker | Ziel-Worker.                              |
| `ORIGIN`        | Prod-Pages | Origin-Header für CORS-Checks.             |

### Celebration-Animation auf einem echten Gerät testen

Statt 5 Uploads durchzuspielen lässt sich die Animation direkt aufrufen:

```
https://<deine-pages-url>/125?celebrate=1
```

Die Konfetti-Animation feuert dann beim Laden der Seite einmal — nützlich, um sie schnell auf iPhones / Android Geräten zu validieren.

## Progress zurücksetzen

Es gibt zwei Wege, den Fortschritt eines Benutzers zurückzusetzen:

### 1. Versteckter Reset (in der App)

Auf der Challenge-Seite (`/125`) **5× schnell hintereinander** auf den Titel „12½ Jahre Adams Family" tippen (innerhalb von 1,5 Sekunden). Dadurch werden:

- Alle abgehakten Challenges zurückgesetzt
- Der gespeicherte Name gelöscht
- Die Namenseingabe erscheint erneut

Es erscheint ein Toast „Progress zurückgesetzt".

### 2. Manuell (Browser)

In den Browser-DevTools → Application → Local Storage → die Einträge `progress` und `userName` löschen, dann Seite neu laden.

## Admin

Unter `/admin` mit dem Admin-Token anmelden. Die Galerie zeigt alle Fotos nach Challenge sortiert. Aktionen:

- **Foto öffnen** → Vollbild-Viewer mit Download-Button
- **Foto löschen** → einzelnes Foto entfernen (Original + Thumb)
- **Alle löschen** → kompletter Bucket-Reset (Bulk-Delete in einem API-Call); zur Sicherheit muss `LÖSCHEN` getippt werden
- **ZIP pro Challenge** → der Worker streamt die Fotos serverseitig als ZIP (kein Browser-Memory-Problem)

Die Dateinamen im R2-Storage enthalten den Namen des Fotografen plus den Idempotency-Key des Uploads. Re-Uploads ("Foto ersetzen") überschreiben **dasselbe** R2-Objekt anstatt ein zweites anzulegen:

```
original/01-new-faces/MaxMustermann-<uuid>.jpg
thumbs/01-new-faces/MaxMustermann-<uuid>.jpg
```

## Alle Fotos herunterladen (Bulk-Download)

### Im Browser (Admin)
Unter `/admin` gibt es pro Challenge einen ZIP-Download-Button. Der Worker streamt die Fotos serverseitig als ZIP — kein Browser-Memory-Problem.

### Via Skript (für den kompletten Bucket)

```bash
chmod +x download-all.sh
./download-all.sh
```

#### Einmalige Einrichtung (rclone)

1. Installieren: `brew install rclone`
2. Konfigurieren: `rclone config`
   - **n** → neues Remote
   - Name: **r2**
   - Type: **s3**
   - Provider: **Cloudflare**
   - Access Key ID & Secret: Cloudflare Dashboard → R2 → Manage R2 API Tokens → Token erstellen (Object Read)
   - Endpoint: `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` (Account-ID steht in der Dashboard-URL)
   - Rest: Defaults übernehmen

#### Manuell (ohne Skript)

```bash
# Alle Fotos synchronisieren (resumable, parallel)
rclone sync r2:foto-challenge-uploads/original/ ./alle-fotos/ --progress

# Nur eine Challenge herunterladen
rclone sync r2:foto-challenge-uploads/original/01-new-faces/ ./neue-gesichter/ --progress
```

### Kosten

R2 hat **keine Egress-Gebühren**. Download beliebig oft = $0.

## Deployment

### Frontend (Cloudflare Pages)

1. Repository mit Cloudflare Pages verbinden (Dashboard → Pages → Create)
2. Build-Settings:
   - Build command: `npm run build`
   - Build output: `dist`
   - Environment variable: `VITE_API_BASE_URL=https://your-worker.workers.dev`

### Worker (Cloudflare Workers)

```bash
cd worker
npm install
wrangler secret put ADMIN_TOKEN    # Admin-Passwort setzen
wrangler deploy                    # Worker deployen
```

Der Worker braucht einen R2-Bucket `foto-challenge-uploads` (in `wrangler.toml` konfiguriert) und den Workers Paid Plan ($5/Monat).

## Aufräumen nach der Party

1. **Fotos sichern:** `./download-all.sh` (siehe oben)
2. **Worker stoppen:** Cloudflare Dashboard → Workers → `white-unit-000b` → löschen
3. **R2 Bucket löschen:** Dashboard → R2 → `foto-challenge-uploads` → Delete
4. **Pages deaktivieren:** Dashboard → Pages → Projekt löschen
5. **Workers Paid Plan kündigen:** Dashboard → Workers & Pages → Plans → Downgrade auf Free

# my console commands

yves@yves foto-challenge % chmod +x smoke-test.sh                                                     
yves@yves foto-challenge % LOAD_COUNT=100 LOAD_PARALLEL=8 ADMIN_TOKEN=xxx ./smoke-test.sh

yves@yves foto-challenge % chmod +x download-all.sh 
yves@yves foto-challenge % ./download-all.sh 