const jsonHeaders = {
  "content-type": "application/json; charset=utf-8"
};

const allowedChallenges = new Set([
  "01-new-faces",
  "02-detail-love",
  "03-small-chaos",
  "04-hands-only",
  "05-golden-hour"
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

      // GET /photo/thumb/[KEY] — 250px thumbnail
      if (request.method === "GET" && url.pathname.startsWith("/photo/thumb/")) {
        const key = decodeURIComponent(url.pathname.slice("/photo/thumb/".length));
        return withCors(await handleGetThumb(request, env, key), request, env);
      }

      // GET /photo/full/[KEY] — original high-quality image
      if (request.method === "GET" && url.pathname.startsWith("/photo/full/")) {
        const key = decodeURIComponent(url.pathname.slice("/photo/full/".length));
        return withCors(await handleGetPhoto(request, env, key), request, env);
      }

      // Legacy: GET /photo/[KEY] — fallback to original
      if (request.method === "GET" && url.pathname.startsWith("/photo/")) {
        const key = decodeURIComponent(url.pathname.slice("/photo/".length));
        return withCors(await handleGetPhoto(request, env, key), request, env);
      }

      // DELETE /photo/[KEY] — delete both original + thumb
      if (request.method === "DELETE" && url.pathname.startsWith("/photo/")) {
        const key = decodeURIComponent(url.pathname.slice("/photo/".length));
        return withCors(await handleDeletePhoto(request, env, key), request, env);
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
  const thumb = formData.get("thumb");
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

  const extension = "jpg";
  const safeName = randomId();
  const nameSlug = name ? name.replace(/[^a-zA-Z0-9äöüÄÖÜß-]/g, "_").slice(0, 30) : "anon";
  const key = `${challengeId}/${nameSlug}-${Date.now()}-${safeName}.${extension}`;

  const now = new Date();
  const metadata = {
    challengeId,
    challengeTitle,
    name,
    message,
    originalName: sanitizeText(photo.name || "foto", 140),
    uploadedAt: now.toISOString()
  };

  const puts = [
    env.PHOTOS_BUCKET.put(`original/${key}`, photo.stream(), {
      httpMetadata: { contentType: "image/jpeg", cacheControl: "private, max-age=0, no-store" },
      customMetadata: metadata
    })
  ];

  if (thumb && typeof thumb !== "string") {
    puts.push(
      env.PHOTOS_BUCKET.put(`thumbs/${key}`, thumb.stream(), {
        httpMetadata: { contentType: "image/jpeg", cacheControl: "public, max-age=31536000, immutable" },
        customMetadata: metadata
      })
    );
  }

  await Promise.all(puts);

  return Response.json({ ok: true, key }, { headers: jsonHeaders });
}

async function handleListPhotos(request, env) {
  const authResponse = requireAdmin(request, env);
  if (authResponse) return authResponse;

  // List originals and thumbs in parallel
  async function listPrefix(prefix) {
    const objects = [];
    let cursor;
    do {
      const listed = await env.PHOTOS_BUCKET.list({
        prefix,
        limit: 1000,
        cursor,
        include: ["customMetadata"]
      });
      objects.push(...(listed.objects || []));
      cursor = listed.truncated ? listed.cursor : undefined;
    } while (cursor);
    return objects;
  }

  const [originals, thumbs] = await Promise.all([
    listPrefix("original/"),
    listPrefix("thumbs/")
  ]);

  const thumbKeys = new Set(thumbs.map((o) => o.key.replace(/^thumbs\//, "")));

  const photos = originals
    .filter((object) => !object.key.endsWith("/"))
    .map((object) => {
      const metadata = object.customMetadata || {};
      const key = object.key.replace(/^original\//, "");
      return {
        key,
        size: object.size,
        uploaded: object.uploaded,
        challengeId: metadata.challengeId || "",
        challengeTitle: metadata.challengeTitle || "",
        name: metadata.name || "",
        message: metadata.message || "",
        originalName: metadata.originalName || "foto.jpg",
        uploadedAt: metadata.uploadedAt || object.uploaded || "",
        hasThumb: thumbKeys.has(key)
      };
    });

  photos.sort((a, b) => String(b.uploadedAt).localeCompare(String(a.uploadedAt)));

  return Response.json({ photos }, { headers: jsonHeaders });
}

async function handleGetThumb(request, env, key) {
  const authResponse = requireAdmin(request, env);
  if (authResponse) return authResponse;

  if (!key || key.includes("..")) {
    return Response.json({ error: "Invalid key" }, { status: 400, headers: jsonHeaders });
  }

  const object = await env.PHOTOS_BUCKET.get(`thumbs/${key}`);

  if (!object) {
    return Response.json({ error: "Thumbnail not found" }, { status: 404, headers: jsonHeaders });
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", "public, max-age=31536000, immutable");

  return new Response(object.body, { headers });
}

async function handleGetPhoto(request, env, key) {
  const authResponse = requireAdmin(request, env);
  if (authResponse) return authResponse;

  if (!key || key.includes("..")) {
    return Response.json({ error: "Invalid key" }, { status: 400, headers: jsonHeaders });
  }

  // Try original/ prefix first, then raw key for legacy support
  let object = await env.PHOTOS_BUCKET.get(`original/${key}`);
  if (!object) {
    object = await env.PHOTOS_BUCKET.get(key);
  }

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

async function handleDeletePhoto(request, env, key) {
  const authResponse = requireAdmin(request, env);
  if (authResponse) return authResponse;

  if (!key || key.includes("..")) {
    return Response.json({ error: "Invalid key" }, { status: 400, headers: jsonHeaders });
  }

  await Promise.all([
    env.PHOTOS_BUCKET.delete(`original/${key}`),
    env.PHOTOS_BUCKET.delete(`thumbs/${key}`)
  ]);

  return Response.json({ ok: true }, { headers: jsonHeaders });
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
    "access-control-allow-methods": "GET, POST, DELETE, OPTIONS",
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

function randomId() {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function downloadFileName(object, key) {
  const name = key.split("/").pop() || "foto.jpg";
  return name.replace(/["\\/]/g, "_");
}
