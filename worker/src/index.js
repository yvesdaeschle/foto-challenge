const jsonHeaders = {
  "content-type": "application/json; charset=utf-8"
};

const allowedChallenges = new Set([
  "new-faces",
  "detail-love",
  "small-chaos",
  "hands-only",
  "golden-hour"
]);

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(request, env)
      });
    }

    try {
      if (request.method === "POST" && url.pathname === "/upload") {
        return withCors(await handleUpload(request, env), request, env);
      }

      if (request.method === "GET" && url.pathname === "/photos") {
        return withCors(await handleListPhotos(request, env), request, env);
      }

      if (request.method === "GET" && url.pathname.startsWith("/photo/")) {
        const key = decodeURIComponent(url.pathname.replace("/photo/", ""));
        return withCors(await handleGetPhoto(request, env, key), request, env);
      }

      return withCors(
        Response.json({ error: "Not found" }, { status: 404 }),
        request,
        env
      );
    } catch (error) {
      return withCors(
        Response.json({ error: error.message || "Internal server error" }, { status: 500 }),
        request,
        env
      );
    }
  }
};

async function handleUpload(request, env) {
  const contentType = request.headers.get("content-type") || "";

  if (!contentType.includes("multipart/form-data")) {
    return Response.json({ error: "Expected multipart/form-data" }, { status: 400, headers: jsonHeaders });
  }

  const formData = await request.formData();
  const photo = formData.get("photo");
  const challengeId = sanitizeText(formData.get("challengeId"), 80);
  const challengeTitle = sanitizeText(formData.get("challengeTitle"), 120);
  const name = sanitizeText(formData.get("name"), 80);
  const message = sanitizeText(formData.get("message"), 240);

  if (!allowedChallenges.has(challengeId)) {
    return Response.json({ error: "Ungültige Challenge." }, { status: 400, headers: jsonHeaders });
  }

  if (!photo || typeof photo === "string") {
    return Response.json({ error: "Kein Foto gefunden." }, { status: 400, headers: jsonHeaders });
  }

  if (!photo.type || !photo.type.startsWith("image/")) {
    return Response.json({ error: "Bitte nur Bilder hochladen." }, { status: 400, headers: jsonHeaders });
  }

  const maxMb = Number(env.MAX_FILE_SIZE_MB || "12");
  const maxBytes = maxMb * 1024 * 1024;

  if (photo.size > maxBytes) {
    return Response.json({ error: `Bild ist zu groß. Maximal ${maxMb} MB.` }, { status: 413, headers: jsonHeaders });
  }

  const extension = extensionFromMime(photo.type);
  const now = new Date();
  const safeName = randomId();
  const key = `${challengeId}/${now.toISOString().slice(0, 10)}/${Date.now()}-${safeName}.${extension}`;

  await env.PHOTOS_BUCKET.put(key, photo.stream(), {
    httpMetadata: {
      contentType: photo.type,
      cacheControl: "private, max-age=0, no-store"
    },
    customMetadata: {
      challengeId,
      challengeTitle,
      name,
      message,
      originalName: sanitizeText(photo.name || "foto", 140),
      uploadedAt: now.toISOString()
    }
  });

  return Response.json({ ok: true, key }, { headers: jsonHeaders });
}

async function handleListPhotos(request, env) {
  const authResponse = requireAdmin(request, env);
  if (authResponse) return authResponse;

  // Paginate through all R2 objects
  const objects = [];
  let cursor;
  do {
    const listed = await env.PHOTOS_BUCKET.list({ limit: 1000, cursor });
    objects.push(...(listed.objects || []));
    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor);

  const photos = await Promise.all(
    objects
      .filter((object) => !object.key.endsWith("/"))
      .map(async (object) => {
        const head = await env.PHOTOS_BUCKET.head(object.key);
        const metadata = head?.customMetadata || {};

        return {
          key: object.key,
          size: object.size,
          uploaded: object.uploaded,
          challengeId: metadata.challengeId || "",
          challengeTitle: metadata.challengeTitle || "",
          name: metadata.name || "",
          message: metadata.message || "",
          originalName: metadata.originalName || "foto.jpg",
          uploadedAt: metadata.uploadedAt || object.uploaded || ""
        };
      })
  );

  photos.sort((a, b) => String(b.uploadedAt).localeCompare(String(a.uploadedAt)));

  return Response.json({ photos }, { headers: jsonHeaders });
}

async function handleGetPhoto(request, env, key) {
  const authResponse = requireAdmin(request, env);
  if (authResponse) return authResponse;

  if (!key || key.includes("..")) {
    return Response.json({ error: "Invalid key" }, { status: 400, headers: jsonHeaders });
  }

  const object = await env.PHOTOS_BUCKET.get(key);

  if (!object) {
    return Response.json({ error: "Photo not found" }, { status: 404, headers: jsonHeaders });
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", "private, max-age=0, no-store");
  headers.set("content-disposition", `attachment; filename="${downloadFileName(object, key)}"`);

  return new Response(object.body, { headers });
}

function requireAdmin(request, env) {
  const token = request.headers.get("x-admin-token") || "";

  if (!env.ADMIN_TOKEN || token !== env.ADMIN_TOKEN) {
    return Response.json({ error: "Unauthorized" }, { status: 401, headers: jsonHeaders });
  }

  return null;
}

function corsHeaders(request, env) {
  const requestOrigin = request.headers.get("origin") || "";
  const allowedOrigin = env.ALLOWED_ORIGIN || "*";
  const origin = allowedOrigin === "*" || requestOrigin === allowedOrigin ? requestOrigin || allowedOrigin : allowedOrigin;

  return {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "content-type, x-admin-token",
    "access-control-max-age": "86400",
    "vary": "Origin"
  };
}

function withCors(response, request, env) {
  const headers = new Headers(response.headers);
  const cors = corsHeaders(request, env);

  Object.entries(cors).forEach(([key, value]) => headers.set(key, value));

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

function sanitizeText(value, maxLength) {
  return String(value || "")
    .replace(/[<>]/g, "")
    .trim()
    .slice(0, maxLength);
}

function extensionFromMime(mime) {
  const map = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/heic": "heic",
    "image/heif": "heif"
  };

  return map[mime] || "jpg";
}

function randomId() {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function downloadFileName(object, key) {
  const metadata = object.customMetadata || {};
  const originalName = metadata.originalName || key.split("/").pop() || "foto.jpg";
  return originalName.replace(/["\\/]/g, "_");
}
