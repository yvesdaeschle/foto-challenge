import React, { useState } from "react";

export function Celebration() {
  const [pieces] = useState(() => {
    const colors = [
      "#F4B324", "#ff6b6b", "#4ecdc4", "#45b7d1", "#ff9ff3",
      "#a29bfe", "#55efc4", "#fab1a0", "#fd79a8", "#e17055"
    ];
    return Array.from({ length: 40 }, (_, i) => ({
      id: i,
      color: colors[i % colors.length],
      left: Math.random() * 100,
      size: 6 + Math.random() * 8,
      dur: 2.2 + Math.random() * 1.2, // 2.2–3.4s
      delay: Math.random() * 0.4,     // 0–0.4s
      shape: i % 3, // 0=rect, 1=circle, 2=strip
      rotEnd: 360 + Math.floor(Math.random() * 720) * (i % 2 ? 1 : -1),
    }));
  });

  return (
    <div className="celebration-overlay">
      <div className="celebration-content">
        <span className="celebration-emoji" role="img" aria-label="Konfetti">
          🎉
        </span>
        <p className="celebration-text">Geschafft!</p>
      </div>
      {pieces.map((p) => (
        <span
          key={p.id}
          className={`confetti-piece confetti-shape-${p.shape}`}
          style={{
            left: `${p.left.toFixed(1)}%`,
            width:
              p.shape === 2 ? `${(p.size * 0.4).toFixed(0)}px` : `${p.size.toFixed(0)}px`,
            height:
              p.shape === 2 ? `${(p.size * 2.5).toFixed(0)}px` : `${p.size.toFixed(0)}px`,
            background: p.color,
            "--rot-end": `${p.rotEnd}deg`,
            animationDuration: `${p.dur.toFixed(2)}s`,
            animationDelay: `${p.delay.toFixed(2)}s`,
            WebkitAnimationDuration: `${p.dur.toFixed(2)}s`,
            WebkitAnimationDelay: `${p.delay.toFixed(2)}s`,
          }}
        />
      ))}
    </div>
  );
}
