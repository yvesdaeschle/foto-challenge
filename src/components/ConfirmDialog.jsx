import React, { useEffect } from "react";
import { Trash2 } from "lucide-react";

export function ConfirmDialog({
  title,
  message,
  confirmText,
  confirmInput,
  onConfirmInput,
  onCancel,
  onConfirm,
}) {
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
    <div
      className="modal"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
    >
      <div
        className="modal-box slide-up confirm-box"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="confirm-title" className="confirm-title">
          {title}
        </h3>
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
          aria-label={requiresTyping ? `Löschen (bestätigt)` : "Löschen"}
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
