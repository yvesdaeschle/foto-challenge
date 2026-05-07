import React, { useEffect, useRef, useState } from "react";
import { Camera, Check, Upload } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

// ------------------- ROUTING -------------------
function getRoute() {
  return window.location.pathname.includes("admin")
    ? "admin"
    : "home";
}

// ------------------- CHALLENGES -------------------
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

// ------------------- APP -------------------
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
      .then(d => setUploads(d.grouped || {}))
      .catch(() => {});
  }, []);

  const completed = Object.values(done).filter(Boolean).length;

  return (
    <main className="container">

      {/* HERO */}
      <section className="hero">
        <h1>
          5 Momente.<br/>
          Ein Abend.<br/>
          Eure Erinnerungen.
        </h1>

        <p className="sub">Willkommen zur Foto‑Challenge!</p>

        <p className="text">
          Sammelt spontane Augenblicke, echte Begegnungen und kleine Details –
          ganz ohne Druck.
        </p>
      </section>

      {/* STEPS */}
      <section className="steps">
        <p>📱 QR-Code scannen</p>
        <p>✅ 5 Challenges machen</p>
        <p>📸 Fotos hochladen</p>
        <p className="hint">
          👉 Kein „richtig“ oder „falsch“
        </p>
      </section>

      {/* PROGRESS */}
      <div className="progress">
        {completed} / 5 erledigt
      </div>

      {/* CHALLENGES */}
      {challenges.map(c => (
        <div key={c.id} className="card">

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
              {done[c.id] ? "Erledigt" : "Done"}
            </button>
          </div>

        </div>
      ))}

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
// 🟢 UPLOAD
// ------------------------------------------------
function UploadModal({ challenge, onClose, onSuccess }) {

  const inputRef = useRef();
  const [file, setFile] = useState(null);

  function handleFile(e) {
    const f = e.target.files?.[0];
    if (f) setFile(f);
  }

  async function upload() {
    if (!file) return;

    const form = new FormData();
    form.append("photo", file);
    form.append("challengeId", challenge.id);
    form.append("challengeTitle", challenge.title);

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

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFile}
        />

        <button onClick={upload}>
          <Upload size={16}/> Upload
        </button>

        <button onClick={onClose} className="secondary">
          Schließen
        </button>

      </div>
    </div>
  );
}

// ------------------------------------------------
// 🔴 ADMIN
// ------------------------------------------------
function AdminPage() {

  const [token, setToken] = useState("");
  const [photos, setPhotos] = useState([]);
  const [error, setError] = useState("");

  async function load() {
    setError("");

    try {
      const res = await fetch(`${API_BASE}/photos`, {
        headers: { "x-admin-token": token }
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Fehler");
        return;
      }

      setPhotos(data.photos || []);

    } catch {
      setError("Verbindung fehlgeschlagen");
    }
  }

  return (
    <div className="admin">

      <h1>Admin Galerie</h1>

      <input
        placeholder="Admin Token"
        value={token}
        onChange={e => setToken(e.target.value)}
      />

      <button onClick={load}>Bilder laden</button>

      {error && <p className="error">{error}</p>}

      <div className="gallery">
        {photos.map(p => (
          <img
            key={p.key}
            src={`${API_BASE}/photo/${encodeURIComponent(p.key)}`}
            alt=""
          />
        ))}
      </div>

    </div>
  );
}
