# Manueller Testplan — Foto-Challenge

## Voraussetzungen

1. **Frontend starten**: `npm run dev` → http://localhost:5173
2. **Worker lokal starten**: `cd worker && npx wrangler dev`
3. **Env-Variable setzen** (`.env.local`): `VITE_API_BASE_URL=http://localhost:8787`
4. **Testbilder vorbereiten**:
   - Ein Hochformat-Foto (vom iPhone/Android, mit EXIF-Rotation)
   - Ein Querformat-Foto (normal)
   - Ein großes Bild (>25 MB, z.B. RAW-Export)
   - Ein sehr kleines Bild (<100 KB)

---

## Test 1: Name & Einstieg

| # | Schritt | Erwartetes Ergebnis |
|---|---------|---------------------|
| 1.1 | Öffne `/125` im Browser | Name-Eingabe wird angezeigt |
| 1.2 | Tippe "Testuser" ein, drücke Enter | Challenge-Übersicht erscheint mit 0/5 |
| 1.3 | Lade die Seite neu | Name bleibt gespeichert, Challenges sichtbar |

---

## Test 2: Foto-Upload & Client-Resize

| # | Schritt | Erwartetes Ergebnis |
|---|---------|---------------------|
| 2.1 | Klicke "Foto aufnehmen" bei Challenge 1 | Modal öffnet sich |
| 2.2 | Wähle ein Querformat-Bild aus Galerie | Vorschau wird korrekt angezeigt (nicht rotiert) |
| 2.3 | Klicke "Foto hochladen" | Spinner zeigt "Bild wird vorbereitet…", dann "Wird hochgeladen…" |
| 2.4 | Warte auf Erfolg | Modal schließt, Toast "Foto hochgeladen!", Progress 1/5 |
| 2.5 | Wiederhole mit Hochformat-Bild (iPhone) | **Bild ist korrekt orientiert** (nicht um 90° gedreht) |

### Test 2b: EXIF-Rotation (kritisch!)

| # | Schritt | Erwartetes Ergebnis |
|---|---------|---------------------|
| 2b.1 | Nimm ein Foto mit iPhone im Portrait-Modus | — |
| 2b.2 | Lade es über "Aus Galerie wählen" hoch | Vorschau zeigt es aufrecht |
| 2b.3 | Prüfe im Admin: Thumbnail + Fullsize | Beide korrekt orientiert (kein 90°-Dreh) |

### Test 2c: Größenlimit

| # | Schritt | Erwartetes Ergebnis |
|---|---------|---------------------|
| 2c.1 | Wähle ein Bild >25 MB | Fehlermeldung erscheint SOFORT (kein Spinner) |
| 2c.2 | Wähle ein normales Bild danach | Upload funktioniert normal |

---

## Test 3: Celebration-Animation (iOS-kritisch!)

| # | Schritt | Erwartetes Ergebnis |
|---|---------|---------------------|
| 3.1 | Lade alle 5 Challenges hoch | Nach dem 5. Upload: Confetti-Animation |
| 3.2 | **Auf iOS Safari testen** | Konfetti fliegt sichtbar nach oben/außen |
| 3.3 | **Auf Android Chrome testen** | Konfetti fliegt sichtbar |
| 3.4 | Warte 5 Sekunden | Overlay blendet aus |
| 3.5 | "Alle geschafft!" Message sichtbar | ✓ |

### Wie lokal testen (ohne echtes iOS-Gerät):
- **Safari Simulator**: Xcode → Simulator → iPhone auswählen → Safari öffnen
- **Remote Debug**: iPhone per USB an Mac, Safari Dev Tools → Seite inspizieren
- **BrowserStack/LambdaTest**: https://www.browserstack.com/live (kostenloser Trial)
- **Chrome DevTools "Responsive"**: Kein echter iOS-Test, aber Layout prüfbar

### Alternativer Quick-Test für Animation:
```js
// In Browser-Console auf /125 eingeben (nach Name-Eingabe):
localStorage.setItem("progress", JSON.stringify({
  "01-new-faces": true,
  "02-detail-love": true,
  "03-small-chaos": true,
  "04-hands-only": true
}));
location.reload();
// Dann das 5. Foto hochladen → Animation sollte kommen
```

---

## Test 4: Admin-Galerie

| # | Schritt | Erwartetes Ergebnis |
|---|---------|---------------------|
| 4.1 | Öffne `/admin`, gib Token ein | Galerie lädt mit Thumbnails (250px, schnell) |
| 4.2 | Prüfe: Thumbnails sind scharf genug für Navigation | Ja (250px reicht für kleine Kacheln) |
| 4.3 | Klicke auf ein Thumbnail | Fullsize-Viewer öffnet sich, Spinner während Laden |
| 4.4 | Fullsize-Bild wird angezeigt | Korrekte Orientierung, volle Auflösung |
| 4.5 | Schließe Viewer | Zurück zur Galerie |

---

## Test 5: Löschen

| # | Schritt | Erwartetes Ergebnis |
|---|---------|---------------------|
| 5.1 | Hover über Thumbnail → Papierkorb-Icon erscheint | ✓ |
| 5.2 | Klicke Papierkorb | Browser-Dialog "... wirklich löschen?" |
| 5.3 | Klicke "Abbrechen" | Foto bleibt |
| 5.4 | Klicke Papierkorb → "OK" | Foto verschwindet aus Galerie |
| 5.5 | Lade Admin-Seite neu | Foto ist weg (auch aus R2) |

---

## Test 6: ZIP-Download (per Challenge)

| # | Schritt | Erwartetes Ergebnis |
|---|---------|---------------------|
| 6.1 | Klicke Download-Icon neben Challenge-Titel | Browser startet ZIP-Download |
| 6.2 | Warte bis Download fertig | ZIP-Datei im Downloads-Ordner |
| 6.3 | Entpacke ZIP | Alle Fotos der Challenge enthalten, korrekt benannt |
| 6.4 | Prüfe: Bilder im ZIP sind korrekt orientiert | ✓ |
| 6.5 | Prüfe: Bilder haben volle Auflösung (3200px Kante) | ✓ |

---

## Test 7: Edge Cases

| # | Schritt | Erwartetes Ergebnis |
|---|---------|---------------------|
| 7.1 | Upload mit leerer/schlechter Verbindung | Fehlermeldung "Upload fehlgeschlagen" |
| 7.2 | Doppelklick auf "Foto hochladen" | Nur ein Upload wird gestartet |
| 7.3 | Admin: Download einer leeren Challenge | Button nicht sichtbar (Section hidden) |
| 7.4 | 5× auf Titel tippen (Reset-Feature) | Progress wird zurückgesetzt |
| 7.5 | Upload von PNG statt JPEG | Wird zu JPEG konvertiert (Client-Resize) |

---

## Test 8: Performance

| # | Schritt | Erwartetes Ergebnis |
|---|---------|---------------------|
| 8.1 | Admin mit 50+ Fotos laden | Thumbnails erscheinen progressiv (lazy loading) |
| 8.2 | Netzwerk-Tab prüfen: Thumbnail-Größe | ~8-15 KB pro Thumb |
| 8.3 | Netzwerk-Tab prüfen: Thumb Cache-Header | `max-age=31536000, immutable` |
| 8.4 | Admin erneut laden | Thumbs kommen aus Browser-Cache (304 oder cached) |

---

## Lokaler Worker-Test mit Wrangler

```bash
cd worker
npx wrangler dev
# Worker läuft auf http://localhost:8787
# Nutzt lokalen R2-Simulator (Daten in .wrangler/state/)
```

### Manueller API-Test:
```bash
# Upload testen
curl -X POST http://localhost:8787/upload \
  -F "photo=@test.jpg" \
  -F "thumb=@thumb.jpg" \
  -F "challengeId=01-new-faces" \
  -F "name=Test"

# Fotos listen
curl http://localhost:8787/photos -H "x-admin-token: YOUR_TOKEN"

# Thumbnail laden
curl http://localhost:8787/photo/thumb/01-new-faces/Test-... -H "x-admin-token: YOUR_TOKEN" -o thumb.jpg

# ZIP streamen
curl "http://localhost:8787/download/zip?challenge=01-new-faces&token=YOUR_TOKEN" -o test.zip

# Löschen
curl -X DELETE http://localhost:8787/photo/01-new-faces/Test-... -H "x-admin-token: YOUR_TOKEN"
```

---

## Priorisierung

| Priorität | Tests |
|-----------|-------|
| 🔴 Kritisch | Test 2b (EXIF-Rotation), Test 3 (iOS-Confetti), Test 6 (ZIP-Integrität) |
| 🟡 Wichtig | Test 2 (Upload), Test 4 (Admin), Test 5 (Löschen) |
| 🟢 Nice-to-have | Test 7 (Edge Cases), Test 8 (Performance) |
