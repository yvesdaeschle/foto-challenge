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
    ctx.drawImage(img, 0, 0, w, h);
    canvas.toBlob((blob) => {
      if (!blob) return reject(new Error("Bildverarbeitung fehlgeschlagen"));
      resolve(blob);
    }, "image/jpeg", quality);
  });
}

async function processImage(file) {
  // createImageBitmap respects EXIF orientation (prevents rotated photos from iOS/Android)
  const img = typeof createImageBitmap === "function"
    ? await createImageBitmap(file)
    : await loadImage(file);
  const [original, thumb] = await Promise.all([
    resizeToBlob(img, 3200, 0.92),
    resizeToBlob(img, 250, 0.65),
  ]);
  return { original, thumb };
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
// APP
// ================================================================
export default function App() {
  const route = getRoute();
  if (route === "admin") return <AdminPage />;
  if (route === "home") return <HomePage />;
  return <LandingRedirect />;
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
// CELEBRATION — Full-screen animated overlay on challenge complete
// ================================================================
function Celebration() {
  const [pieces] = useState(() => {
    const colors = ["#F4B324", "#ff6b6b", "#4ecdc4", "#45b7d1", "#ff9ff3", "#a29bfe", "#55efc4", "#fab1a0"];
    return Array.from({ length: 40 }, (_, i) => ({
      id: i,
      color: colors[i % 8],
      round: i % 2 !== 0,
      left: 50 + (Math.random() - 0.5) * 20,
      tx: Math.round((Math.random() - 0.5) * 80),
      ty: Math.round(-50 - Math.random() * 30),
      rot: Math.round(Math.random() * 720 - 360),
      dur: (0.8 + Math.random() * 1.2).toFixed(2),
      delay: (Math.random() * 0.3).toFixed(2),
    }));
  });

  return (
    <div className="celebration-overlay">
      <div className="celebration-content">
        <span className="celebration-emoji">🎉</span>
        <p className="celebration-text">Geschafft!</p>
      </div>
      {pieces.map((p) => (
        <span
          key={p.id}
          className={`confetti-piece ${p.round ? "confetti-round" : ""} confetti-fly`}
          style={{
            left: `${p.left}%`,
            bottom: "40%",
            background: p.color,
            "--tx": `${p.tx}vw`,
            "--ty": `${p.ty}vh`,
            "--rot": `${p.rot}deg`,
            animationDuration: `${p.dur}s`,
            animationDelay: `${p.delay}s`,
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
    <div className={`toast ${visible ? "toast--show" : ""}`}>
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
  const [done, setDone] = useState({});
  const [active, setActive] = useState(null);
  const [toast, setToast] = useState(null);
  const [confettiKey, setConfettiKey] = useState(0);
  const [userName, setUserName] = useState("");
  const [nameConfirmed, setNameConfirmed] = useState(false);
  const confettiTimer = useRef(null);
  const toastTimer = useRef(null);
  const hasLoaded = useRef(false);
  const initialLoadDone = useRef(false);

  useEffect(() => {
    const savedName = localStorage.getItem("userName");
    if (savedName) {
      setUserName(savedName);
      setNameConfirmed(true);
    }
    const saved = localStorage.getItem("progress");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setDone(parsed);
      } catch {
        /* ignore corrupt data */
      }
    }
    hasLoaded.current = true;
    // Defer save-enable to next tick so the initial setState has rendered
    requestAnimationFrame(() => { initialLoadDone.current = true; });
  }, []);

  useEffect(() => {
    if (initialLoadDone.current) {
      localStorage.setItem("progress", JSON.stringify(done));
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

  const handleUploadSuccess = useCallback(
    (challengeId) => {
      setDone((d) => {
        const next = { ...d, [challengeId]: true };
        // Trigger celebration only when all 5 challenges are done
        if (challenges.every((c) => next[c.id])) {
          if (confettiTimer.current) clearTimeout(confettiTimer.current);
          setConfettiKey((k) => k + 1);
          confettiTimer.current = setTimeout(() => setConfettiKey(0), 5500);
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
        const isDone = done[c.id];
        return (
          <div
            key={c.id}
            className={`card fade-in-up ${isDone ? "card--done" : ""}`}
            style={{ animationDelay: `${0.15 + i * 0.07}s` }}
          >
            <div className="card-header">
              <span className="card-emoji">{c.emoji}</span>
              <h2>{c.title}</h2>
              {isDone && <span className="card-check">✓</span>}
            </div>
            <p>{c.desc}</p>
            <small>{c.detail}</small>
            <div className="actions">
              <button onClick={() => setActive(c)}>
                <Camera size={18} /> Foto aufnehmen
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
        <UploadModal challenge={active} onClose={() => setActive(null)} onSuccess={handleUploadSuccess} userName={userName} />
      )}

      <footer className="credit">Made with ♥ by Yves</footer>
    </main>
  );
}

// ================================================================
// UPLOAD MODAL
// ================================================================
function UploadModal({ challenge, onClose, onSuccess, userName }) {
  const cameraRef = useRef();
  const galleryRef = useRef();
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [preview, setPreview] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (preview) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(file));
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

    try {
      const { original, thumb } = await processImage(selectedFile);
      setProcessing(false);

      const form = new FormData();
      form.append("photo", original, "photo.jpg");
      form.append("thumb", thumb, "thumb.jpg");
      form.append("challengeId", challenge.id);
      form.append("name", userName || "");

      const res = await fetch(`${API_BASE}/upload`, { method: "POST", body: form });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Upload fehlgeschlagen (${res.status})`);
      }

      onSuccess(challenge.id);
    } catch (err) {
      setError(err.message || "Upload fehlgeschlagen");
      setUploading(false);
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
    <div className="modal" onClick={handleClose}>
      <div className="modal-box slide-up" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>
            {challenge.emoji} {challenge.title}
          </h3>
          {!uploading && (
            <button className="btn-icon" onClick={handleClose} aria-label="Schließen">
              <X size={20} />
            </button>
          )}
        </div>

        <p className="modal-desc">{challenge.desc}</p>

        {error && <p className="error">{error}</p>}

        {preview ? (
          <div className="preview-wrap">
            <img src={preview} alt="Vorschau" className="preview-img" />
            {uploading ? (
              <div className="uploading">
                <Loader size={24} className="spin" />
                <span>{processing ? "Bild wird vorbereitet…" : "Wird hochgeladen…"}</span>
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
    if (!window.confirm(`"${photo.name || photo.key.split("/").pop()}" wirklich löschen?`)) return;
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

  // Group photos by challenge
  const grouped = {};
  for (const c of challenges) grouped[c.id] = [];
  for (const photo of photos) {
    const cid = photo.challengeId || photo.key.split("/")[0];
    if (grouped[cid]) grouped[cid].push(photo);
    else grouped[cid] = [photo];
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
                    onClick={() => deletePhoto(photo)}
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

      {photos.length === 0 && (
        <p className="text" style={{ textAlign: "center", marginTop: 40 }}>
          Noch keine Fotos hochgeladen.
        </p>
      )}

      {/* Fullscreen Viewer */}
      {viewer && <ImageViewer viewer={viewer} onClose={closeViewer} />}
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
