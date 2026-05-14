import React, { useRef, useEffect, useState, useCallback } from "react";
import { Camera, PartyPopper, Images } from "lucide-react";
import { CHALLENGES } from "../constants.js";
import { useProgress, useUserName, useToast } from "../hooks/useStorage.js";
import { Celebration } from "./Celebration.jsx";
import { Toast } from "./Toast.jsx";
import { ResetTitle } from "./ResetTitle.jsx";
import { UploadModal } from "./UploadModal.jsx";
import { PartyUploadModal } from "./PartyUploadModal.jsx";

function NameEntryScreen({ userName, setUserName, onConfirmName }) {
  return (
    <main className="container">
      <p className="event-title">12&nbsp;½&nbsp;Jahre Adams&nbsp;Family</p>

      <section className="hero fade-in">
        <h1>
          5&nbsp;Momente.
          <br />
          Ein&nbsp;Abend.
          <br />
          Eure&nbsp;Erinnerungen.
        </h1>
        <p className="sub">Foto‑Challenge für Arienne&nbsp;&amp;&nbsp;Andy</p>
        <p className="text">
          Sammle spontane Augenblicke, echte Begegnungen und kleine Details – ganz ohne
          Druck.
        </p>
      </section>

      <section className="name-section fade-in" style={{ animationDelay: "0.1s" }}>
        <label className="name-label" htmlFor="userName">
          Wie heißt du?
        </label>
        <p className="name-hint">
          Dein Name erscheint auf deinen Fotos, damit Arienne &amp; Andy wissen, von wem
          sie sind.
        </p>
        <input
          id="userName"
          className="name-input"
          type="text"
          placeholder="Dein Name"
          value={userName}
          onChange={(e) => setUserName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onConfirmName()}
          maxLength={40}
          autoFocus
          autoComplete="off"
        />
        <button
          className="btn-full btn-primary"
          onClick={onConfirmName}
          disabled={!userName.trim()}
        >
          Los geht's!
        </button>
      </section>

      <footer className="credit">Made with ♥ by Yves</footer>
    </main>
  );
}

function ChallengeCard({ challenge, isDone, thumbUrl, onUpload }) {
  return (
    <div
      className={`card fade-in-up ${isDone ? "card--done" : ""}`}
      style={{ animationDelay: "0.15s" }}
    >
      <div className="card-header">
        {thumbUrl ? (
          <img src={thumbUrl} alt="" className="card-own-thumb" />
        ) : (
          <span className="card-emoji">{challenge.emoji}</span>
        )}
        <h2>{challenge.title}</h2>
        {isDone && <span className="card-check">✓</span>}
      </div>
      <p>{challenge.desc}</p>
      <small>{challenge.detail}</small>
      <div className="actions">
        <button onClick={onUpload}>
          <Camera size={18} /> {isDone ? "Foto ersetzen" : "Foto aufnehmen"}
        </button>
      </div>
    </div>
  );
}

export function HomePage() {
  const [done, setDone] = useProgress();
  const { userName, setUserName, nameConfirmed, confirmName, resetName } = useUserName();
  const [toast, showToast] = useToast();

  const [active, setActive] = useState(null);
  const [partyUploadOpen, setPartyUploadOpen] = useState(false);
  const [confettiKey, setConfettiKey] = useState(0);

  const confettiTimer = useRef(null);

  useEffect(() => {
    return () => {
      if (confettiTimer.current) clearTimeout(confettiTimer.current);
    };
  }, []);

  // Debug trigger: visiting with ?celebrate=1 fires animation on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("celebrate") === "1") {
      setConfettiKey(1);
      if (confettiTimer.current) clearTimeout(confettiTimer.current);
      confettiTimer.current = setTimeout(() => setConfettiKey(0), 3700);
    }
  }, []);

  const handleUploadSuccess = useCallback(
    (challengeId, thumbDataUrl, idempotencyKey) => {
      // Haptic feedback on mobile
      if (navigator.vibrate) navigator.vibrate(50);

      setDone((d) => {
        const wasAllDone = CHALLENGES.every((c) => d[c.id]);
        const next = {
          ...d,
          [challengeId]: {
            done: true,
            thumb: thumbDataUrl || null,
            idempotencyKey: idempotencyKey || null,
          },
        };
        const isAllDone = CHALLENGES.every((c) => next[c.id]);

        // Only celebrate on transition to all-5, not on every replace upload
        if (isAllDone && !wasAllDone) {
          if (confettiTimer.current) clearTimeout(confettiTimer.current);
          setConfettiKey((k) => k + 1);
          confettiTimer.current = setTimeout(() => setConfettiKey(0), 3700);
        }
        return next;
      });
      setActive(null);
      showToast("Foto hochgeladen!");
    },
    [setDone, showToast]
  );

  function handleReset() {
    setDone({});
    resetName();
    showToast("Progress zurückgesetzt");
  }

  const completed = Object.values(done).filter(Boolean).length;

  if (!nameConfirmed) {
    return (
      <NameEntryScreen
        userName={userName}
        setUserName={setUserName}
        onConfirmName={() => {
          if (!confirmName(userName)) {
            showToast("Fehler beim Speichern des Namens", 2000);
          }
        }}
      />
    );
  }

  return (
    <main className="container">
      {confettiKey > 0 && <Celebration key={confettiKey} />}
      <Toast message={toast} visible={!!toast} />

      <ResetTitle onReset={handleReset} />

      <section className="hero fade-in">
        <h1>
          5&nbsp;Momente.
          <br />
          Ein&nbsp;Abend.
          <br />
          Eure&nbsp;Erinnerungen.
        </h1>
        <p className="sub">Foto‑Challenge für Arienne&nbsp;&amp;&nbsp;Andy</p>
        <p className="text">
          Sammle spontane Augenblicke, echte Begegnungen und kleine Details – ganz ohne
          Druck.
        </p>
      </section>

      <section className="steps fade-in" style={{ animationDelay: "0.1s" }}>
        <p className="steps-heading">So einfach geht's:</p>
        <ol className="steps-list">
          <li>Erledige die 5 Foto‑Challenges</li>
          <li>Lade deine Bilder direkt hier hoch</li>
        </ol>
        <p className="hint">👉 Es gibt kein „richtig" oder „falsch" – nur schöne Momente.</p>
      </section>

      <div className="progress-bar-wrap fade-in" style={{ animationDelay: "0.2s" }}>
        <div className="progress-bar" style={{ width: `${(completed / 5) * 100}%` }} />
        <span className="progress-label">
          {completed === 5 ? "🎉 Alle geschafft!" : `${completed} / 5 erledigt`}
        </span>
      </div>

      {CHALLENGES.map((c, i) => {
        const entry = done[c.id];
        const isDone = Boolean(entry);
        const thumbUrl = typeof entry === "object" && entry ? entry.thumb : null;

        return (
          <div
            key={c.id}
            className={`card fade-in-up ${isDone ? "card--done" : ""}`}
            style={{ animationDelay: `${0.15 + i * 0.07}s` }}
          >
            <ChallengeCard
              challenge={c}
              isDone={isDone}
              thumbUrl={thumbUrl}
              onUpload={() => setActive(c)}
            />
          </div>
        );
      })}

      {completed === 5 && (
        <div className="completed-msg fade-in">
          <PartyPopper size={28} />
          <p>
            Du hast alle Challenges gemeistert!
            <br />
            Danke für deine tollen Momente.
          </p>
        </div>
      )}

      {active && (
        <UploadModal
          challenge={active}
          onClose={() => setActive(null)}
          onSuccess={handleUploadSuccess}
          userName={userName}
          existingIdempotencyKey={
            (done[active.id] &&
              typeof done[active.id] === "object" &&
              done[active.id].idempotencyKey) ||
            null
          }
        />
      )}

      <div className="party-upload-section fade-in" style={{ animationDelay: "0.5s" }}>
        <p className="party-upload-text">
          Noch mehr Schnappschüsse? Lade hier deine Partyfotos hoch!
        </p>
        <button className="btn-full secondary" onClick={() => setPartyUploadOpen(true)}>
          <Images size={18} /> Weitere Partyfotos
        </button>
      </div>

      {partyUploadOpen && (
        <PartyUploadModal
          onClose={() => setPartyUploadOpen(false)}
          onSuccess={() => showToast("Fotos hochgeladen!")}
          userName={userName}
        />
      )}

      <footer className="credit">Made with ♥ by Yves</footer>
    </main>
  );
}
