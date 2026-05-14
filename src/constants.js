// Challenges configuration - Single source of truth
export const CHALLENGES = [
  {
    id: "01-new-faces",
    emoji: "🆕",
    title: "New Faces",
    desc: "Macht ein Foto mit jemandem, den ihr heute neu kennengelernt habt.",
    detail: "Ein kurzer Moment, ein neues Gesicht, schöne Gespräche.",
  },
  {
    id: "02-detail-love",
    emoji: "✨",
    title: "Detail Love",
    desc: "Fotografiert ein schönes Party‑Detail.",
    detail: "Deko, Drinks, Essen, Licht, Blumen – die kleinen Dinge machen den Abend besonders.",
  },
  {
    id: "03-small-chaos",
    emoji: "🎭",
    title: "Small Chaos",
    desc: "Gruppenfoto: Alle machen gleichzeitig etwas anderes.",
    detail: "Lachen, reden, tanzen, schauen, winken. Perfektion verboten – Chaos erlaubt.",
  },
  {
    id: "04-hands-only",
    emoji: "🤝",
    title: "Hands Only",
    desc: "Nur Hände im Bild.",
    detail: "Hands‑up, Handschlag, Kaffeebecher...",
  },
  {
    id: "05-golden-hour",
    emoji: "🌅",
    title: "Golden Hour",
    desc: "Das Licht ist perfekt – ihr auch.",
    detail: "Schnappt euch den Moment kurz vor Sonnenuntergang oder unter Lichterketten ;)",
  },
];

export const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

export const IMAGE_QUALITY = {
  original: 0.92,  // High quality for full-size images
  thumbnail: 0.55, // Lower quality for faster loading
};

export const IMAGE_SIZE = {
  maxOriginal: 3200,  // Max dimension for original
  maxThumbnail: 200,  // Max dimension for thumbnail
  maxClientUploadMB: 25, // Client-side size check before processing
};

export const STORAGE_KEYS = {
  progress: "progress",
  userName: "userName",
};

export const RESET_TRIGGER = {
  taps: 5,
  windowMs: 1500, // Time window in milliseconds
};
