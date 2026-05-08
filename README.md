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

Unter `/admin` mit dem Admin-Token anmelden. Die Galerie zeigt alle Fotos nach Challenge sortiert. Fotos können einzeln gelöscht oder als ZIP (pro Kategorie) heruntergeladen werden.

Die Dateinamen im R2-Storage enthalten den Namen des Fotografen:
```
original/01-new-faces/MaxMustermann-1752345678-abc123.jpg
thumbs/01-new-faces/MaxMustermann-1752345678-abc123.jpg
```

## Alle Fotos herunterladen (Bulk-Download via CLI)

Für den vollständigen Download aller Fotos (z.B. 1500 Bilder, 4.5 GB) empfiehlt sich der direkte R2-Zugriff über die CLI. Dies ist schneller, resumable und benötigt kein Browser-Memory.

### Variante A: Wrangler CLI (empfohlen)

```bash
# 1. Wrangler installieren (falls nicht vorhanden)
npm install -g wrangler

# 2. Bei Cloudflare anmelden
wrangler login

# 3. Alle Fotos auflisten
wrangler r2 object list foto-challenge-uploads --prefix "original/"

# 4. Einzelnes Foto herunterladen
wrangler r2 object get foto-challenge-uploads "original/01-new-faces/Max-1234-abc.jpg" --file ./downloads/Max.jpg

# 5. Alle Fotos eines Challenges herunterladen (Bash/PowerShell-Skript)
```

#### PowerShell-Skript: Alle Fotos herunterladen

```powershell
# Zielordner erstellen
New-Item -ItemType Directory -Force -Path "./alle-fotos"

# Alle Keys auflisten und herunterladen
$objects = wrangler r2 object list foto-challenge-uploads --prefix "original/" | ConvertFrom-Json
foreach ($obj in $objects.objects) {
    $key = $obj.key
    $localPath = "./alle-fotos/$($key -replace '^original/', '')"
    $dir = Split-Path $localPath -Parent
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
    Write-Host "Downloading: $key"
    wrangler r2 object get foto-challenge-uploads $key --file $localPath
}
Write-Host "Fertig! $($objects.objects.Count) Fotos heruntergeladen."
```

#### Bash-Skript: Alle Fotos herunterladen

```bash
#!/bin/bash
mkdir -p ./alle-fotos

wrangler r2 object list foto-challenge-uploads --prefix "original/" --json \
  | jq -r '.objects[].key' \
  | while read key; do
      local_path="./alle-fotos/${key#original/}"
      mkdir -p "$(dirname "$local_path")"
      echo "Downloading: $key"
      wrangler r2 object get foto-challenge-uploads "$key" --file "$local_path"
    done

echo "Fertig!"
```

### Variante B: rclone (für sehr große Mengen)

```bash
# 1. rclone installieren: https://rclone.org/install/

# 2. R2 als Remote konfigurieren
rclone config
# → Name: r2
# → Type: s3
# → Provider: Cloudflare
# → Access Key / Secret: aus Cloudflare Dashboard → R2 → API Tokens
# → Endpoint: https://<ACCOUNT_ID>.r2.cloudflarestorage.com

# 3. Alle Fotos synchronisieren (resumable, parallel)
rclone sync r2:foto-challenge-uploads/original/ ./alle-fotos/ --progress

# 4. Nur eine Challenge herunterladen
rclone sync r2:foto-challenge-uploads/original/01-new-faces/ ./neue-gesichter/ --progress
```

### Kosten

| Operation | Menge | Kosten |
|-----------|-------|--------|
| R2 Class B (GET) | 1500 Downloads | $0 (10M free/month) |
| R2 Egress | 4.5 GB | $0 (R2 hat keine Egress-Gebühren) |
| **Gesamt** | | **$0** |
