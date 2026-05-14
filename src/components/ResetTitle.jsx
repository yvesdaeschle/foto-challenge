import React, { useRef, useEffect } from "react";
import { RESET_TRIGGER } from "../constants.js";

export function ResetTitle({ onReset }) {
  const taps = useRef(0);
  const timer = useRef(null);

  function handleTap() {
    taps.current++;
    if (timer.current) clearTimeout(timer.current);
    if (taps.current >= RESET_TRIGGER.taps) {
      taps.current = 0;
      onReset();
      return;
    }
    timer.current = setTimeout(() => {
      taps.current = 0;
    }, RESET_TRIGGER.windowMs);
  }

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  return (
    <p className="event-title" onClick={handleTap} style={{ cursor: "default" }}>
      12&nbsp;½&nbsp;Jahre Adams&nbsp;Family
    </p>
  );
}
