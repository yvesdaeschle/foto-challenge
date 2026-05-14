import React, { useRef, useEffect, useState } from "react";
import { Check, ImageIcon as Image, X, Loader } from "lucide-react";
import { API_BASE, IMAGE_SIZE } from "../constants.js";
import { processImage, generateIdempotencyKey } from "../utils/imageProcessing.js";

const MAX_PARTY_UPLOAD_FILES = 20;

export function PartyUploadModal({ onClose, onSuccess, userName }) {
  const fileRef = useRef();
  const modalRef = useRef(null);
  const xhrRef = useRef(null);

  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadIndex, setUploadIndex] = useState(0);
  const [uploadTotal, setUploadTotal] = useState(0);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);

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
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", handleKeyDown);
      if (xhrRef.current) xhrRef.current.abort();
    };
  }, [uploading, onClose]);

  function handleFiles(e) {
    const selected = Array.from(e.target.files || []);
    const images = selected.filter((f) => f.type.startsWith("image/"));

    if (images.length === 0) {
      setError("Bitte nur Bilder auswählen.");
      return;
    }

    const limited = images.slice(0, MAX_PARTY_UPLOAD_FILES);
    const msgs = [];

    if (images.length < selected.length) {
      msgs.push(`${selected.length - images.length} Datei(en) übersprungen (keine Bilder).`);
    }
    if (images.length > MAX_PARTY_UPLOAD_FILES) {
      msgs.push(
        `Maximal ${MAX_PARTY_UPLOAD_FILES} Fotos auf einmal – nur die ersten ${MAX_PARTY_UPLOAD_FILES} wurden übernommen.`
      );
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
      if (file.size > IMAGE_SIZE.maxClientUploadMB * 1024 * 1024) {
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
              try {
                const data = JSON.parse(xhr.responseText);
                if (data.error) msg = data.error;
              } catch {
                /* ignore */
              }
              reject(new Error(msg));
            }
          };
          xhr.onerror = () => {
            xhrRef.current = null;
            reject(new Error("Netzwerkfehler. Überprüfe deine Internetverbindung."));
          };
          xhr.onabort = () => {
            xhrRef.current = null;
            reject(new Error("Abgebrochen"));
          };
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
    <div
      className="modal"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="party-modal-title"
    >
      <div className="modal-box slide-up" ref={modalRef} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 id="party-modal-title">📸 Partyfotos</h3>
          {!uploading && (
            <button className="btn-icon" onClick={handleClose} aria-label="Schließen">
              <X size={20} />
            </button>
          )}
        </div>

        <p className="modal-desc">
          Lade deine schönsten Partyfotos hoch – du kannst bis zu {MAX_PARTY_UPLOAD_FILES}{" "}
          auf einmal auswählen.
        </p>

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
                <span>
                  Bild {uploadIndex + 1} von {uploadTotal} wird vorbereitet…
                </span>
              </>
            ) : (
              <div className="upload-progress">
                <div className="upload-progress-bar-wrap">
                  <div className="upload-progress-bar" style={{ width: `${uploadProgress}%` }} />
                </div>
                <span className="upload-progress-label" aria-live="polite">
                  Bild {uploadIndex + 1} von {uploadTotal} –{" "}
                  {uploadProgress < 100 ? `${uploadProgress}%` : "Wird gespeichert…"}
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
              aria-label="Mehrere Fotos aus Galerie wählen"
            />

            {files.length > 0 ? (
              <>
                <p className="party-count">
                  {files.length} Foto{files.length !== 1 ? "s" : ""} ausgewählt
                </p>
                <button className="btn-full btn-primary" onClick={uploadAll}>
                  <Check size={18} /> {files.length} Foto{files.length !== 1 ? "s" : ""}{" "}
                  hochladen
                </button>
                <button className="btn-full secondary" onClick={() => fileRef.current.click()}>
                  Andere Fotos wählen
                </button>
              </>
            ) : (
              <button className="btn-full btn-primary" onClick={() => fileRef.current.click()}>
                <Image size={18} /> Fotos aus Galerie wählen
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
