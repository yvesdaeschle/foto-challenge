import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Camera,
  Check,
  Image as ImageIcon,
  Download,
  Loader,
  PartyPopper,
  X,
  RefreshCw,
  ZoomIn,
  Trash2,
  Images,
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

// ================================================================
// CLIENT-SIDE IMAGE RESIZING
// ================================================================
function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Image load failed")); };
    img.src = url;
  });
}

function resizeToBlob(img, maxSize, quality) {
  return new Promise((resolve, reject) => {
    const { width, height } = img;
    const scale = Math.min(1, maxSize / Math.max(width, height));
    const w = Math.round(width * scale);
    const h = Math.round(height * scale);
    
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    
    const ctx = canvas.getContext("2d");
    
    // Optional: Für schwache Geräte das Image-Smoothing anpassen
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "medium"; // 'high' kostet extrem viel RAM/CPU
    
    ctx.drawImage(img, 0, 0, w, h);
    
    canvas.toBlob((blob) => {
      // WICHTIG: RAM sofort freigeben, noch bevor der Garbage Collector greift!
      canvas.width = 0;
      canvas.height = 0;
      
      if (!blob) return reject(new Error("Bildverarbeitung fehlgeschlagen"));
      resolve(blob);
    }, "image/jpeg", quality);
  });
}

async function processImage(file) {
  // createImageBitmap respektiert EXIF (damit Hochformat nicht kippt)
  const img = typeof createImageBitmap === "function"
    ? await createImageBitmap(file)
    : await loadImage(file);
    
  try {
    // 1. Sequenzielle Verarbeitung statt Promise.all()
    // 2. Maximalgröße auf 1920px und Qualität auf 0.85 reduziert
    const original = await resizeToBlob(img, 1920, 0.85);
    
    // Erst wenn das Original fertig im RAM verpackt und das Canvas gelöscht ist,
    // machen wir uns an das Thumbnail.
    const thumb = await resizeToBlob(img, 200, 0.55);
    
    return { original, thumb };
  } finally {
    // Speicher des Ursprungsbildes wieder freigeben
    if (typeof img.close === "function") img.close();
  }
}


function generateIdempotencyKey() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ================================================================
// ROUTING
// ================================================================
function getRoute() {
  const path = window.location.pathname.replace(/\/+$/, "");
  if (path === "/admin") return "admin";
  if (path === "/125") return "home";
  return "landing";
}

// ================================================================
// CHALLENGES
// ================================================================
const challenges = [
  {
    id: "01-new-faces",
    emoji: "🆕",
    title: "New Faces",
    desc: "Macht ein Foto mit jemandem, den ihr heute neu kennengelernt habt.",
    detail: "Ein kurzer Moment, ein neues Gesicht, schöne Gespräche.",
  },
  {
    id: "02-detail-love",
    emoji: "✨",
    title: "Detail Love",
    desc: "Fotografiert ein schönes Party‑Detail.",
    detail: "Deko, Drinks, Essen, Licht, Blumen – die kleinen Dinge machen den Abend besonders.",
  },
  {
    id: "03-small-chaos",
    emoji: "🎭",
    title: "Small Chaos",
    desc: "Gruppenfoto: Alle machen gleichzeitig etwas anderes.",
    detail: "Lachen, reden, tanzen, schauen, winken. Perfektion verboten – Chaos erlaubt.",
  },
  {
    id: "04-hands-only",
    emoji: "🤝",
    title: "Hands Only",
    desc: "Nur Hände im Bild.",
    detail: "Hands‑up, Handschlag, Kaffeebecher...",
  },
  {
    id: "05-golden-hour",
    emoji: "🌅",
    title: "Golden Hour",
    desc: "Das Licht ist perfekt – ihr auch.",
    detail: "Schnappt euch den Moment kurz vor Sonnenuntergang oder unter Lichterketten ;)",
  },
];

// ================================================================
// ERROR BOUNDARY
// ================================================================
class ErrorBoundary extends React.Component {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) {
      return (
        <div className="container" style={{ textAlign: "center", paddingTop: 80 }}>
          <p style={{ fontSize: 48 }}>😕</p>
          <p style={{ fontSize: 18, fontWeight: 600, margin: "16px 0" }}>Etwas ist schiefgelaufen.</p>
          <button className="btn-full btn-primary" onClick={() => window.location.reload()}>
            Seite neu laden
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ================================================================
// APP
// ================================================================
export default function App() {
  const route = getRoute();
  return (
    <ErrorBoundary>
      {route === "admin" ? <AdminPage /> : route === "home" ? <HomePage /> : <LandingRedirect />}
    </ErrorBoundary>
  );
}

function LandingRedirect() {
  return (
    <div className="container landing">
      <p className="event-title">12&nbsp;½&nbsp;Jahre Adams&nbsp;Family</p>
      <h1 className="landing-heading">Foto‑Challenge</h1>
      <p className="text">Bitte scannt den QR‑Code, um zur Foto‑Challenge zu gelangen.</p>
    </div>
  );
}

// ================================================================
// CELEBRATION — Full-screen confetti rain on challenge complete
// Designed to degrade gracefully on iOS Safari: the "Geschafft!" card is
// visible by default (no animation needed), and confetti uses a single
// simple keyframe rather than per-piece variants.
// ================================================================
function Celebration() {
  const [pieces] = useState(() => {
    const colors = ["#F4B324", "#ff6b6b", "#4ecdc4", "#45b7d1", "#ff9ff3", "#a29bfe", "#55efc4", "#fab1a0", "#fd79a8", "#e17055"];
    return Array.from({ length: 40 }, (_, i) => ({
      id: i,
      color: colors[i % colors.length],
      left: Math.random() * 100,
      size: 6 + Math.random() * 8,
      dur: 2.2 + Math.random() * 1.2, // 2.2–3.4s
      delay: Math.random() * 0.4,     // 0–0.4s
      shape: i % 3, // 0=rect, 1=circle, 2=strip
      rotEnd: 360 + Math.floor(Math.random() * 720) * (i % 2 ? 1 : -1),
    }));
  });

  return (
    <div className="celebration-overlay">
      <div className="celebration-content">
        <span className="celebration-emoji" role="img" aria-label="Konfetti">🎉</span>
        <p className="celebration-text">Geschafft!</p>
      </div>
      {pieces.map((p) => (
        <span
          key={p.id}
          className={`confetti-piece confetti-shape-${p.shape}`}
          style={{
            left: `${p.left.toFixed(1)}%`,
            width: p.shape === 2 ? `${(p.size * 0.4).toFixed(0)}px` : `${p.size.toFixed(0)}px`,
            height: p.shape === 2 ? `${(p.size * 2.5).toFixed(0)}px` : `${p.size.toFixed(0)}px`,
            background: p.color,
            // expose the random end-rotation as a CSS variable for the keyframe
            "--rot-end": `${p.rotEnd}deg`,
            animationDuration: `${p.dur.toFixed(2)}s`,
            animationDelay: `${p.delay.toFixed(2)}s`,
            WebkitAnimationDuration: `${p.dur.toFixed(2)}s`,
            WebkitAnimationDelay: `${p.delay.toFixed(2)}s`,
          }}
        />
      ))}
    </div>
  );
}

// ================================================================
// TOAST
// ================================================================
function Toast({ message, visible }) {
  return (
    <div
      className={`toast ${visible ? "toast--show" : ""}`}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <Check size={18} />
      {message}
    </div>
  );
}

// ================================================================
// RESET TITLE — 5x tap on title resets progress (hidden dev feature)
// ================================================================
function ResetTitle({ onReset }) {
  const taps = useRef(0);
  const timer = useRef(null);

  function handleTap() {
    taps.current++;
    if (timer.current) clearTimeout(timer.current);
    if (taps.current >= 5) {
      taps.current = 0;
      onReset();
      return;
    }
    timer.current = setTimeout(() => { taps.current = 0; }, 1500);
  }

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  return (
    <p className="event-title" onClick={handleTap} style={{ cursor: "default" }}>
      12&nbsp;½&nbsp;Jahre Adams&nbsp;Family
    </p>
  );
}

// ================================================================
// HOME PAGE
// ================================================================
function HomePage() {
  const [done, setDone] = useState(() => {
    try { return JSON.parse(localStorage.getItem("progress") || "{}"); } catch { return {}; }
  });
  const [active, setActive] = useState(null);
  const [partyUploadOpen, setPartyUploadOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [confettiKey, setConfettiKey] = useState(0);
  const [userName, setUserName] = useState(() => localStorage.getItem("userName") || "");
  const [nameConfirmed, setNameConfirmed] = useState(() => Boolean(localStorage.getItem("userName")));
  const confettiTimer = useRef(null);
  const toastTimer = useRef(null);

  useEffect(() => {
    try {
      localStorage.setItem("progress", JSON.stringify(done));
    } catch {
      // localStorage may be full or unavailable (e.g. private browsing) — silently ignore
    }
  }, [done]);

  const completed = Object.values(done).filter(Boolean).length;

  const showToast = useCallback((msg) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
      if (confettiTimer.current) clearTimeout(confettiTimer.current);
    };
  }, []);

  // Debug trigger: visiting the page with ?celebrate=1 fires the celebration once
  // on mount. Lets us verify the animation on real devices without going through
  // the full upload flow.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("celebrate") === "1") {
      setConfettiKey(1);
      if (confettiTimer.current) clearTimeout(confettiTimer.current);
      confettiTimer.current = setTimeout(() => setConfettiKey(0), 3700);
    }
  }, []);

  const handleUploadSuccess = useCallback(
    (challengeId, thumbDataUrl, idempotencyKey) => {
      // Haptic feedback on mobile
      if (navigator.vibrate) navigator.vibrate(50);

      setDone((d) => {
        const wasAllDone = challenges.every((c) => d[c.id]);
        const next = {
          ...d,
          [challengeId]: { done: true, thumb: thumbDataUrl || null, idempotencyKey: idempotencyKey || null },
        };
        const isAllDone = challenges.every((c) => next[c.id]);
        // Only celebrate on the *transition* to all-5; don't fire again on
        // every replace upload once the user has already finished the set.
        if (isAllDone && !wasAllDone) {
          if (confettiTimer.current) clearTimeout(confettiTimer.current);
          setConfettiKey((k) => k + 1);
          confettiTimer.current = setTimeout(() => setConfettiKey(0), 3700);
        }
        return next;
      });
      setActive(null);
      showToast("Foto hochgeladen!");
    },
    [showToast]
  );

  function confirmName() {
    const trimmed = userName.trim();
    if (!trimmed) return;
    localStorage.setItem("userName", trimmed);
    setUserName(trimmed);
    setNameConfirmed(true);
  }

  function handleReset() {
    setDone({});
    setNameConfirmed(false);
    setUserName("");
    localStorage.removeItem("userName");
    localStorage.removeItem("progress");
    showToast("Progress zurückgesetzt");
  }

  if (!nameConfirmed) {
    return (
      <main className="container">
        <p className="event-title">12&nbsp;½&nbsp;Jahre Adams&nbsp;Family</p>

        <section className="hero fade-in">
          <h1>
            5&nbsp;Momente.
            <br />
            Ein&nbsp;Abend.
            <br />
            Eure&nbsp;Erinnerungen.
          </h1>
          <p className="sub">Foto‑Challenge für Arienne&nbsp;&amp;&nbsp;Andy</p>
          <p className="text">
            Sammle spontane Augenblicke, echte Begegnungen und kleine Details – ganz ohne Druck.
          </p>
        </section>

        <section className="name-section fade-in" style={{ animationDelay: "0.1s" }}>
          <label className="name-label" htmlFor="userName">Wie heißt du?</label>
          <p className="name-hint">Dein Name erscheint auf deinen Fotos, damit Arienne &amp; Andy wissen, von wem sie sind.</p>
          <input
            id="userName"
            className="name-input"
            type="text"
            placeholder="Dein Name"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && confirmName()}
            maxLength={40}
            autoFocus
            autoComplete="off"
          />
          <button className="btn-full btn-primary" onClick={confirmName} disabled={!userName.trim()}>
            Los geht's!
          </button>
        </section>

        <footer className="credit">Made with ♥ by Yves</footer>
      </main>
    );
  }

  return (
    <main className="container">
      {confettiKey > 0 && <Celebration key={confettiKey} />}
      <Toast message={toast} visible={!!toast} />

      <ResetTitle onReset={handleReset} />

      <section className="hero fade-in">
        <h1>
          5&nbsp;Momente.
          <br />
          Ein&nbsp;Abend.
          <br />
          Eure&nbsp;Erinnerungen.
        </h1>
        <p className="sub">Foto‑Challenge für Arienne&nbsp;&amp;&nbsp;Andy</p>
        <p className="text">
          Sammle spontane Augenblicke, echte Begegnungen und kleine Details – ganz ohne Druck.
        </p>
      </section>

      <section className="steps fade-in" style={{ animationDelay: "0.1s" }}>
        <p className="steps-heading">So einfach geht's:</p>
        <ol className="steps-list">
          <li>Erledige die 5 Foto‑Challenges</li>
          <li>Lade deine Bilder direkt hier hoch</li>
        </ol>
        <p className="hint">👉 Es gibt kein „richtig" oder „falsch" – nur schöne Momente.</p>
      </section>

      <div className="progress-bar-wrap fade-in" style={{ animationDelay: "0.2s" }}>
        <div className="progress-bar" style={{ width: `${(completed / 5) * 100}%` }} />
        <span className="progress-label">
          {completed === 5 ? "🎉 Alle geschafft!" : `${completed} / 5 erledigt`}
        </span>
      </div>

      {challenges.map((c, i) => {
        const entry = done[c.id];
        const isDone = Boolean(entry);
        const thumbUrl = typeof entry === "object" && entry ? entry.thumb : null;
        return (
          <div
            key={c.id}
            className={`card fade-in-up ${isDone ? "card--done" : ""}`}
            style={{ animationDelay: `${0.15 + i * 0.07}s` }}
          >
            <div className="card-header">
              {thumbUrl ? (
                <img src={thumbUrl} alt="" className="card-own-thumb" />
              ) : (
                <span className="card-emoji">{c.emoji}</span>
              )}
              <h2>{c.title}</h2>
              {isDone && <span className="card-check">✓</span>}
            </div>
            <p>{c.desc}</p>
            <small>{c.detail}</small>
            <div className="actions">
              <button onClick={() => setActive(c)}>
                <Camera size={18} /> {isDone ? "Foto ersetzen" : "Foto aufnehmen"}
              </button>
            </div>
          </div>
        );
      })}

      {completed === 5 && (
        <div className="completed-msg fade-in">
          <PartyPopper size={28} />
          <p>
            Du hast alle Challenges gemeistert!
            <br />
            Danke für deine tollen Momente.
          </p>
        </div>
      )}

      {active && (
        <UploadModal
          challenge={active}
          onClose={() => setActive(null)}
          onSuccess={handleUploadSuccess}
          userName={userName}
          existingIdempotencyKey={
            (done[active.id] && typeof done[active.id] === "object" && done[active.id].idempotencyKey) || null
          }
        />
      )}

      <div className="party-upload-section fade-in" style={{ animationDelay: "0.5s" }}>
        <p className="party-upload-text">Noch mehr Schnappschüsse? Lade hier deine Partyfotos hoch!</p>
        <button className="btn-full secondary" onClick={() => setPartyUploadOpen(true)}>
          <Images size={18} /> Weitere Partyfotos
        </button>
      </div>

      {partyUploadOpen && (
        <PartyUploadModal
          onClose={() => setPartyUploadOpen(false)}
          onSuccess={() => showToast("Fotos hochgeladen!")}
          userName={userName}
        />
      )}

      <footer className="credit">Made with ♥ by Yves</footer>
    </main>
  );
}

// ================================================================
// UPLOAD MODAL
// ================================================================
function UploadModal({ challenge, onClose, onSuccess, userName, existingIdempotencyKey }) {
  const cameraRef = useRef();
  const galleryRef = useRef();
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [preview, setPreview] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [error, setError] = useState(null);
  const idempotencyKeyRef = useRef(existingIdempotencyKey || null);
  const xhrRef = useRef(null);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const modalRef = useRef(null);

  useEffect(() => {
    document.body.style.overflow = "hidden";

    // Focus trap: keep focus inside the modal
    function handleKeyDown(e) {
      if (e.key === "Escape" && !uploading) {
        onClose();
        return;
      }
      if (e.key !== "Tab" || !modalRef.current) return;
      const focusable = modalRef.current.querySelectorAll(
        'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", handleKeyDown);
      if (xhrRef.current) xhrRef.current.abort();
    };
  }, [uploading, onClose]);

  function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (preview) URL.revokeObjectURL(preview);
    // Use createImageBitmap to render a correctly-oriented preview (EXIF fix for older Android)
    if (typeof createImageBitmap === "function") {
      createImageBitmap(file).then((bmp) => {
        const canvas = document.createElement("canvas");
        const scale = Math.min(1, 800 / Math.max(bmp.width, bmp.height));
        canvas.width = Math.round(bmp.width * scale);
        canvas.height = Math.round(bmp.height * scale);
        canvas.getContext("2d").drawImage(bmp, 0, 0, canvas.width, canvas.height);
        if (typeof bmp.close === "function") bmp.close();
        canvas.toBlob((blob) => {
          if (blob) setPreview(URL.createObjectURL(blob));
          else setPreview(URL.createObjectURL(file));
        }, "image/jpeg", 0.8);
      }).catch(() => {
        setPreview(URL.createObjectURL(file));
      });
    } else {
      setPreview(URL.createObjectURL(file));
    }
    setSelectedFile(file);
    setError(null);
  }

  async function confirmUpload() {
    if (!selectedFile) return;
    setError(null);

    // Client-side size check before expensive processing
    const maxClientMb = 25;
    if (selectedFile.size > maxClientMb * 1024 * 1024) {
      setError(`Bild ist zu groß (${Math.round(selectedFile.size / 1024 / 1024)} MB). Maximal ${maxClientMb} MB.`);
      return;
    }

    setUploading(true);
    setProcessing(true);
    setUploadProgress(0);

    // Stable idempotency key so retries overwrite the same R2 object
    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current = generateIdempotencyKey();
    }
    const usedIdempotencyKey = idempotencyKeyRef.current;

    try {
      const { original, thumb } = await processImage(selectedFile);
      setProcessing(false);

      const form = new FormData();
      form.append("photo", original, "photo.jpg");
      form.append("thumb", thumb, "thumb.jpg");
      form.append("challengeId", challenge.id);
      form.append("name", userName || "");
      form.append("idempotencyKey", idempotencyKeyRef.current);

      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhrRef.current = xhr;
        xhr.open("POST", `${API_BASE}/upload`);
        xhr.upload.onprogress = (ev) => {
          if (ev.lengthComputable) {
            setUploadProgress(Math.round((ev.loaded / ev.total) * 100));
          }
        };
        xhr.onload = () => {
          xhrRef.current = null;
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            let msg = `Upload fehlgeschlagen (${xhr.status})`;
            try { const data = JSON.parse(xhr.responseText); if (data.error) msg = data.error; } catch { /* ignore */ }
            reject(new Error(msg));
          }
        };
        xhr.onerror = () => { xhrRef.current = null; reject(new Error("Netzwerkfehler")); };
        xhr.onabort = () => { xhrRef.current = null; reject(new Error("Abgebrochen")); };
        xhr.send(form);
      });

      idempotencyKeyRef.current = null;

      // Convert thumb blob to data URL so we can show it on the card after upload
      let thumbDataUrl = null;
      try {
        thumbDataUrl = await new Promise((res, rej) => {
          const r = new FileReader();
          r.onload = () => res(r.result);
          r.onerror = () => rej(r.error);
          r.readAsDataURL(thumb);
        });
      } catch { /* non-fatal */ }

      onSuccess(challenge.id, thumbDataUrl, usedIdempotencyKey);
    } catch (err) {
      setError(err.message || "Upload fehlgeschlagen");
      setUploading(false);
      setProcessing(false);
    }
  }

  function resetPreview() {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setSelectedFile(null);
    setError(null);
    if (cameraRef.current) cameraRef.current.value = "";
    if (galleryRef.current) galleryRef.current.value = "";
  }

  function handleClose() {
    if (uploading) return;
    onClose();
  }

  return (
    <div className="modal" onClick={handleClose} role="dialog" aria-modal="true" aria-labelledby="upload-modal-title">
      <div className="modal-box slide-up" ref={modalRef} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 id="upload-modal-title">
            {challenge.emoji} {challenge.title}
          </h3>
          {!uploading && (
            <button className="btn-icon" onClick={handleClose} aria-label="Schließen">
              <X size={20} />
            </button>
          )}
        </div>

        <p className="modal-desc">{challenge.desc}</p>

        {error && (
          <div className="error">
            <p>{error}</p>
            {selectedFile && !uploading && (
              <button className="btn-retry" onClick={confirmUpload}>
                <RefreshCw size={16} /> Nochmal versuchen
              </button>
            )}
          </div>
        )}

        {preview ? (
          <div className="preview-wrap">
            <img src={preview} alt="Vorschau" className="preview-img" />
            {uploading ? (
              <div className="uploading">
                {processing ? (
                  <>
                    <Loader size={24} className="spin" />
                    <span>Bild wird vorbereitet…</span>
                  </>
                ) : (
                  <div className="upload-progress">
                    <div className="upload-progress-bar-wrap">
                      <div className="upload-progress-bar" style={{ width: `${uploadProgress}%` }} />
                    </div>
                    <span className="upload-progress-label">
                      {uploadProgress < 100 ? `Wird hochgeladen… ${uploadProgress}%` : "Wird gespeichert…"}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="preview-actions">
                <button className="btn-full btn-primary" onClick={confirmUpload}>
                  <Check size={18} /> Foto hochladen
                </button>
                <button className="btn-full secondary" onClick={resetPreview}>
                  Anderes Foto wählen
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFile}
              style={{ display: "none" }}
            />
            <input ref={galleryRef} type="file" accept="image/*" onChange={handleFile} style={{ display: "none" }} />

            <button className="btn-full btn-primary" onClick={() => cameraRef.current.click()}>
              <Camera size={20} /> Foto aufnehmen
            </button>
            <button className="btn-full secondary" onClick={() => galleryRef.current.click()}>
              <ImageIcon size={18} /> Aus Galerie wählen
            </button>
          </>
        )}

        {!uploading && (
          <button className="btn-full btn-cancel" onClick={handleClose}>
            Abbrechen
          </button>
        )}
      </div>
    </div>
  );
}

// ================================================================
// PARTY UPLOAD MODAL — Multi-file gallery upload for extra party photos
// ================================================================
function PartyUploadModal({ onClose, onSuccess, userName }) {
  const fileRef = useRef();
  const modalRef = useRef(null);
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadIndex, setUploadIndex] = useState(0);
  const [uploadTotal, setUploadTotal] = useState(0);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);
  const xhrRef = useRef(null);

  useEffect(() => {
    document.body.style.overflow = "hidden";

    function handleKeyDown(e) {
      if (e.key === "Escape" && !uploading) {
        onClose();
        return;
      }
      if (e.key !== "Tab" || !modalRef.current) return;
      const focusable = modalRef.current.querySelectorAll(
        'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", handleKeyDown);
      if (xhrRef.current) xhrRef.current.abort();
    };
  }, [uploading, onClose]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleFiles(e) {
    const selected = Array.from(e.target.files || []);
    // Filter to images only
    const images = selected.filter((f) => f.type.startsWith("image/"));
    if (images.length === 0) {
      setError("Bitte nur Bilder auswählen.");
      return;
    }

    const MAX_FILES = 20;
    const limited = images.slice(0, MAX_FILES);
    const msgs = [];
    if (images.length < selected.length) {
      msgs.push(`${selected.length - images.length} Datei(en) übersprungen (keine Bilder).`);
    }
    if (images.length > MAX_FILES) {
      msgs.push(`Maximal ${MAX_FILES} Fotos auf einmal – nur die ersten ${MAX_FILES} wurden übernommen.`);
    }
    setError(msgs.length > 0 ? msgs.join(" ") : null);
    setFiles(limited);
  }

  async function uploadAll() {
    if (files.length === 0) return;
    setError(null);
    setUploading(true);
    setProcessing(true);
    setUploadTotal(files.length);
    setUploadIndex(0);
    setUploadProgress(0);

    let successCount = 0;

    for (let i = 0; i < files.length; i++) {
      setUploadIndex(i);
      setUploadProgress(0);
      const file = files[i];

      // Client-side size check
      if (file.size > 25 * 1024 * 1024) {
        continue; // skip oversized files silently
      }

      try {
        setProcessing(true);
        const { original, thumb } = await processImage(file);
        setProcessing(false);

        const form = new FormData();
        form.append("photo", original, "photo.jpg");
        form.append("thumb", thumb, "thumb.jpg");
        form.append("name", userName || "");
        form.append("idempotencyKey", generateIdempotencyKey());

        await new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhrRef.current = xhr;
          xhr.open("POST", `${API_BASE}/upload-party`);
          xhr.upload.onprogress = (ev) => {
            if (ev.lengthComputable) {
              setUploadProgress(Math.round((ev.loaded / ev.total) * 100));
            }
          };
          xhr.onload = () => {
            xhrRef.current = null;
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve();
            } else {
              let msg = `Upload fehlgeschlagen (${xhr.status})`;
              try { const data = JSON.parse(xhr.responseText); if (data.error) msg = data.error; } catch { /* ignore */ }
              reject(new Error(msg));
            }
          };
          xhr.onerror = () => { xhrRef.current = null; reject(new Error("Netzwerkfehler")); };
          xhr.onabort = () => { xhrRef.current = null; reject(new Error("Abgebrochen")); };
          xhr.send(form);
        });

        successCount++;
      } catch (err) {
        setError(`Fehler bei Bild ${i + 1}: ${err.message}`);
        setProcessing(false);
      }
    }

    setUploading(false);
    setProcessing(false);
    if (successCount > 0) {
      onSuccess();
      onClose();
    }
  }

  function handleClose() {
    if (uploading) return;
    onClose();
  }

  return (
    <div className="modal" onClick={handleClose} role="dialog" aria-modal="true" aria-labelledby="party-modal-title">
      <div className="modal-box slide-up" ref={modalRef} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 id="party-modal-title">📸 Partyfotos</h3>
          {!uploading && (
            <button className="btn-icon" onClick={handleClose} aria-label="Schließen">
              <X size={20} />
            </button>
          )}
        </div>

        <p className="modal-desc">Lade deine schönsten Partyfotos hoch – du kannst bis zu 20 auf einmal auswählen.</p>

        {error && (
          <div className="error">
            <p>{error}</p>
          </div>
        )}

        {uploading ? (
          <div className="uploading">
            {processing ? (
              <>
                <Loader size={24} className="spin" />
                <span>Bild {uploadIndex + 1} von {uploadTotal} wird vorbereitet…</span>
              </>
            ) : (
              <div className="upload-progress">
                <div className="upload-progress-bar-wrap">
                  <div className="upload-progress-bar" style={{ width: `${uploadProgress}%` }} />
                </div>
                <span className="upload-progress-label">
                  Bild {uploadIndex + 1} von {uploadTotal} – {uploadProgress < 100 ? `${uploadProgress}%` : "Wird gespeichert…"}
                </span>
              </div>
            )}
          </div>
        ) : (
          <>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFiles}
              style={{ display: "none" }}
            />

            {files.length > 0 ? (
              <>
                <p className="party-count">{files.length} Foto{files.length !== 1 ? "s" : ""} ausgewählt</p>
                <button className="btn-full btn-primary" onClick={uploadAll}>
                  <Check size={18} /> {files.length} Foto{files.length !== 1 ? "s" : ""} hochladen
                </button>
                <button className="btn-full secondary" onClick={() => fileRef.current.click()}>
                  Andere Fotos wählen
                </button>
              </>
            ) : (
              <button className="btn-full btn-primary" onClick={() => fileRef.current.click()}>
                <ImageIcon size={18} /> Fotos aus Galerie wählen
              </button>
            )}

            <button className="btn-full btn-cancel" onClick={handleClose}>
              Abbrechen
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ================================================================
// AUTH IMAGE — loads image via fetch with auth header
// ================================================================
function AuthImage({ src, token, alt, className, onClick }) {
  const [blobUrl, setBlobUrl] = useState(null);
  const [failed, setFailed] = useState(false);
  const blobRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(src, { headers: { "x-admin-token": token } });
        if (!res.ok) throw new Error("Load failed");
        const blob = await res.blob();
        if (!cancelled) {
          const url = URL.createObjectURL(blob);
          blobRef.current = url;
          setBlobUrl(url);
        }
      } catch {
        if (!cancelled) setFailed(true);
      }
    }

    load();
    return () => {
      cancelled = true;
      if (blobRef.current) URL.revokeObjectURL(blobRef.current);
    };
  }, [src, token]);

  if (failed) return <div className="thumb-placeholder">⚠️</div>;
  if (!blobUrl) return <div className="thumb-placeholder"><Loader size={16} className="spin" /></div>;

  return <img src={blobUrl} alt={alt} className={className} onClick={onClick} loading="lazy" />;
}

// ================================================================
// ADMIN PAGE — Gallery + ZIP Download
// ================================================================
function AdminPage() {
  const [token, setToken] = useState("");
  const [authed, setAuthed] = useState(false);
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [viewer, setViewer] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [confirmState, setConfirmState] = useState(null); // { kind: 'one' | 'all', photo? }
  const [confirmInput, setConfirmInput] = useState("");

  async function login() {
    if (!token.trim()) {
      setError("Bitte Admin Token eingeben.");
      return;
    }
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`${API_BASE}/photos`, { headers: { "x-admin-token": token } });
      if (!res.ok) {
        if (res.status === 401) throw new Error("Ungültiger Admin Token.");
        throw new Error(`Fehler (${res.status})`);
      }
      const data = await res.json();
      setPhotos(data.photos || []);
      setAuthed(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function refreshPhotos() {
    setRefreshing(true);
    try {
      const res = await fetch(`${API_BASE}/photos`, { headers: { "x-admin-token": token } });
      if (res.ok) {
        const data = await res.json();
        setPhotos(data.photos || []);
      }
    } catch {
      /* silent */
    } finally {
      setRefreshing(false);
    }
  }

  async function downloadZip(categoryId) {
    const targetPhotos = photos.filter((p) => (p.challengeId || p.key.split("/")[0]) === categoryId);

    if (targetPhotos.length === 0) {
      setError("Keine Fotos zum Herunterladen.");
      return;
    }

    // Direct browser download via Worker-streamed ZIP (no memory issues)
    const zipUrl = `${API_BASE}/download/zip?challenge=${encodeURIComponent(categoryId)}&token=${encodeURIComponent(token)}`;
    const a = document.createElement("a");
    a.href = zipUrl;
    a.download = "";
    a.click();
  }

  function openFullSize(photo) {
    const url = `${API_BASE}/photo/full/${encodeURIComponent(photo.key)}`;
    setViewer({ key: photo.key, url, name: photo.key.split("/").pop(), token });
  }

  async function deletePhoto(photo) {
    if (deleting) return;
    setDeleting(photo.key);
    try {
      const res = await fetch(`${API_BASE}/photo/${encodeURIComponent(photo.key)}`, {
        method: "DELETE",
        headers: { "x-admin-token": token },
      });
      if (!res.ok) throw new Error("Delete failed");
      setPhotos((prev) => prev.filter((p) => p.key !== photo.key));
    } catch {
      setError("Löschen fehlgeschlagen.");
    } finally {
      setDeleting(null);
    }
  }

  function closeViewer() {
    setViewer(null);
  }

  async function deleteAll() {
    if (deleting) return;
    setDeleting("all");
    try {
      const res = await fetch(`${API_BASE}/photos`, {
        method: "DELETE",
        headers: { "x-admin-token": token },
      });
      if (!res.ok) throw new Error("Delete failed");
      setPhotos([]);
    } catch {
      setError("Löschen fehlgeschlagen.");
      refreshPhotos();
    } finally {
      setDeleting(null);
    }
  }

  // Group photos by challenge
  const grouped = {};
  const partyPhotos = [];
  for (const c of challenges) grouped[c.id] = [];
  for (const photo of photos) {
    const cid = photo.challengeId || photo.key.split("/")[0];
    if (cid === "party") {
      partyPhotos.push(photo);
    } else if (grouped[cid]) {
      grouped[cid].push(photo);
    } else {
      grouped[cid] = [photo];
    }
  }

  const totalSize = photos.reduce((sum, p) => sum + (p.size || 0), 0);
  const totalSizeMB = (totalSize / (1024 * 1024)).toFixed(0);

  if (!authed) {
    return (
      <div className="admin">
        <h1>Admin</h1>
        <p className="text">Melde dich an, um die Galerie zu sehen und Fotos herunterzuladen.</p>
        <div className="admin-form">
          <input
            type="password"
            placeholder="Admin Token"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && login()}
            disabled={loading}
            autoFocus
          />
          <button onClick={login} disabled={loading}>
            {loading ? (
              <>
                <Loader size={18} className="spin" /> Laden…
              </>
            ) : (
              "Anmelden"
            )}
          </button>
        </div>
        {error && <p className="error">{error}</p>}
      </div>
    );
  }

  return (
    <div className="admin">
      {/* Top Bar */}
      <div className="admin-top-bar">
        <div>
          <h1>Galerie</h1>
          <p className="admin-meta">
            {photos.length} Fotos{totalSize > 0 ? ` · ${totalSizeMB} MB` : ""}
          </p>
        </div>
        <div className="admin-top-actions">
          <button
            className="btn-icon-label"
            onClick={() => { setConfirmInput(""); setConfirmState({ kind: "all" }); }}
            disabled={deleting || photos.length === 0}
            title="Alle löschen"
            style={{ color: "#e74c3c" }}
          >
            <Trash2 size={18} />
          </button>
          <button
            className="btn-icon-label"
            onClick={refreshPhotos}
            disabled={refreshing}
            title="Aktualisieren"
          >
            <RefreshCw size={18} className={refreshing ? "spin" : ""} />
          </button>
        </div>
      </div>

      {error && <p className="error">{error}</p>}

      {/* Gallery by Challenge */}
      {challenges.map((c) => {
        const cPhotos = grouped[c.id] || [];
        if (cPhotos.length === 0) return null;

        return (
          <section key={c.id} className="admin-section">
            <div className="admin-section-header">
              <h2>
                {c.emoji} {c.title} <span className="admin-count">({cPhotos.length})</span>
              </h2>
              <button
                className="btn-category-zip"
                onClick={() => downloadZip(c.id)}
                title={`${c.title} als ZIP laden`}
              >
                <Download size={14} />
              </button>
            </div>
            <div className="gallery-grid">
              {cPhotos.map((photo) => (
                <div key={photo.key} className="gallery-item">
                  <button className="gallery-thumb" onClick={() => openFullSize(photo)}>
                    <AuthImage
                      src={`${API_BASE}/photo/${photo.hasThumb !== false ? "thumb" : "full"}/${encodeURIComponent(photo.key)}`}
                      token={token}
                      alt={photo.originalName || "Foto"}
                      className="thumb-img"
                    />
                    <span className="gallery-zoom">
                      <ZoomIn size={14} />
                    </span>
                    <span className="thumb-name">{photo.name || photo.key.split("/").pop()}</span>
                  </button>
                  <button
                    className="btn-icon gallery-delete"
                    onClick={() => setConfirmState({ kind: "one", photo })}
                    disabled={deleting === photo.key}
                    aria-label="Löschen"
                    title="Foto löschen"
                  >
                    {deleting === photo.key ? <Loader size={14} className="spin" /> : <Trash2 size={14} />}
                  </button>
                </div>
              ))}
            </div>
          </section>
        );
      })}

      {/* Party Photos */}
      {partyPhotos.length > 0 && (
        <section className="admin-section">
          <div className="admin-section-header">
            <h2>
              📸 Partyfotos <span className="admin-count">({partyPhotos.length})</span>
            </h2>
            <button
              className="btn-category-zip"
              onClick={() => downloadZip("party")}
              title="Partyfotos als ZIP laden"
            >
              <Download size={14} />
            </button>
          </div>
          <div className="gallery-grid">
            {partyPhotos.map((photo) => (
              <div key={photo.key} className="gallery-item">
                <button className="gallery-thumb" onClick={() => openFullSize(photo)}>
                  <AuthImage
                    src={`${API_BASE}/photo/${photo.hasThumb !== false ? "thumb" : "full"}/${encodeURIComponent(photo.key)}`}
                    token={token}
                    alt={photo.originalName || "Foto"}
                    className="thumb-img"
                  />
                  <span className="gallery-zoom">
                    <ZoomIn size={14} />
                  </span>
                  <span className="thumb-name">{photo.name || photo.key.split("/").pop()}</span>
                </button>
                <button
                  className="btn-icon gallery-delete"
                  onClick={() => setConfirmState({ kind: "one", photo })}
                  disabled={deleting === photo.key}
                  aria-label="Löschen"
                  title="Foto löschen"
                >
                  {deleting === photo.key ? <Loader size={14} className="spin" /> : <Trash2 size={14} />}
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {photos.length === 0 && (
        <p className="text" style={{ textAlign: "center", marginTop: 40 }}>
          Noch keine Fotos hochgeladen.
        </p>
      )}

      {/* Fullscreen Viewer */}
      {viewer && <ImageViewer viewer={viewer} onClose={closeViewer} />}

      {confirmState && (
        <ConfirmDialog
          title={confirmState.kind === "all" ? "Alle Fotos löschen?" : "Foto löschen?"}
          message={
            confirmState.kind === "all"
              ? `Du bist im Begriff, ${photos.length} Fotos unwiderruflich zu löschen.`
              : `"${(confirmState.photo.name || confirmState.photo.key.split("/").pop())}" wird unwiderruflich gelöscht.`
          }
          confirmText={confirmState.kind === "all" ? "LÖSCHEN" : null}
          confirmInput={confirmInput}
          onConfirmInput={setConfirmInput}
          onCancel={() => { setConfirmState(null); setConfirmInput(""); }}
          onConfirm={() => {
            const action = confirmState.kind === "all" ? deleteAll : () => deletePhoto(confirmState.photo);
            setConfirmState(null);
            setConfirmInput("");
            action();
          }}
        />
      )}
    </div>
  );
}

// ================================================================
// CONFIRM DIALOG — Styled in-app confirmation (replaces window.confirm)
// ================================================================
function ConfirmDialog({ title, message, confirmText, confirmInput, onConfirmInput, onCancel, onConfirm }) {
  const requiresTyping = Boolean(confirmText);
  const canConfirm = !requiresTyping || confirmInput === confirmText;

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div className="modal" onClick={onCancel} role="dialog" aria-modal="true" aria-labelledby="confirm-title">
      <div className="modal-box slide-up confirm-box" onClick={(e) => e.stopPropagation()}>
        <h3 id="confirm-title" className="confirm-title">{title}</h3>
        <p className="confirm-message">{message}</p>

        {requiresTyping && (
          <>
            <label htmlFor="confirm-input" className="confirm-label">
              Tippe <strong>{confirmText}</strong>, um zu bestätigen:
            </label>
            <input
              id="confirm-input"
              type="text"
              className="name-input"
              value={confirmInput}
              onChange={(e) => onConfirmInput(e.target.value)}
              autoFocus
              autoComplete="off"
              autoCapitalize="characters"
            />
          </>
        )}

        <button
          className="btn-full btn-danger"
          onClick={onConfirm}
          disabled={!canConfirm}
        >
          <Trash2 size={18} /> Löschen
        </button>
        <button className="btn-full btn-cancel" onClick={onCancel}>
          Abbrechen
        </button>
      </div>
    </div>
  );
}

// ================================================================
// IMAGE VIEWER — Full-size with auth loading
// ================================================================
function ImageViewer({ viewer, onClose }) {
  const [blobUrl, setBlobUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const blobRef = useRef(null);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(viewer.url, { headers: { "x-admin-token": viewer.token } });
        if (!res.ok) throw new Error("Load failed");
        const blob = await res.blob();
        if (!cancelled) {
          const url = URL.createObjectURL(blob);
          blobRef.current = url;
          setBlobUrl(url);
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
      document.body.style.overflow = "";
      if (blobRef.current) URL.revokeObjectURL(blobRef.current);
    };
  }, [viewer.url, viewer.token]);

  function downloadPhoto() {
    if (!blobUrl) return;
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = viewer.name;
    a.click();
  }

  return (
    <div className="viewer-overlay" onClick={onClose}>
      <div className="viewer-content" onClick={(e) => e.stopPropagation()}>
        <div className="viewer-toolbar">
          <button className="btn-icon viewer-btn" onClick={onClose} aria-label="Schließen">
            <X size={22} />
          </button>
          <button className="btn-icon viewer-btn" onClick={downloadPhoto} aria-label="Herunterladen" disabled={!blobUrl}>
            <Download size={22} />
          </button>
        </div>
        {loading ? (
          <div className="viewer-loading">
            <Loader size={32} className="spin" />
          </div>
        ) : blobUrl ? (
          <img src={blobUrl} alt="Vollbild" className="viewer-img" />
        ) : (
          <div className="viewer-loading">
            <p>Bild konnte nicht geladen werden.</p>
          </div>
        )}
      </div>
    </div>
  );
}
