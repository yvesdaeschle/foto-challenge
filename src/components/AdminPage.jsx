import React, { useState } from "react";
import { Trash2, RefreshCw, Download, ZoomIn, Loader } from "lucide-react";
import { CHALLENGES, API_BASE } from "../constants.js";
import { AuthImage } from "./AuthImage.jsx";
import { ImageViewer } from "./ImageViewer.jsx";
import { ConfirmDialog } from "./ConfirmDialog.jsx";
import { AdminGallerySkeleton } from "./AdminGallerySkeleton.jsx";

function AdminLoginScreen({ token, setToken, loading, error, onLogin }) {
  return (
    <div className="admin">
      <h1>Admin</h1>
      <p className="text">
        Melde dich an, um die Galerie zu sehen und Fotos herunterzuladen.
      </p>
      <div className="admin-form">
        <input
          type="password"
          placeholder="Admin Token"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onLogin()}
          disabled={loading}
          autoFocus
        />
        <button onClick={onLogin} disabled={loading}>
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

function GallerySection({
  title,
  emoji,
  photos,
  token,
  onPhotoClick,
  onDeletePhoto,
  onDownloadZip,
  deleting,
}) {
  return (
    <section className="admin-section">
      <div className="admin-section-header">
        <h2>
          {emoji} {title} <span className="admin-count">({photos.length})</span>
        </h2>
        <button
          className="btn-category-zip"
          onClick={() => onDownloadZip(title)}
          title={`${title} als ZIP laden`}
        >
          <Download size={14} />
        </button>
      </div>
      <div className="gallery-grid">
        {photos.map((photo) => (
          <div key={photo.key} className="gallery-item">
            <button
              className="gallery-thumb"
              onClick={() => onPhotoClick(photo)}
            >
              <AuthImage
                src={`${API_BASE}/photo/${
                  photo.hasThumb !== false ? "thumb" : "full"
                }/${encodeURIComponent(photo.key)}`}
                token={token}
                alt={photo.originalName || "Foto"}
                className="thumb-img"
              />
              <span className="gallery-zoom">
                <ZoomIn size={14} />
              </span>
              <span className="thumb-name">
                {photo.name || photo.key.split("/").pop()}
              </span>
            </button>
            <button
              className="btn-icon gallery-delete"
              onClick={() => onDeletePhoto(photo)}
              disabled={deleting === photo.key}
              aria-label="Löschen"
              title="Foto löschen"
            >
              {deleting === photo.key ? (
                <Loader size={14} className="spin" />
              ) : (
                <Trash2 size={14} />
              )}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

export function AdminPage() {
  const [token, setToken] = useState("");
  const [authed, setAuthed] = useState(false);
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [viewer, setViewer] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [confirmState, setConfirmState] = useState(null);
  const [confirmInput, setConfirmInput] = useState("");

  async function login() {
    if (!token.trim()) {
      setError("Bitte Admin Token eingeben.");
      return;
    }
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`${API_BASE}/photos`, {
        headers: { "x-admin-token": token },
      });
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
      const res = await fetch(`${API_BASE}/photos`, {
        headers: { "x-admin-token": token },
      });
      if (res.ok) {
        const data = await res.json();
        setPhotos(data.photos || []);
      }
    } catch (err) {
      setError(`Aktualisierung fehlgeschlagen: ${err.message}`);
    } finally {
      setRefreshing(false);
    }
  }

  async function downloadZip(categoryIdOrEmoji) {
    const categoryId = CHALLENGES.find((c) => c.emoji === categoryIdOrEmoji)?.id || categoryIdOrEmoji;
    const targetPhotos = photos.filter(
      (p) => (p.challengeId || p.key.split("/")[0]) === categoryId
    );

    if (targetPhotos.length === 0) {
      setError("Keine Fotos zum Herunterladen.");
      return;
    }

    const zipUrl = `${API_BASE}/download/zip?challenge=${encodeURIComponent(
      categoryId
    )}&token=${encodeURIComponent(token)}`;
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
      setError(""); // Clear any previous errors
    } catch (err) {
      setError(`Löschen fehlgeschlagen: ${err.message}`);
    } finally {
      setDeleting(null);
    }
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
      setError(""); // Clear any previous errors
    } catch (err) {
      setError(`Löschen fehlgeschlagen: ${err.message}`);
      refreshPhotos();
    } finally {
      setDeleting(null);
    }
  }

  if (!authed) {
    return (
      <AdminLoginScreen
        token={token}
        setToken={setToken}
        loading={loading}
        error={error}
        onLogin={login}
      />
    );
  }

  // Group photos by challenge
  const grouped = {};
  const partyPhotos = [];
  for (const c of CHALLENGES) grouped[c.id] = [];
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

  // Show loading skeleton while fetching initially
  const isInitialLoad = photos.length === 0 && !error;

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
            onClick={() => {
              setConfirmInput("");
              setConfirmState({ kind: "all" });
            }}
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

      {/* Show loading skeleton on initial load */}
      {isInitialLoad ? (
        <>
          <AdminGallerySkeleton count={3} />
          <AdminGallerySkeleton count={4} />
        </>
      ) : (
        <>
          {/* Gallery by Challenge */}
          {CHALLENGES.map((c) => {
            const cPhotos = grouped[c.id] || [];
            if (cPhotos.length === 0) return null;

            return (
              <GallerySection
                key={c.id}
                title={c.title}
                emoji={c.emoji}
                photos={cPhotos}
                token={token}
                onPhotoClick={openFullSize}
                onDeletePhoto={(photo) =>
                  setConfirmState({ kind: "one", photo })
                }
                onDownloadZip={downloadZip}
                deleting={deleting}
              />
            );
          })}

          {/* Party Photos */}
          {partyPhotos.length > 0 && (
            <GallerySection
              title="Partyfotos"
              emoji="📸"
              photos={partyPhotos}
              token={token}
              onPhotoClick={openFullSize}
              onDeletePhoto={(photo) =>
                setConfirmState({ kind: "one", photo })
              }
              onDownloadZip={() => downloadZip("party")}
              deleting={deleting}
            />
          )}

          {photos.length === 0 && (
            <p className="text" style={{ textAlign: "center", marginTop: 40 }}>
              Noch keine Fotos hochgeladen.
            </p>
          )}
        </>
      )}

      {/* Fullscreen Viewer */}
      {viewer && (
        <ImageViewer
          viewer={viewer}
          onClose={() => setViewer(null)}
        />
      )}

      {/* Confirm Dialog */}
      {confirmState && (
        <ConfirmDialog
          title={
            confirmState.kind === "all"
              ? "Alle Fotos löschen?"
              : "Foto löschen?"
          }
          message={
            confirmState.kind === "all"
              ? `Du bist im Begriff, ${photos.length} Fotos unwiderruflich zu löschen.`
              : `"${
                  confirmState.photo.name ||
                  confirmState.photo.key.split("/").pop()
                }" wird unwiderruflich gelöscht.`
          }
          confirmText={confirmState.kind === "all" ? "LÖSCHEN" : null}
          confirmInput={confirmInput}
          onConfirmInput={setConfirmInput}
          onCancel={() => {
            setConfirmState(null);
            setConfirmInput("");
          }}
          onConfirm={() => {
            const action =
              confirmState.kind === "all"
                ? deleteAll
                : () => deletePhoto(confirmState.photo);
            setConfirmState(null);
            setConfirmInput("");
            action();
          }}
        />
      )}
    </div>
  );
}
