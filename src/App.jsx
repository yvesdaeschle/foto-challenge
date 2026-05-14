import React from "react";
import { HomePage } from "./components/HomePage.jsx";
import { AdminPage } from "./components/AdminPage.jsx";
import { LandingRedirect } from "./components/LandingRedirect.jsx";

// ================================================================
// ROUTING
// ================================================================
function getRoute() {
  const path = window.location.pathname.replace(/\/+$/, "");
  if (path === "/admin") return "admin";
  if (path === "/125") return "home";
  return "landing";
}

// ================================================================
// ERROR BOUNDARY
// ================================================================
class ErrorBoundary extends React.Component {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="container" style={{ textAlign: "center", paddingTop: 80 }}>
          <p style={{ fontSize: 48 }}>😕</p>
          <p style={{ fontSize: 18, fontWeight: 600, margin: "16px 0" }}>
            Etwas ist schiefgelaufen.
          </p>
          <button
            className="btn-full btn-primary"
            onClick={() => window.location.reload()}
          >
            Seite neu laden
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ================================================================
// APP — Main routing and error boundary
// ================================================================
export default function App() {
  const route = getRoute();
  return (
    <ErrorBoundary>
      {route === "admin" ? (
        <AdminPage />
      ) : route === "home" ? (
        <HomePage />
      ) : (
        <LandingRedirect />
      )}
    </ErrorBoundary>
  );
}
