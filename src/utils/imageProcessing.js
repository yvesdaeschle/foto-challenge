import { IMAGE_QUALITY, IMAGE_SIZE } from "../constants.js";

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Image load failed"));
    };
    img.src = url;
  });
}

function resizeToBlob(img, maxSize, quality) {
  return new Promise((resolve, reject) => {
    const { width, height } = img;
    const scale = Math.min(1, maxSize / Math.max(width, height));
    const w = Math.round(width * scale);
    const h = Math.round(height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, w, h);
    canvas.toBlob((blob) => {
      if (!blob) return reject(new Error("Bildverarbeitung fehlgeschlagen"));
      resolve(blob);
    }, "image/jpeg", quality);
  });
}

/**
 * Process image file: load, resize to original and thumbnail versions
 * Tries createImageBitmap for better EXIF orientation handling on older Android
 */
export async function processImage(file) {
  let img;
  try {
    if (typeof createImageBitmap === "function") {
      img = await createImageBitmap(file);
    } else {
      img = await loadImage(file);
    }
  } catch {
    img = await loadImage(file);
  }

  try {
    const [original, thumb] = await Promise.all([
      resizeToBlob(img, IMAGE_SIZE.maxOriginal, IMAGE_QUALITY.original),
      resizeToBlob(img, IMAGE_SIZE.maxThumbnail, IMAGE_QUALITY.thumbnail),
    ]);
    return { original, thumb };
  } finally {
    if (typeof img.close === "function") img.close();
  }
}

/**
 * Generate cryptographically secure idempotency key for upload retry handling
 */
export function generateIdempotencyKey() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Create preview image from file with proper EXIF orientation
 */
export function createPreview(file) {
  return new Promise((resolve) => {
    if (typeof createImageBitmap === "function") {
      createImageBitmap(file)
        .then((bmp) => {
          const canvas = document.createElement("canvas");
          const scale = Math.min(1, 800 / Math.max(bmp.width, bmp.height));
          canvas.width = Math.round(bmp.width * scale);
          canvas.height = Math.round(bmp.height * scale);
          canvas.getContext("2d").drawImage(bmp, 0, 0, canvas.width, canvas.height);
          if (typeof bmp.close === "function") bmp.close();
          canvas.toBlob((blob) => {
            resolve(URL.createObjectURL(blob || file));
          }, "image/jpeg", 0.8);
        })
        .catch(() => {
          resolve(URL.createObjectURL(file));
        });
    } else {
      resolve(URL.createObjectURL(file));
    }
  });
}
