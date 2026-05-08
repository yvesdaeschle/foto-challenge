import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import App from "./App.jsx";

// Mock lucide-react icons
vi.mock("lucide-react", () => {
  const icon = (name) => {
    const Component = ({ size, className, ...props }) => <span data-testid={`icon-${name}`} {...props} />;
    Component.displayName = name;
    return Component;
  };
  return {
    Camera: icon("Camera"),
    Check: icon("Check"),
    Image: icon("Image"),
    Download: icon("Download"),
    Loader: icon("Loader"),
    PartyPopper: icon("PartyPopper"),
    X: icon("X"),
    RefreshCw: icon("RefreshCw"),
    ZoomIn: icon("ZoomIn"),
    Trash2: icon("Trash2"),
  };
});

function mockPathname(path) {
  delete window.location;
  window.location = { pathname: path };
}

beforeEach(() => {
  vi.resetAllMocks();
  global.fetch = vi.fn();
  localStorage.clear();
  document.body.style.overflow = "";

  // Mock canvas for confetti and image resizing
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    globalAlpha: 1,
    fillStyle: "",
    drawImage: vi.fn(),
  }));
  HTMLCanvasElement.prototype.toBlob = vi.fn(function (cb) {
    cb(new Blob(["fake"], { type: "image/jpeg" }));
  });

  // Mock Image constructor for processImage
  global.Image = class {
    constructor() {
      setTimeout(() => this.onload && this.onload(), 0);
    }
    set src(_) {}
    get width() { return 800; }
    get height() { return 600; }
  };

  // Mock createImageBitmap for EXIF-aware resizing
  global.createImageBitmap = vi.fn(() =>
    Promise.resolve({ width: 800, height: 600, close: vi.fn() })
  );

  // Mock window.confirm for delete confirmation
  global.confirm = vi.fn(() => true);
});

// ==================== ROUTING ====================

describe("Routing", () => {
  it("shows landing page on root path", () => {
    mockPathname("/");
    render(<App />);
    expect(screen.getByText(/Bitte scannt den QR\u2011Code/)).toBeInTheDocument();
  });

  it("shows Foto-Challenge heading on landing", () => {
    mockPathname("/");
    render(<App />);
    expect(screen.getByText("Foto\u2011Challenge")).toBeInTheDocument();
  });

  it("shows home page on /125", () => {
    mockPathname("/125");
    render(<App />);
    expect(screen.getByText(/Foto\u2011Challenge f\u00fcr Arienne/)).toBeInTheDocument();
  });

  it("shows admin login on /admin", () => {
    mockPathname("/admin");
    render(<App />);
    expect(screen.getByText("Admin")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Admin Token")).toBeInTheDocument();
  });

  it("shows landing for unknown paths", () => {
    mockPathname("/random");
    render(<App />);
    expect(screen.getByText(/Bitte scannt den QR\u2011Code/)).toBeInTheDocument();
  });

  it("handles trailing slash on /125/", () => {
    mockPathname("/125/");
    render(<App />);
    expect(screen.getByText(/Foto\u2011Challenge f\u00fcr Arienne/)).toBeInTheDocument();
  });
});

// ==================== HOME PAGE ====================

describe("HomePage", () => {
  beforeEach(() => {
    mockPathname("/125");
  });

function setNameAndProgress(progress) {
    localStorage.setItem("userName", "TestUser");
    if (progress) localStorage.setItem("progress", JSON.stringify(progress));
  }

  it("shows name input when no name saved", () => {
    render(<App />);
    expect(screen.getByText("Wie heißt du?")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Dein Name")).toBeInTheDocument();
  });

  it("renders event title", () => {
    setNameAndProgress();
    render(<App />);
    expect(screen.getByText(/12\s*½\s*Jahre Adams\s*Family/)).toBeInTheDocument();
  });

  it("renders all 5 challenges", () => {
    setNameAndProgress();
    render(<App />);
    expect(screen.getByText("New Faces")).toBeInTheDocument();
    expect(screen.getByText("Detail Love")).toBeInTheDocument();
    expect(screen.getByText("Small Chaos")).toBeInTheDocument();
    expect(screen.getByText("Hands Only")).toBeInTheDocument();
    expect(screen.getByText("Golden Hour")).toBeInTheDocument();
  });

  it("shows 0/5 progress initially", () => {
    setNameAndProgress();
    render(<App />);
    expect(screen.getByText("0 / 5 erledigt")).toBeInTheDocument();
  });

  it("shows steps with numbered list", () => {    setNameAndProgress();    render(<App />);
    expect(screen.getByText("So einfach geht's:")).toBeInTheDocument();
    expect(screen.getByText("Erledige die 5 Foto‑Challenges")).toBeInTheDocument();
  });

  it("persists progress to localStorage", () => {
    setNameAndProgress({ "01-new-faces": true });
    render(<App />);
    const saved = JSON.parse(localStorage.getItem("progress"));
    expect(saved["01-new-faces"]).toBe(true);
  });

  it("restores progress from localStorage", () => {
    setNameAndProgress({ "01-new-faces": true, "02-detail-love": true });
    render(<App />);
    expect(screen.getByText("2 / 5 erledigt")).toBeInTheDocument();
  });

  it("shows completion message when all 5 done", () => {
    setNameAndProgress({
      "01-new-faces": true,
      "02-detail-love": true,
      "03-small-chaos": true,
      "04-hands-only": true,
      "05-golden-hour": true,
    });
    render(<App />);
    expect(screen.getByText(/Alle geschafft/)).toBeInTheDocument();
    expect(screen.getByText(/Du hast alle Challenges gemeistert/)).toBeInTheDocument();
  });

  it("opens upload modal when clicking Foto aufnehmen", () => {
    setNameAndProgress();
    render(<App />);
    fireEvent.click(screen.getAllByText("Foto aufnehmen")[0]);
    expect(screen.getByText("Aus Galerie wählen")).toBeInTheDocument();
    expect(screen.getByText("Abbrechen")).toBeInTheDocument();
  });

  it("closes upload modal when clicking Abbrechen", () => {
    setNameAndProgress();
    render(<App />);
    fireEvent.click(screen.getAllByText("Foto aufnehmen")[0]);
    expect(screen.getByText("Abbrechen")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Abbrechen"));
    expect(screen.queryByText("Abbrechen")).not.toBeInTheDocument();
  });

  it("handles corrupt localStorage gracefully", () => {
    localStorage.setItem("userName", "TestUser");
    localStorage.setItem("progress", "not-valid-json{{{");
    render(<App />);
    expect(screen.getByText("0 / 5 erledigt")).toBeInTheDocument();
  });
});

// ==================== UPLOAD MODAL ====================

describe("UploadModal", () => {
  beforeEach(() => {
    mockPathname("/125");
  });

  it("shows preview after file selection", async () => {
    localStorage.setItem("userName", "TestUser");
    render(<App />);
    fireEvent.click(screen.getAllByText("Foto aufnehmen")[0]);

    const mockUrl = "blob:http://localhost/test";
    vi.spyOn(URL, "createObjectURL").mockReturnValue(mockUrl);
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});

    const file = new File(["test"], "test.jpg", { type: "image/jpeg" });
    const cameraInput = document.querySelector('input[capture="environment"]');
    Object.defineProperty(cameraInput, "files", { value: [file], configurable: true });
    fireEvent.change(cameraInput);

    await waitFor(() => {
      expect(screen.getByAltText("Vorschau")).toBeInTheDocument();
      expect(screen.getByText("Foto hochladen")).toBeInTheDocument();
      expect(screen.getByText("Anderes Foto wählen")).toBeInTheDocument();
    });
  });

  it("shows error when upload fails", async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: "Server error" }),
    });

    localStorage.setItem("userName", "TestUser");
    render(<App />);
    fireEvent.click(screen.getAllByText("Foto aufnehmen")[0]);

    const mockUrl = "blob:http://localhost/test";
    vi.spyOn(URL, "createObjectURL").mockReturnValue(mockUrl);
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});

    const file = new File(["test"], "test.jpg", { type: "image/jpeg" });
    const cameraInput = document.querySelector('input[capture="environment"]');
    Object.defineProperty(cameraInput, "files", { value: [file], configurable: true });
    fireEvent.change(cameraInput);

    await waitFor(() => expect(screen.getByAltText("Vorschau")).toBeInTheDocument());

    fireEvent.click(screen.getByText("Foto hochladen"));

    await waitFor(() => {
      expect(screen.getByText("Server error")).toBeInTheDocument();
    });
  });

  it("calls fetch with correct form data on upload", async () => {
    global.fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ ok: true }) });

    localStorage.setItem("userName", "TestUser");
    render(<App />);
    fireEvent.click(screen.getAllByText("Foto aufnehmen")[0]);

    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});

    const file = new File(["img"], "photo.jpg", { type: "image/jpeg" });
    const cameraInput = document.querySelector('input[capture="environment"]');
    Object.defineProperty(cameraInput, "files", { value: [file], configurable: true });
    fireEvent.change(cameraInput);

    await waitFor(() => expect(screen.getByAltText("Vorschau")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Foto hochladen"));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/upload"),
        expect.objectContaining({ method: "POST" })
      );
    });
  });

  it("locks body scroll when modal is open", () => {
    localStorage.setItem("userName", "TestUser");
    render(<App />);
    fireEvent.click(screen.getAllByText("Foto aufnehmen")[0]);
    expect(document.body.style.overflow).toBe("hidden");
  });
});

// ==================== ADMIN PAGE ====================

describe("AdminPage", () => {
  beforeEach(() => {
    mockPathname("/admin");
  });

  it("shows error when token is empty", () => {
    render(<App />);
    fireEvent.click(screen.getByText("Anmelden"));
    expect(screen.getByText("Bitte Admin Token eingeben.")).toBeInTheDocument();
  });

  it("shows error on invalid token", async () => {
    global.fetch.mockResolvedValueOnce({ ok: false, status: 401 });

    render(<App />);
    fireEvent.change(screen.getByPlaceholderText("Admin Token"), { target: { value: "wrong" } });
    fireEvent.click(screen.getByText("Anmelden"));

    await waitFor(() => {
      expect(screen.getByText("Ungültiger Admin Token.")).toBeInTheDocument();
    });
  });

  it("shows gallery after successful login", async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          photos: [
            { key: "01-new-faces/2026-05-07/test.jpg", challengeId: "01-new-faces", originalName: "test.jpg", size: 1024 },
          ],
        }),
    });

    render(<App />);
    fireEvent.change(screen.getByPlaceholderText("Admin Token"), { target: { value: "correct" } });
    fireEvent.click(screen.getByText("Anmelden"));

    await waitFor(() => {
      expect(screen.getByText("Galerie")).toBeInTheDocument();
      expect(screen.getByText(/New Faces/)).toBeInTheDocument();
    });
  });

  it("shows photo count and size in gallery", async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          photos: [
            { key: "01-new-faces/a.jpg", challengeId: "01-new-faces", size: 5242880 },
            { key: "02-detail-love/b.jpg", challengeId: "02-detail-love", size: 3145728 },
          ],
        }),
    });

    render(<App />);
    fireEvent.change(screen.getByPlaceholderText("Admin Token"), { target: { value: "token" } });
    fireEvent.click(screen.getByText("Anmelden"));

    await waitFor(() => {
      expect(screen.getByText(/2 Fotos/)).toBeInTheDocument();
      expect(screen.getByText(/8 MB/)).toBeInTheDocument();
    });
  });

  it("supports Enter key to login", async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ photos: [] }),
    });

    render(<App />);
    const input = screen.getByPlaceholderText("Admin Token");
    fireEvent.change(input, { target: { value: "token" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });
  });
});

// ==================== CHALLENGES DATA ====================

describe("Challenges", () => {
  it("has exactly 5 challenges with unique IDs", () => {
    mockPathname("/125");
    localStorage.setItem("userName", "TestUser");
    render(<App />);
    expect(screen.getByText("New Faces")).toBeInTheDocument();
    expect(screen.getByText("Detail Love")).toBeInTheDocument();
    expect(screen.getByText("Small Chaos")).toBeInTheDocument();
    expect(screen.getByText("Hands Only")).toBeInTheDocument();
    expect(screen.getByText("Golden Hour")).toBeInTheDocument();
  });

  it("shows challenge descriptions", () => {
    mockPathname("/125");
    localStorage.setItem("userName", "TestUser");
    render(<App />);
    expect(screen.getByText(/Macht ein Foto mit jemandem/)).toBeInTheDocument();
    expect(screen.getByText(/Fotografiert ein schönes Party/)).toBeInTheDocument();
    expect(screen.getByText(/Gruppenfoto/)).toBeInTheDocument();
    expect(screen.getByText(/Nur Hände im Bild/)).toBeInTheDocument();
    expect(screen.getByText(/Das Licht ist perfekt/)).toBeInTheDocument();
  });
});
