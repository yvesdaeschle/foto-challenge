import React from "react";

export function AdminGallerySkeleton({ count = 6 }) {
  return (
    <section className="admin-section">
      <div className="admin-section-header">
        <h2 className="skeleton" style={{ width: "200px", height: "24px" }} />
      </div>
      <div className="gallery-grid">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="gallery-item skeleton gallery-skeleton-item" />
        ))}
      </div>
    </section>
  );
}
