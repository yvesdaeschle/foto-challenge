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
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

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
    id: "new-faces",
    emoji: "🆕",
    title: "New Faces",
    desc: "Macht ein Foto mit jemandem, den ihr heute neu kennengelernt habt.",
    detail: "Ein kurzer Moment, ein neues Gesicht, schöne Gespräche.",
  },
  {
    id: "detail-love",
    emoji: "✨",
    title: "Detail Love",
    desc: "Fotografiert ein schönes Party‑Detail.",
    detail: "Deko, Drinks, Essen, Licht, Blumen – die kleinen Dinge machen den Abend besonders.",
  },
  {
    id: "small-chaos",
    emoji: "🎭",
    title: "Small Chaos",
    desc: "Gruppenfoto: Alle machen gleichzeitig etwas anderes.",
    detail: "Lachen, reden, tanzen, schauen, winken. Perfektion verboten – Chaos erlaubt.",
  },
  {
    id: "hands-only",
    emoji: "🤝",
    title: "Hands Only",
    desc: "Nur Hände im Bild.",
    detail: "Hands‑up, Handschlag, Kaffeebecher...",
  },
  {
    id: "golden-hour",
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
// CONFETTI
// ================================================================
function Confetti({ active }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const colors = ["#f7b52c", "#ff6b6b", "#4ecdc4", "#45b7d1", "#96ceb4", "#ffeaa7", "#dfe6e9", "#fd79a8"];
    const pieces = Array.from({ length: 120 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * -canvas.height,
      w: 6 + Math.random() * 8,
      h: 4 + Math.random() * 6,
      color: colors[Math.floor(Math.random() * colors.length)],
      vy: 2 + Math.random() * 4,
      vx: (Math.random() - 0.5) * 3,
      rot: Math.random() * 360,
      vr: (Math.random() - 0.5) * 8,
    }));

    let frame;
    let alpha = 1;
    const fadeStart = Date.now() + 2500;

    function draw() {
      const now = Date.now();
      if (now > fadeStart) alpha = Math.max(0, 1 - (now - fadeStart) / 1500);
      if (alpha <= 0) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.globalAlpha = alpha;

      for (const p of pieces) {
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        p.vy += 0.05;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rot * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }

      frame = requestAnimationFrame(draw);
    }

    draw();
    return () => cancelAnimationFrame(frame);
  }, [active]);

  if (!active) return null;
  return <canvas ref={canvasRef} className="confetti-canvas" />;
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
// HOME PAGE
// ================================================================
function HomePage() {
  const [done, setDone] = useState({});
  const [active, setActive] = useState(null);
  const [toast, setToast] = useState(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const prevCompleted = useRef(0);
  const toastTimer = useRef(null);

  useEffect(() => {
    const saved = localStorage.getItem("progress");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setDone(parsed);
        prevCompleted.current = Object.values(parsed).filter(Boolean).length;
      } catch {
        /* ignore corrupt data */
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("progress", JSON.stringify(done));
  }, [done]);

  const completed = Object.values(done).filter(Boolean).length;

  useEffect(() => {
    if (completed === 5 && prevCompleted.current < 5) {
      setShowConfetti(true);
      const timer = setTimeout(() => setShowConfetti(false), 4500);
      prevCompleted.current = completed;
      return () => clearTimeout(timer);
    }
    prevCompleted.current = completed;
  }, [completed]);

  const showToast = useCallback((msg) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  const handleUploadSuccess = useCallback(
    (challengeId) => {
      setDone((d) => ({ ...d, [challengeId]: true }));
      setActive(null);
      showToast("Foto hochgeladen!");
    },
    [showToast]
  );

  return (
    <main className="container">
      <Confetti active={showConfetti} />
      <Toast message={toast} visible={!!toast} />

      <p className="event-title">12&nbsp;½&nbsp;Jahre Adams&nbsp;Family</p>

      <section className="hero fade-in">
        <h1>
          5&nbsp;Momente.
          <br />
          Ein&nbsp;Abend.
          <br />
          Eure&nbsp;Erinnerungen.
        </h1>
        <p className="sub">Willkommen zur Foto‑Challenge!</p>
        <p className="text">
          Sammelt spontane Augenblicke, echte Begegnungen und kleine Details – ganz ohne Druck.
        </p>
      </section>

      <section className="steps fade-in" style={{ animationDelay: "0.1s" }}>
        <p className="steps-heading">So einfach geht's:</p>
        <ol className="steps-list">
          <li>Erledigt die 5 Foto‑Challenges</li>
          <li>Ladet eure Bilder direkt hier hoch</li>
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
            Ihr habt alle Challenges gemeistert!
            <br />
            Danke für eure tollen Momente.
          </p>
        </div>
      )}

      {active && (
        <UploadModal challenge={active} onClose={() => setActive(null)} onSuccess={handleUploadSuccess} />
      )}
    </main>
  );
}

// ================================================================
// UPLOAD MODAL
// ================================================================
function UploadModal({ challenge, onClose, onSuccess }) {
  const cameraRef = useRef();
  const galleryRef = useRef();
  const [uploading, setUploading] = useState(false);
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
    setUploading(true);
    setError(null);

    try {
      const form = new FormData();
      form.append("photo", selectedFile);
      form.append("challengeId", challenge.id);

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
                <span>Wird hochgeladen…</span>
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

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(src, { headers: { "x-admin-token": token } });
        if (!res.ok) throw new Error("Load failed");
        const blob = await res.blob();
        if (!cancelled) setBlobUrl(URL.createObjectURL(blob));
      } catch {
        if (!cancelled) setFailed(true);
      }
    }

    load();
    return () => {
      cancelled = true;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
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
  const [zipStatus, setZipStatus] = useState("");
  const [zipProgress, setZipProgress] = useState(0);
  const [zipping, setZipping] = useState(false);
  const [viewer, setViewer] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

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
    const targetPhotos = categoryId ? photos.filter((p) => (p.challengeId || p.key.split("/")[0]) === categoryId) : photos;

    if (targetPhotos.length === 0) {
      setError("Keine Fotos zum Herunterladen.");
      return;
    }

    setZipping(true);
    setError("");
    setZipStatus("Lade Fotos…");
    setZipProgress(0);

    try {
      const headers = { "x-admin-token": token };
      const { default: JSZip } = await import("jszip");
      const zip = new JSZip();

      const BATCH_SIZE = 5;
      for (let i = 0; i < targetPhotos.length; i += BATCH_SIZE) {
        const batch = targetPhotos.slice(i, i + BATCH_SIZE);
        const results = await Promise.all(
          batch.map(async (photo) => {
            try {
              const res = await fetch(`${API_BASE}/photo/${encodeURIComponent(photo.key)}`, { headers });
              if (!res.ok) return null;
              return { key: photo.key, blob: await res.blob() };
            } catch {
              return null;
            }
          })
        );

        for (const r of results) {
          if (r) zip.file(r.key, r.blob);
        }

        const done = Math.min(i + BATCH_SIZE, targetPhotos.length);
        setZipProgress((done / targetPhotos.length) * 100);
        setZipStatus(`Lade Foto ${done} / ${targetPhotos.length}…`);
      }

      setZipStatus("Erstelle ZIP-Datei…");
      const zipBlob = await zip.generateAsync({ type: "blob", compression: "STORE" });

      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = categoryId ? `foto-challenge-${categoryId}.zip` : "foto-challenge.zip";
      a.click();
      URL.revokeObjectURL(url);

      setZipStatus(`${targetPhotos.length} Fotos heruntergeladen.`);
    } catch (err) {
      setError(err.message || "ZIP Download fehlgeschlagen");
      setZipStatus("");
    } finally {
      setZipping(false);
    }
  }

  function openFullSize(photo) {
    const url = `${API_BASE}/photo/${encodeURIComponent(photo.key)}`;
    setViewer({ key: photo.key, url, name: photo.originalName || photo.key.split("/").pop(), token });
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
          <button className="btn-zip" onClick={() => downloadZip()} disabled={zipping}>
            <Download size={18} />
            {zipping ? "Lädt…" : "Alle als ZIP"}
          </button>
        </div>
      </div>

      {zipping && (
        <div className="admin-progress-section">
          <div className="admin-progress-wrap">
            <div className="admin-progress-bar" style={{ width: `${zipProgress}%` }} />
          </div>
          <p className="admin-status">{zipStatus}</p>
        </div>
      )}

      {zipStatus && !zipping && <p className="admin-status">{zipStatus}</p>}
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
                disabled={zipping}
                title={`${c.title} als ZIP laden`}
              >
                <Download size={14} />
              </button>
            </div>
            <div className="gallery-grid">
              {cPhotos.map((photo) => (
                <button key={photo.key} className="gallery-thumb" onClick={() => openFullSize(photo)}>
                  <AuthImage
                    src={`${API_BASE}/photo/${encodeURIComponent(photo.key)}`}
                    token={token}
                    alt={photo.originalName || "Foto"}
                    className="thumb-img"
                  />
                  <span className="gallery-zoom">
                    <ZoomIn size={14} />
                  </span>
                </button>
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

  useEffect(() => {
    document.body.style.overflow = "hidden";
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(viewer.url, { headers: { "x-admin-token": viewer.token } });
        if (!res.ok) throw new Error("Load failed");
        const blob = await res.blob();
        if (!cancelled) {
          setBlobUrl(URL.createObjectURL(blob));
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
      if (blobUrl) URL.revokeObjectURL(blobUrl);
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
