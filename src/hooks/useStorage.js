import { useState, useEffect, useCallback } from "react";
import { STORAGE_KEYS } from "../constants.js";

/**
 * Manage challenge progress in localStorage with error handling
 */
export function useProgress() {
  const [done, setDone] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.progress) || "{}");
    } catch (e) {
      console.warn("Failed to load progress from localStorage:", e.message);
      return {};
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.progress, JSON.stringify(done));
    } catch (e) {
      // localStorage may be full or unavailable (private browsing)
      if (e.name === "QuotaExceededError") {
        console.warn("localStorage quota exceeded, progress may not be saved");
      } else {
        console.warn("Failed to save progress:", e.message);
      }
    }
  }, [done]);

  return [done, setDone];
}

/**
 * Manage user name with localStorage persistence
 */
export function useUserName() {
  const [userName, setUserName] = useState(() => localStorage.getItem(STORAGE_KEYS.userName) || "");
  const [nameConfirmed, setNameConfirmed] = useState(() => Boolean(localStorage.getItem(STORAGE_KEYS.userName)));

  const confirmName = useCallback((name) => {
    const trimmed = name.trim();
    if (!trimmed) return false;
    try {
      localStorage.setItem(STORAGE_KEYS.userName, trimmed);
      setUserName(trimmed);
      setNameConfirmed(true);
      return true;
    } catch (e) {
      console.warn("Failed to save user name:", e.message);
      return false;
    }
  }, []);

  const resetName = useCallback(() => {
    setUserName("");
    setNameConfirmed(false);
    try {
      localStorage.removeItem(STORAGE_KEYS.userName);
      localStorage.removeItem(STORAGE_KEYS.progress);
    } catch (e) {
      console.warn("Failed to clear storage:", e.message);
    }
  }, []);

  return { userName, setUserName, nameConfirmed, confirmName, resetName };
}

/**
 * Toast notification state
 */
export function useToast() {
  const [toast, setToast] = useState(null);

  const showToast = useCallback((message, durationMs = 3000) => {
    setToast(message);
    const timer = setTimeout(() => setToast(null), durationMs);
    return () => clearTimeout(timer);
  }, []);

  return [toast, showToast];
}
