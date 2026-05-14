import React, { useRef, useEffect, useState } from "react";
import { Camera, Check, ImageIcon as Image, X, Loader, RefreshCw } from "lucide-react";
import { API_BASE, IMAGE_SIZE } from "../constants.js";
import { processImage, generateIdempotencyKey, createPreview } from "../utils/imageProcessing.js";

export function UploadModal({
  challenge,
  onClose,
  onSuccess,
  userName,
  existingIdempotencyKey,
}) {
  const cameraRef = useRef();
  const galleryRef = useRef();
  const modalRef = useRef(null);
  const xhrRef = useRef(null);

  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [preview, setPreview] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [error, setError] = useState(null);

  const idempotencyKeyRef = useRef(existingIdempotencyKey || null);

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
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [uploading, onClose, preview]);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Bitte nur Bilder hochladen.");
      return;
    }

    if (preview) URL.revokeObjectURL(preview);
    const previewUrl = await createPreview(file);
    setPreview(previewUrl);
    setSelectedFile(file);
    setError(null);
  }

  async function confirmUpload() {
    if (!selectedFile) return;
    setError(null);

    const maxClientMb = IMAGE_SIZE.maxClientUploadMB;
    if (selectedFile.size > maxClientMb * 1024 * 1024) {
      setError(
        `Bild ist zu groß (${Math.round(
          selectedFile.size / 1024 / 1024
        )} MB). Maximal ${maxClientMb} MB. Versuche, das Bild zu komprimieren oder zuzuschneiden.`
      );
      return;
    }

    setUploading(true);
    setProcessing(true);
    setUploadProgress(0);

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

      idempotencyKeyRef.current = null;

      let thumbDataUrl = null;
      try {
        thumbDataUrl = await new Promise((res, rej) => {
          const r = new FileReader();
          r.onload = () => res(r.result);
          r.onerror = () => rej(r.error);
          r.readAsDataURL(thumb);
        });
      } catch {
        /* non-fatal */
      }

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
    <div
      className="modal"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="upload-modal-title"
    >
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
                    <span className="upload-progress-label" aria-live="polite">
                      {uploadProgress < 100
                        ? `Wird hochgeladen… ${uploadProgress}%`
                        : "Wird gespeichert…"}
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
              aria-label="Foto mit Kamera aufnehmen"
            />
            <input
              ref={galleryRef}
              type="file"
              accept="image/*"
              onChange={handleFile}
              style={{ display: "none" }}
              aria-label="Foto aus Galerie wählen"
            />

            <button className="btn-full btn-primary" onClick={() => cameraRef.current.click()}>
              <Camera size={20} /> Foto aufnehmen
            </button>
            <button className="btn-full secondary" onClick={() => galleryRef.current.click()}>
              <Image size={18} /> Aus Galerie wählen
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
