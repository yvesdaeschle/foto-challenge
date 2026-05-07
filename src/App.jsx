import React, { useEffect, useRef, useState } from "react";
import { Camera, Check, Upload, Image as ImageIcon, Download } from "lucide-react";

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
    desc: "Macht ein Foto mit jemandem, den ihr heute neu kennengelernt habt."
  },
  {
    id: "detail-love",
    emoji: "✨",
    title: "Detail Love",
    desc: "Fotografiert ein schönes Party‑Detail."
  },
  {
    id: "small-chaos",
    emoji: "🎭",
    title: "Small Chaos",
    desc: "Gruppenfoto mit Chaos 😄"
  },
  {
    id: "hands-only",
    emoji: "🤝",
    title: "Hands Only",
    desc: "Nur Hände im Bild."
  },
  {
    id: "golden-hour",
    emoji: "🌅",
    title: "Golden Hour",
    desc: "Perfektes Licht."
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

      <h1>Foto Challenge</h1>
      <p>{completed} / 5 erledigt</p>

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
// 🟢 UPLOAD (KAMERA + GALERIE)
// ------------------------------------------------
function UploadModal({ challenge, onClose, onSuccess }) {

  const cameraRef = useRef();
  const galleryRef = useRef();
  const [file, setFile] = useState(null);

  function handleFile(e) {
    const f = e.target.files?.[0];
    if (f) setFile(f);
  }

  function openCamera() {
    cameraRef.current.click();
  }

  function openGallery() {
    galleryRef.current.click();
  }

  async function upload() {
    if (!file) return;

    const form = new FormData();
    form.append("photo", file);
    form.append("challengeId", challenge.id);

    await fetch(`${API_BASE}/upload`, {
      method: "POST",
      body: form
    });

    onSuccess();
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

        <button onClick={openCamera}>
          <Camera /> Kamera öffnen
        </button>

        <button onClick={openGallery} className="secondary">
          <ImageIcon /> Galerie wählen
        </button>

        {file && <p>✅ Bild gewählt</p>}

        <button onClick={upload}>
          <Upload /> Upload
        </button>

        <button onClick={onClose} className="secondary">
          Schließen
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