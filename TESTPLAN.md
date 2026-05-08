# Testplan — Foto-Challenge

Manueller Testplan für die App. Ergänzt die automatischen Tests
(`npm test`, `./smoke-test.sh`) um die Aspekte, die nur am echten
Gerät verifizierbar sind.

> **Legende:** 🔴 kritisch · 🟡 wichtig · 🟢 nice-to-have

---

## 0. Setup

### Lokale Entwicklung

```powershell
# Frontend (Vite)
npm install
npm run dev               # http://localhost:5173

# Worker (in zweitem Terminal)
cd worker
npx wrangler dev          # http://localhost:8787
```

`.env.local` im Repo-Root:

```
VITE_API_BASE_URL=http://localhost:8787
```

Alternativ: Frontend gegen Production-Worker laufen lassen
(`VITE_API_BASE_URL=https://white-unit-000b.sevyelsch.workers.dev`).

### Automatisierte Tests

```powershell
npm test                          # 28 Vitest-Tests (UI-Logik)
ADMIN_TOKEN=xxx ./smoke-test.sh   # End-to-End gegen Production
```

Vor jedem Release manuell durchgehen:

| Suite           | Stufe       | Befehl                              |
|-----------------|-------------|-------------------------------------|
| Vitest          | jeder Push  | `npm test`                          |
| Smoke (Worker)  | jeder Push  | `ADMIN_TOKEN=xxx ./smoke-test.sh`   |
| Manuell mobil   | vor Release | dieser Plan                         |

### Testdaten vorbereiten

| Datei                           | Eigenschaften                                    |
|---------------------------------|--------------------------------------------------|
| `iphone-portrait.jpg`           | Hochformat vom iPhone, EXIF-Orientation = 6     |
| `android-landscape.jpg`         | Querformat vom Android                          |
| `huge-raw.jpg`                  | >25 MB (Client-Limit)                           |
| `oversized.jpg`                 | 12–25 MB (Client OK, Server lehnt ab)           |
| `tiny.png`                      | <100 KB PNG (wird zu JPEG konvertiert)          |
| `with-special-chars.jpg`        | Dateiname mit Umlauten, Leerzeichen, Emoji      |

---

## 1. Erste Begegnung & Name 🟡

| #   | Schritt                                              | Erwartung                                                            |
|-----|------------------------------------------------------|----------------------------------------------------------------------|
| 1.1 | `/` öffnen                                           | Landing mit "Bitte scannt den QR-Code" — keine Funktionalität        |
| 1.2 | `/random-path` öffnen                                | Selbe Landing (Catch-all)                                            |
| 1.3 | `/125` öffnen                                        | Name-Eingabe sichtbar, Button "Los geht's!" disabled bei leerem Feld |
| 1.4 | "  " (nur Leerzeichen) eintippen → Enter             | Button bleibt disabled                                                |
| 1.5 | Validen Namen "Anna" + Enter                         | Challenge-Übersicht erscheint, Progress 0/5                          |
| 1.6 | Reload                                               | Name bleibt, springt direkt in die Übersicht                         |
| 1.7 | Lokalen Storage löschen, Reload                      | Wieder Name-Eingabe                                                  |

---

## 2. Foto-Upload 🔴

### 2a. Happy Path

| #     | Schritt                                                    | Erwartung                                                                        |
|-------|------------------------------------------------------------|----------------------------------------------------------------------------------|
| 2a.1  | "Foto aufnehmen" auf erster Karte                          | Modal slidet von unten ein                                                       |
| 2a.2  | "Aus Galerie wählen" + Querformat-Foto                     | Vorschau zeigt das Foto in korrekter Orientierung                                |
| 2a.3  | "Foto hochladen"                                           | Spinner "Bild wird vorbereitet…" → Fortschrittsbalken mit Prozent                |
| 2a.4  | Nach Upload                                                | Modal schließt, Toast **am unteren Bildschirmrand** "Foto hochgeladen!"          |
| 2a.5  | Karte zeigt nun Daumen-Thumb (44×44, grün umrandet)        | Eigenes Foto statt Emoji, Button-Text "Foto ersetzen"                            |
| 2a.6  | Progress-Bar                                               | "1 / 5 erledigt", grüner Fortschritt                                             |

### 2b. EXIF-Rotation 🔴 (iOS-kritisch!)

| #     | Schritt                                                    | Erwartung                                            |
|-------|------------------------------------------------------------|------------------------------------------------------|
| 2b.1  | iPhone-Portrait-Foto hochladen                             | Vorschau ist aufrecht (NICHT um 90° gedreht)         |
| 2b.2  | Im Admin: Thumbnail betrachten                             | Aufrecht                                             |
| 2b.3  | Im Admin: Fullsize öffnen                                  | Aufrecht, scharf                                     |
| 2b.4  | ZIP herunterladen, entpacken, Bild öffnen                  | Aufrecht                                             |

### 2c. Größenlimit & Validierung 🟡

| #     | Schritt                                                    | Erwartung                                                                        |
|-------|------------------------------------------------------------|----------------------------------------------------------------------------------|
| 2c.1  | Bild >25 MB wählen                                         | Sofortige Fehlermeldung mit MB-Angabe (kein Upload-Versuch)                      |
| 2c.2  | Danach normales Bild                                       | Funktioniert problemlos                                                          |
| 2c.3  | Bild zwischen 12–25 MB                                     | Client erlaubt, Server lehnt mit 413 ab, Fehlermeldung sichtbar                 |
| 2c.4  | Nicht-Bild-Datei (z.B. PDF)                                | `<input accept="image/*">` blockt im Picker                                      |
| 2c.5  | PNG hochladen                                              | Wird intern zu JPEG konvertiert                                                  |

### 2d. Idempotenz / Doppelklick / echtes Replace 🟡 (neu)

| #     | Schritt                                                    | Erwartung                                                                        |
|-------|------------------------------------------------------------|----------------------------------------------------------------------------------|
| 2d.1  | "Foto hochladen" doppelklicken                             | Nur **ein** Upload startet (Button disabled-State)                               |
| 2d.2  | Während Upload Modal schließen → Browser-Tab wechseln      | XHR wird abgebrochen, kein Geist-Upload                                          |
| 2d.3  | Upload schlägt fehl → "Nochmal versuchen"                  | Selber Idempotency-Key → Server überschreibt das gleiche Objekt, **kein Duplikat** im Admin |
| 2d.4  | Challenge erfolgreich erledigt → "Foto ersetzen" tippen → anderes Foto wählen → hochladen | **Echtes Replace**: dasselbe R2-Objekt wird überschrieben. Im Admin erscheint nur **ein** Foto, das neue. Network-Tab: derselbe `idempotencyKey` wie beim Erst-Upload. |
| 2d.5  | Nach Replace: localStorage `progress` prüfen               | `done[id].idempotencyKey` unverändert, nur `thumb` aktualisiert                 |

### 2e. Netzwerk-Probleme 🟡

| #     | Szenario                                                  | Erwartung                                                                        |
|-------|-----------------------------------------------------------|----------------------------------------------------------------------------------|
| 2e.1  | Offline (Airplane-Mode)                                   | Klare Fehlermeldung "Netzwerkfehler", "Nochmal versuchen" sichtbar               |
| 2e.2  | Sehr langsame Verbindung (DevTools Slow 3G)               | Fortschrittsbalken läuft sichtbar von 0 → 100%                                   |
| 2e.3  | Upload abbrechen mitten drin (Modal schließen)            | Upload wird abgebrochen, kein halbes Foto im Admin                               |

---

## 3. Celebration-Animation 🔴

### iOS-Confetti-Test (war kaputt, jetzt mit `translate3d`)

| #   | Schritt                                                                  | Erwartung                                                          |
|-----|--------------------------------------------------------------------------|--------------------------------------------------------------------|
| 3.1 | 5. Foto hochladen (alle Challenges fertig)                              | Vollbild-Overlay mit "🎉 Geschafft!" + Konfetti-Regen              |
| 3.2 | **iOS Safari** (echtes iPhone)                                           | Konfetti fällt sichtbar von oben nach unten, mit Wackelbewegung    |
| 3.3 | **Android Chrome**                                                       | Identisches Verhalten                                              |
| 3.4 | Nach 5 s                                                                 | Overlay blendet sanft aus                                          |
| 3.5 | Karte 5 zeigt jetzt eigenen Thumb                                        | ✓                                                                  |
| 3.6 | "Du hast alle Challenges gemeistert!" Message                            | Sichtbar unten                                                     |

### Quick-Repeat ohne 5 Uploads

In der Browser-Console auf `/125`:

```js
localStorage.setItem("progress", JSON.stringify({
  "01-new-faces":   { done: true, thumb: null },
  "02-detail-love": { done: true, thumb: null },
  "03-small-chaos": { done: true, thumb: null },
  "04-hands-only":  { done: true, thumb: null }
}));
location.reload();
// Dann das 5. Foto hochladen → Animation.
```

### iOS-Test-Methoden (von gut nach schlecht)

1. **Echtes iPhone** im selben WLAN → `http://<dev-mac-ip>:5173/125`
2. **Xcode Simulator** → iPhone 15 → Safari → `localhost:5173/125`
3. **Safari Responsive Design Mode** auf macOS (User-Agent + Viewport, aber **echte WebKit-Engine**)
4. **BrowserStack/LambdaTest** Live-Sessions
5. ❌ Chrome DevTools Device-Mode — nutzt Blink, nicht WebKit, deckt iOS-Bugs **nicht** auf

### Reduced-Motion 🟢

| #   | Schritt                                                          | Erwartung                              |
|-----|------------------------------------------------------------------|----------------------------------------|
| 3.7 | macOS: System Settings → Accessibility → Reduce Motion ON       | Konfetti-Pieces unsichtbar (display:none) |
| 3.8 | Trotzdem: "🎉 Geschafft!" Overlay sichtbar                       | ✓                                      |

---

## 4. Admin-Galerie 🟡

| #     | Schritt                                                    | Erwartung                                                              |
|-------|------------------------------------------------------------|------------------------------------------------------------------------|
| 4.1   | `/admin` ohne Token-Eingabe → "Anmelden"                  | Fehler "Bitte Admin Token eingeben."                                   |
| 4.2   | Falscher Token + "Anmelden"                                | Fehler "Ungültiger Admin Token."                                       |
| 4.3   | Korrekter Token + Enter (statt Klick)                      | Galerie lädt                                                           |
| 4.4   | Galerie mit n Fotos                                        | Sektionen pro Challenge, Anzahl in Klammern                            |
| 4.5   | Thumbnails laden                                           | 250 px JPEGs, Auth via `x-admin-token` Header (Network Tab prüfen)     |
| 4.6   | Foto anklicken                                             | Fullscreen-Viewer mit Spinner → Bild + Download-Button                 |
| 4.7   | Download-Button im Viewer                                  | Datei wird heruntergeladen, Name = R2-Key                              |
| 4.8   | Hover über Thumb (Desktop)                                 | Roter Papierkorb-Icon erscheint                                        |
| 4.9   | Touch (Mobile)                                             | Papierkorb halb-sichtbar (`opacity: 0.7`)                              |
| 4.10  | ZIP-Icon pro Challenge                                     | Streamt ZIP, alle Fotos der Challenge enthalten                        |
| 4.11  | Refresh-Button oben rechts                                 | Liste neu laden (Spinner während Refresh)                              |

---

## 5. Löschen mit styled Confirm-Dialog 🟡 (überarbeitet)

### 5a. Einzelnes Foto

| #     | Schritt                                                    | Erwartung                                                              |
|-------|------------------------------------------------------------|------------------------------------------------------------------------|
| 5a.1  | Papierkorb auf einem Thumb klicken                         | **Styled** Bottom-Sheet "Foto löschen?" (NICHT `window.confirm`)       |
| 5a.2  | Sheet zeigt Foto-Name + Hinweis "wird unwiderruflich…"     | ✓                                                                      |
| 5a.3  | "Abbrechen"                                                | Sheet schließt, Foto bleibt                                            |
| 5a.4  | Auf Backdrop klicken                                       | Sheet schließt                                                         |
| 5a.5  | ESC-Taste                                                  | Sheet schließt                                                         |
| 5a.6  | "Löschen" (rot)                                            | Sheet schließt, Foto verschwindet aus Galerie, R2-Objekt weg           |

### 5b. Alle Fotos (mit Schutzmechanismus)

| #     | Schritt                                                              | Erwartung                                                              |
|-------|----------------------------------------------------------------------|------------------------------------------------------------------------|
| 5b.1  | Roter Trash-Icon oben rechts                                         | Sheet "Alle Fotos löschen?" mit n als Anzahl                           |
| 5b.2  | "Löschen"-Button ist disabled                                        | ✓                                                                      |
| 5b.3  | Wort `LÖSCHEN` (Großbuchstaben) eintippen                            | Button wird aktiv                                                      |
| 5b.4  | Falsches Wort eintippen ("löschen" lowercase, "DELETE")              | Button bleibt disabled                                                 |
| 5b.5  | "Löschen" bestätigen                                                 | **Eine** DELETE-Anfrage an `/photos`, alle Fotos weg, Galerie leer     |
| 5b.6  | Network Tab: Anzahl der Anfragen                                     | Genau 1 (nicht n!)                                                     |
| 5b.7  | Refresh                                                              | Galerie ist leer                                                       |

### 5c. Path-Traversal-Probe 🔴 Sicherheit

```bash
# Sollte 400 oder 401 ergeben, NIE 200:
curl -i -X DELETE \
  -H "x-admin-token: $TOKEN" \
  "http://localhost:8787/photo/..%2Fetc%2Fpasswd"
```

---

## 6. ZIP-Download 🟡

| #     | Schritt                                                    | Erwartung                                                              |
|-------|------------------------------------------------------------|------------------------------------------------------------------------|
| 6.1   | Download-Icon einer Challenge mit 0 Fotos                  | Section ist nicht sichtbar (Button nicht erreichbar)                   |
| 6.2   | Download bei Challenge mit 5 Fotos                         | Browser startet Download                                               |
| 6.3   | Datei `foto-challenge-XX.zip` öffnen                       | Alle 5 Bilder enthalten                                                |
| 6.4   | `unzip -t foto-challenge-XX.zip`                           | "No errors detected" — ZIP-Integrität OK                               |
| 6.5   | Bilder im ZIP                                              | Volle Auflösung (3200 px), korrekte Orientierung, scharf               |
| 6.6   | URL ohne Token aufrufen                                    | 401 Unauthorized                                                       |
| 6.7   | Großer Download (z.B. 100 MB)                              | Streaming startet sofort, kein Worker-Timeout                          |

---

## 7. Sicherheit 🔴

> Smoke-Test deckt das meiste ab; manuell ergänzen wo nötig.

| #     | Test                                                                          | Erwartung                                          |
|-------|-------------------------------------------------------------------------------|----------------------------------------------------|
| 7.1   | `/photos` ohne Token                                                          | 401                                                |
| 7.2   | `/photos` mit falschem Token                                                  | 401                                                |
| 7.3   | `/photo/full/..%2Fetc%2Fpasswd`                                               | 400                                                |
| 7.4   | `/upload` mit `challengeId=999-evil`                                          | 400 "Ungültige Challenge"                          |
| 7.5   | Nutzername mit `<script>alert(1)</script>` eintippen, Foto hochladen         | Im Admin als Klartext sichtbar (React escapes), Datei landet ohne Tag-Zeichen | 7.6   | CORS: Anfrage von fremder Origin                                              | `Access-Control-Allow-Origin` matched nicht        |
| 7.7   | Riesendatei (>12 MB nach Resize — schwer zu erzeugen)                         | 413                                                |

---

## 8. Edge Cases 🟢

| #     | Schritt                                                          | Erwartung                                  |
|-------|------------------------------------------------------------------|--------------------------------------------|
| 8.1   | 5× auf Titel "12 ½ Jahre Adams Family" tippen                    | Progress wird zurückgesetzt, Toast        |
| 8.2   | Browser-Back nach Login                                          | Springt zurück (kein crash)                |
| 8.3   | Tab im Hintergrund während Upload                                | Upload läuft weiter, Erfolg-Toast bei Rückkehr |
| 8.4   | Mehrere Tabs gleichzeitig                                        | Beide funktionieren, kein Storage-Konflikt |
| 8.5   | localStorage gefüllt (Quota Exceeded simulieren)                 | App crasht nicht, ErrorBoundary fängt auf  |

---

## 9. Performance 🟢

| #     | Metrik                                                              | Ziel                                       |
|-------|---------------------------------------------------------------------|--------------------------------------------|
| 9.1   | Time to Interactive (Lighthouse Mobile)                             | <2 s                                       |
| 9.2   | Thumbnail-Größe in Network Tab                                      | 8–15 KB                                    |
| 9.3   | Cache-Header für Thumbs                                             | `max-age=31536000, immutable`              |
| 9.4   | Cache-Header für Originale                                          | `private, max-age=0, no-store`             |
| 9.5   | Reload Admin-Galerie                                                | Thumbs aus Cache (Status 200 from disk cache oder 304) |
| 9.6   | Worker Cold-Start beim ersten `/upload`                             | <500 ms (Cloudflare Quick-Start)           |
| 9.7   | 50 Fotos im Admin                                                   | Initial-Render <1 s, Lazy-Loading sichtbar |

---

## 10. Accessibility 🟡

| #     | Test                                                                          | Erwartung                                          |
|-------|-------------------------------------------------------------------------------|----------------------------------------------------|
| 10.1  | Keyboard-Only-Navigation (Tab durchgehen)                                     | Alle Buttons fokussierbar, sichtbarer Focus-Ring  |
| 10.2  | VoiceOver/TalkBack auf Mobile                                                 | Screen-Reader liest Toasts (`aria-live="polite"`) |
| 10.3  | Reduced Motion (siehe 3.7)                                                    | Konfetti hidden                                    |
| 10.4  | Kontrast (axe DevTools)                                                       | Alle WCAG AA, gelbe Hint-Texte ≥4.5:1             |
| 10.5  | Zoom 200%                                                                     | Layout bleibt usable, kein horizontales Scrollen  |
| 10.6  | Dark Mode des OS                                                              | App bleibt im designten Hellmodus, nichts unleserlich |

---

## 11. Cross-Browser 🟡

| Browser              | Version            | Test                                          |
|----------------------|--------------------|-----------------------------------------------|
| iOS Safari           | 16+                | 2b, 3 (Konfetti), Toast-Position              |
| Chrome (Android)     | aktuell            | 2b, 3, Toast                                  |
| Chrome (Desktop)     | aktuell            | komplett                                      |
| Firefox              | aktuell            | 2a, 4, 6                                      |
| Edge                 | aktuell            | 2a, 4                                         |
| Samsung Internet     | wenn möglich       | 2a (häufig auf Galaxy-Geräten)                |

---

## 12. Release-Checklist

- [ ] `npm test` → 28/28 grün
- [ ] `ADMIN_TOKEN=… ./smoke-test.sh` → alle grün
- [ ] Manueller Test 1, 2a, 2b, 3 auf echtem iPhone
- [ ] Manueller Test 4, 5, 6 auf Desktop Chrome
- [ ] Test 7.x Sicherheit auf Production gegen Production-Token
- [ ] Worker-Logs in Cloudflare Dashboard sauber (keine 500er)
- [ ] R2-Bucket-Größe im akzeptablen Bereich
