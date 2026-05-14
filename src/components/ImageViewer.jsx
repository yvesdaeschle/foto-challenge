import React, { useRef, useEffect, useState } from "react";
import { X, Download, Loader } from "lucide-react";

export function ImageViewer({ viewer, onClose }) {
  const [blobUrl, setBlobUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const blobRef = useRef(null);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(viewer.url, {
          headers: { "x-admin-token": viewer.token },
        });
        if (!res.ok) throw new Error("Load failed");
        const blob = await res.blob();
        if (!cancelled) {
          const url = URL.createObjectURL(blob);
          blobRef.current = url;
          setBlobUrl(url);
          setLoading(false);
        }
      } catch (e) {
        if (!cancelled) {
          setLoading(false);
          setLoadFailed(true);
        }
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
          <button
            className="btn-icon viewer-btn"
            onClick={onClose}
            aria-label="Schließen"
          >
            <X size={22} />
          </button>
          <button
            className="btn-icon viewer-btn"
            onClick={downloadPhoto}
            aria-label="Herunterladen"
            disabled={!blobUrl}
          >
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
            <p>{loadFailed ? "Bild konnte nicht geladen werden." : "Laden fehlgeschlagen"}</p>
          </div>
        )}
      </div>
    </div>
  );
}
