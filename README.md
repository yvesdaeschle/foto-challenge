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

Unter `/admin` mit dem Admin-Token anmelden. Die Galerie zeigt alle Fotos nach Challenge sortiert. Fotos können einzeln oder als ZIP (pro Kategorie oder alle) heruntergeladen werden.

Die Dateinamen im R2-Storage enthalten den Namen des Fotografen:
```
01-new-faces/MaxMustermann-1752345678-abc123.jpg
```
