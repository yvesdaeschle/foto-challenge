import React, { useRef, useEffect, useState } from "react";
import { Loader } from "lucide-react";

export function AuthImage({ src, token, alt, className, onClick }) {
  const [blobUrl, setBlobUrl] = useState(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const blobRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(src, { headers: { "x-admin-token": token } });
        if (!res.ok) throw new Error("Load failed");
        const blob = await res.blob();
        if (!cancelled) {
          const url = URL.createObjectURL(blob);
          blobRef.current = url;
          setBlobUrl(url);
          setLoading(false);
        }
      } catch (e) {
        if (!cancelled) {
          setFailed(true);
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
      if (blobRef.current) URL.revokeObjectURL(blobRef.current);
    };
  }, [src, token]);

  if (failed) return <div className="thumb-placeholder">⚠️</div>;
  if (loading) return <div className="thumb-placeholder"><Loader size={16} className="spin" /></div>;

  return (
    <img
      src={blobUrl}
      alt={alt}
      className={className}
      onClick={onClick}
      loading="lazy"
    />
  );
}
