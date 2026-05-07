# 📸 Photo Challenge Web App

Eine mobile-first Web-App für Events / Partys, bei der Gäste Fotos zu vorgegebenen Challenges aufnehmen und hochladen können.  
Alle Bilder werden in Cloudflare R2 gespeichert und können über eine Admin-Seite gesammelt als ZIP heruntergeladen werden.

---

# 🚀 Tech Stack

## Frontend
- React (Vite)
- JavaScript
- Custom CSS
- Lucide Icons

## Backend
- Cloudflare Workers (API)
- Cloudflare R2 (Storage)

## Hosting
- Cloudflare Pages (Frontend)
- Cloudflare Workers (Backend API)

---

# 📁 Projektstruktur

```
foto-challenge/
├── index.html
├── package.json
├── vite.config.js
├── src/
│   ├── main.jsx
│   ├── App.jsx
│   └── style.css
│
└── worker/
    ├── wrangler.toml
    └── src/
        └── index.js
```

---

# ⚙️ Environment Variablen

## Cloudflare Pages

```bash
VITE_API_BASE_URL=https://your-worker.workers.dev
```

## Cloudflare Worker

```bash
ALLOWED_ORIGIN=https://your-app.pages.dev
MAX_FILE_SIZE_MB=12
```

## Secret

```bash
wrangler secret put ADMIN_TOKEN
```

---

# 🧠 Architektur

```
User (Smartphone)
        ↓
Cloudflare Pages (React App)
        ↓
Cloudflare Worker API
        ↓
R2 Storage (Images)
```

---

# 📸 Features

## ✅ User

- Kamera direkt öffnen 📸  
- Galerie auswählen 🖼️  
- ✅ Auto-Upload (kein Upload Button!)  
- Fortschritt (5 Challenges)  
- grüne Karten wenn erledigt  
- Upload-Zähler pro Challenge  

---

## ✅ Admin

- Login via Token (`/admin`)
- ✅ ZIP Download aller Bilder
- Bilder nach Challenge sortiert im ZIP

---

# 🎯 Challenges

```js
[
  "new-faces",
  "detail-love",
  "small-chaos",
  "hands-only",
  "golden-hour"
]
```

---

# 🔌 API Endpoints

## POST `/upload`

Upload eines Bildes

```
multipart/form-data:
- photo
- challengeId
```

---

## GET `/photos`
🔒 Admin only

```json
{
  "photos": [
    { "key": "new-faces/123.jpg" }
  ]
}
```

---

## GET `/photo/:key`
➡️ öffentlich

→ liefert ein Bild

---

## GET `/photos-by-challenge`

```json
{
  "grouped": {
    "new-faces": [...],
    "detail-love": [...]
  }
}
```

---

## ✅ GET `/zip`
🔒 Admin only

→ lädt ZIP Datei:

```
foto-challenge.zip
 ├── new-faces/
 ├── detail-love/
```

---

# 📱 UX Verhalten

## Upload Flow

```
User klickt "Foto"
→ Kamera oder Galerie öffnet sich
→ Bild wird gewählt
→ Upload passiert automatisch
→ Modal schließt
→ Challenge = erledigt
```

👉 KEIN Upload Button bewusst!

---

# 🎨 UI Prinzipien

- Mobile first
- so wenig Klicks wie möglich
- visuelles Feedback > Text
- große Touch Buttons
- einfache Struktur

---

# 🔒 Sicherheit

| Route | Zugriff |
|------|--------|
| /upload | öffentlich |
| /photos-by-challenge | öffentlich |
| /photo/:key | öffentlich |
| /photos | 🔒 Admin |
| /zip | 🔒 Admin |

---

# 📦 Storage Struktur

```
challengeId/file.jpg
```

Beispiel:

```
new-faces/1715093847.jpg
```

---

# 🚀 Deployment

## Frontend (Pages)

```
Build: npm run build
Output: dist
```

---

## Backend (Worker)

```bash
cd worker
npx wrangler deploy
```

---

# 🧩 Design Entscheidungen

## ❓ Warum kein Upload Button?

→ bessere mobile UX  
→ schneller  
→ wirkt wie native App  

---

## ❓ Warum `/photo` öffentlich?

→ `<img>` kann keine Token senden  

---

## ❓ Warum ZIP im Worker?

→ 1 Klick Download  
→ kein manuelles Speichern nötig  


---

# ✅ Status

```
✅ Production Ready
✅ Mobile Optimized
✅ Event Ready
```