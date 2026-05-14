import React from "react";
import { Check } from "lucide-react";

export function Toast({ message, visible }) {
  return (
    <div
      className={`toast ${visible ? "toast--show" : ""}`}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <Check size={18} />
      {message}
    </div>
  );
}
