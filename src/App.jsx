import React, { useEffect, useRef, useState } from "react";
import { Camera, Check, Image as ImageIcon, Download } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

// ---------------- ROUTING ----------------
function getRoute() {
  return window.location.pathname.includes("admin")
    ? "admin"
    : "home";
}

// ---------------- CHALLENGES ----------------
const challenges = [
  {
    id: "new-faces",
    emoji: "🆕",
    title: "New Faces",
    desc: "Macht ein Foto mit jemandem, den ihr heute neu kennengelernt habt.",
    detail: "Ein kurzer Moment, ein neues Gesicht, schöne Gespräche."
  },
  {
    id: "detail-love",
    emoji: "✨",
    title: "Detail Love",
    desc: "Fotografiert ein schönes Party‑Detail.",
    detail: "Deko, Drinks, Essen, Licht, Blumen."
  },
  {
    id: "small-chaos",
    emoji: "🎭",
    title: "Small Chaos",
    desc: "Gruppenfoto: Alle machen gleichzeitig etwas anderes.",
    detail: "Perfektion verboten – Chaos erlaubt."
  },
  {
    id: "hands-only",
    emoji: "🤝",
    title: "Hands Only",
    desc: "Nur Hände im Bild.",
    detail: "Hands‑up, Handschlag, Kaffeebecher."
  },
  {
    id: "golden-hour",
    emoji: "🌅",
    title: "Golden Hour",
    desc: "Das Licht ist perfekt – ihr auch.",
    detail: "Kurz vor Sonnenuntergang oder unter Lichterketten."
  }
];

// ---------------- APP ----------------
export default function App() {
  const route = getRoute();
  return route === "admin" ? <AdminPage /> : <HomePage />;
}

// ------------------------------------------------
// 🟡 HOME
// ------------------------------------------------
function HomePage() {

  const [done, setDone] = useState({});
  const [uploads, setUploads] = useState({});
  const [active, setActive] = useState(null);

  useEffect(() => {
    const saved = localStorage.getItem("progress");
    if (saved) setDone(JSON.parse(saved));
  }, []);

  useEffect(() => {
    localStorage.setItem("progress", JSON.stringify(done));
  }, [done]);

  useEffect(() => {
    fetch(`${API_BASE}/photos-by-challenge`)
      .then(r => r.json())
      .then(d => setUploads(d.grouped || {}));
  }, []);

  const completed = Object.values(done).filter(Boolean).length;

  return (
    <main className="container">

      {/* ✅ HERO wie gewünscht */}
      <section className="hero">
        <h1>
          5 Momente.<br/>
          Ein Abend.<br/>
          Eure Erinnerungen.
        </h1>

        <p className="sub">
          Willkommen zur Foto‑Challenge!
        </p>

        <p className="text">
          Sammelt spontane Augenblicke, echte Begegnungen und kleine Details –
          ganz ohne Druck.
        </p>
      </section>

      {/* STEPS */}
      <section className="steps">
        <p>📱 QR-Code scannen</p>
        <p>✅ 5 Challenges machen</p>
        <p>📸 Fotos aufnehmen</p>
        <p className="hint">
          👉 Kein „richtig“ oder „falsch“
        </p>
      </section>

      {/* PROGRESS */}
      <div className="progress">
        {completed} / 5 erledigt
      </div>

      {/* CHALLENGES */}
      {challenges.map(c => {

        const isDone = done[c.id];

        return (
          <div
            key={c.id}
            className="card"
            style={{
              border: isDone ? "3px solid #4CAF50" : "none",
              background: isDone ? "#f6fff7" : "white"
            }}
          >

            <h2>{c.emoji} {c.title}</h2>
            <p>{c.desc}</p>
            <small>{c.detail}</small>

            {uploads[c.id]?.length > 0 && (
              <p className="upload-info">
                📸 {uploads[c.id].length} Bilder
              </p>
            )}

            <div className="actions">

              <button onClick={() => setActive(c)}>
                <Camera size={16}/> Foto
              </button>

              <button
                className="secondary"
                onClick={() =>
                  setDone(d => ({ ...d, [c.id]: true }))
                }
              >
                <Check size={16}/>
                {isDone ? "Erledigt" : "Done"}
              </button>

            </div>

          </div>
        );
      })}

      {active && (
        <UploadModal
          challenge={active}
          onClose={() => setActive(null)}
          onSuccess={() => {
            setDone(d => ({ ...d, [active.id]: true }));
            setActive(null);
          }}
        />
      )}

    </main>
  );
}

// ------------------------------------------------
// 🟢 UPLOAD – ✅ AUTO UPLOAD (BEST UX)
// ------------------------------------------------
function UploadModal({ challenge, onClose, onSuccess }) {

  const cameraRef = useRef();
  const galleryRef = useRef();

  function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    upload(file);
  }

  async function upload(file) {
    const form = new FormData();
    form.append("photo", file);
    form.append("challengeId", challenge.id);

    await fetch(`${API_BASE}/upload`, {
      method: "POST",
      body: form
    });

    onSuccess();
  }

  function openCamera() {
    cameraRef.current.click();
  }

  function openGallery() {
    galleryRef.current.click();
  }

  return (
    <div className="modal">
      <div className="modal-box">

        <h3>{challenge.title}</h3>

        {/* Kamera */}
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFile}
          style={{ display: "none" }}
        />

        {/* Galerie */}
        <input
          ref={galleryRef}
          type="file"
          accept="image/*"
          onChange={handleFile}
          style={{ display: "none" }}
        />

        {/* ✅ KEIN Upload Button mehr */}
        <button onClick={openCamera}>
          <Camera /> Kamera öffnen
        </button>

        <button onClick={openGallery} className="secondary">
          <ImageIcon /> Galerie wählen
        </button>

        <button onClick={onClose} className="secondary">
          Abbrechen
        </button>

      </div>
    </div>
  );
}

// ------------------------------------------------
// 🔴 ADMIN (ZIP DOWNLOAD)
// ------------------------------------------------
function AdminPage() {

  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);

  async function downloadZip() {

    setLoading(true);

    const res = await fetch(`${API_BASE}/zip`, {
      headers: { "x-admin-token": token }
    });

    if (!res.ok) {
      alert("Falscher Token oder Fehler");
      setLoading(false);
      return;
    }

    const blob = await res.blob();

    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "foto-challenge.zip";
    a.click();

    setLoading(false);
  }

  return (
    <div className="admin">

      <h1>Admin Download</h1>

      <input
        placeholder="Admin Token"
        value={token}
        onChange={e => setToken(e.target.value)}
      />

      <button onClick={downloadZip}>
        {loading ? "Erstelle ZIP..." : "Alle Bilder als ZIP laden"}
      </button>

    </div>
  );
}