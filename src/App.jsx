import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Camera,
  Check,
  Download,
  Image as ImageIcon,
  Lock,
  PartyPopper,
  RefreshCcw,
  Sparkles,
  Sun,
  Upload,
  Users,
  X
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

const challenges = [
  {
    id: "new-faces",
    icon: Users,
    emoji: "🆕",
    title: "New Faces",
    description: "Macht ein Foto mit jemandem, den ihr heute neu kennengelernt habt."
  },
  {
    id: "detail-love",
    icon: Sparkles,
    emoji: "✨",
    title: "Detail Love",
    description: "Fotografiert ein schönes Party-Detail."
  },
  {
    id: "small-chaos",
    icon: PartyPopper,
    emoji: "🎭",
    title: "Small Chaos",
    description: "Gruppenfoto: Alle machen gleichzeitig etwas anderes."
  },
  {
    id: "hands-only",
    icon: Users,
    emoji: "🤝",
    title: "Hands Only",
    description: "Nur Hände im Bild."
  },
  {
    id: "golden-hour",
    icon: Sun,
    emoji: "🌅",
    title: "Golden Hour",
    description: "Das Licht ist perfekt – ihr auch."
  }
];

function getRoute() {
  const path = window.location.pathname.toLowerCase();
  if (path.includes("admin")) return "admin";
  return "home";
}

export default function App() {
  const [route, setRoute] = useState(getRoute());

  useEffect(() => {
    const onPop = () => setRoute(getRoute());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  return route === "admin" ? <AdminGallery /> : <ChallengeHome />;
}

function ChallengeHome() {
  const [done, setDone] = useState({});
  const [active, setActive] = useState(null);

  useEffect(() => {
    const saved = localStorage.getItem("progress");
    if (saved) setDone(JSON.parse(saved));
  }, []);

  useEffect(() => {
    localStorage.setItem("progress", JSON.stringify(done));
  }, [done]);

  const completed = Object.values(done).filter(Boolean).length;
  const progress = Math.round((completed / challenges.length) * 100);

  return (
    <div className="page-shell">
      <h1>Foto Challenge</h1>

      <p>{completed} / {challenges.length} erledigt ({progress}%)</p>

      {challenges.map(c => (
        <div key={c.id} className="challenge-card">
          <h3>{c.emoji} {c.title}</h3>
          <p>{c.description}</p>

          <button onClick={() => setActive(c)}>
            <Camera size={16}/> Foto
          </button>

          <button onClick={() =>
            setDone(d => ({ ...d, [c.id]: true }))
          }>
            <Check size={16}/> Done
          </button>
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
    </div>
  );
}

function UploadModal({ challenge, onClose, onSuccess }) {
  const inputRef = useRef();
  const [file, setFile] = useState(null);
  const [error, setError] = useState("");

  function onFileChange(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      setError("Nur Bilder erlaubt");
      return;
    }
    setFile(f);
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
      <button onClick={onClose}><X /></button>

      <h2>{challenge.title}</h2>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={onFileChange}
      />

      {error && <p>{error}</p>}

      <button onClick={upload}>
        <Upload /> Upload
      </button>
    </div>
  );
}

function AdminGallery() {
  const [token, setToken] = useState("");
  const [photos, setPhotos] = useState([]);

  async function load() {
    const res = await fetch(`${API_BASE}/photos`, {
      headers: { "x-admin-token": token }
    });

    const data = await res.json();
    setPhotos(data.photos || []);
  }

  return (
    <div>
      <h1>Admin</h1>

      <input
        placeholder="Token"
        value={token}
        onChange={e => setToken(e.target.value)}
      />

      <button onClick={load}>
        <RefreshCcw /> Laden
      </button>

      {photos.map(p => (
        <div key={p.key}>
          <p>{p.challengeId}</p>
          <button onClick={async () => {
            const res = await fetch(`${API_BASE}/photo/${p.key}`, {
              headers: { "x-admin-token": token }
            });

            const blob = await res.blob();
            const url = URL.createObjectURL(blob);

            const a = document.createElement("a");
            a.href = url;
            a.download = "photo.jpg";
            a.click();
          }}>
            <Download /> Download
          </button>
        </div>
      ))}
    </div>
  );
}
``