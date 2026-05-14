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

const PARTY_PREFIX = "party";

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

      if (request.method === "POST" && url.pathname === "/upload-party") {
        return withCors(await handlePartyUpload(request, env), request, env);
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

      // GET /download/zip — stream ZIP of photos
      if (request.method === "GET" && url.pathname === "/download/zip") {
        return withCors(await handleDownloadZip(request, env, url), request, env);
      }

      // Legacy: GET /photo/[KEY] — fallback to original
      if (request.method === "GET" && url.pathname.startsWith("/photo/")) {
        const key = decodeURIComponent(url.pathname.slice("/photo/".length));
        return withCors(await handleGetPhoto(request, env, key), request, env);
      }

      // DELETE /photos — delete all photos in one call
      if (request.method === "DELETE" && url.pathname === "/photos") {
        return withCors(await handleDeleteAllPhotos(request, env), request, env);
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
  const idempotencyKey = sanitizeKeyToken(formData.get("idempotencyKey"));

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
  const safeName = idempotencyKey || randomId();
  const nameSlug = name ? name.replace(/[^a-zA-Z0-9äöüÄÖÜß-]/g, "_").slice(0, 30) : "anon";
  // When idempotencyKey is provided, key is deterministic so retries overwrite the same object
  const key = idempotencyKey
    ? `${challengeId}/${nameSlug}-${safeName}.${extension}`
    : `${challengeId}/${nameSlug}-${Date.now()}-${safeName}.${extension}`;

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

async function handlePartyUpload(request, env) {
  const contentType = request.headers.get("content-type") || "";

  if (!contentType.includes("multipart/form-data")) {
    return Response.json({ error: "Expected multipart/form-data" }, { status: 400, headers: jsonHeaders });
  }

  const formData = await request.formData();
  const photo = formData.get("photo");
  const thumb = formData.get("thumb");
  const name = sanitizeText(formData.get("name"), 80);
  const idempotencyKey = sanitizeKeyToken(formData.get("idempotencyKey"));

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
  const safeName = idempotencyKey || randomId();
  const nameSlug = name ? name.replace(/[^a-zA-Z0-9äöüÄÖÜß-]/g, "_").slice(0, 30) : "anon";
  const key = idempotencyKey
    ? `${PARTY_PREFIX}/${nameSlug}-${safeName}.${extension}`
    : `${PARTY_PREFIX}/${nameSlug}-${Date.now()}-${safeName}.${extension}`;

  const now = new Date();
  const metadata = {
    challengeId: PARTY_PREFIX,
    challengeTitle: "Partyfotos",
    name,
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

async function handleDeleteAllPhotos(request, env) {
  const authResponse = requireAdmin(request, env);
  if (authResponse) return authResponse;

  async function listAllKeys(prefix) {
    const keys = [];
    let cursor;
    do {
      const listed = await env.PHOTOS_BUCKET.list({ prefix, limit: 1000, cursor });
      for (const obj of listed.objects || []) keys.push(obj.key);
      cursor = listed.truncated ? listed.cursor : undefined;
    } while (cursor);
    return keys;
  }

  const [originals, thumbs] = await Promise.all([
    listAllKeys("original/"),
    listAllKeys("thumbs/")
  ]);
  const allKeys = [...originals, ...thumbs];

  // R2 bulk delete accepts up to 1000 keys per call
  for (let i = 0; i < allKeys.length; i += 1000) {
    await env.PHOTOS_BUCKET.delete(allKeys.slice(i, i + 1000));
  }

  return Response.json({ ok: true, deleted: allKeys.length }, { headers: jsonHeaders });
}

// ================================================================
// STREAMING ZIP DOWNLOAD
// ================================================================

async function handleDownloadZip(request, env, url) {
  // Accept token from query param (for direct browser download via <a href>)
  const headerToken = request.headers.get("x-admin-token") || "";
  const queryToken = url.searchParams.get("token") || "";
  const token = headerToken || queryToken;

  if (!env.ADMIN_TOKEN || !timingSafeEqual(token, env.ADMIN_TOKEN)) {
    return Response.json({ error: "Unauthorized" }, { status: 401, headers: jsonHeaders });
  }

  const challenge = url.searchParams.get("challenge") || "all";

  // List all originals
  const objects = [];
  let cursor;
  do {
    const listed = await env.PHOTOS_BUCKET.list({
      prefix: "original/",
      limit: 1000,
      cursor
    });
    objects.push(...(listed.objects || []));
    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor);

  let files = objects.filter((o) => !o.key.endsWith("/"));

  if (challenge !== "all") {
    files = files.filter((o) => {
      const key = o.key.replace(/^original\//, "");
      return key.startsWith(challenge + "/");
    });
  }

  if (files.length === 0) {
    return Response.json({ error: "Keine Fotos gefunden." }, { status: 404, headers: jsonHeaders });
  }

  const filename = challenge === "all" ? "foto-challenge.zip" : `foto-challenge-${challenge}.zip`;

  const { readable, writable } = new TransformStream();

  // Start streaming ZIP in the background. Any error must abort the writable
  // so the client receives a TCP close instead of a hung connection.
  streamZip(env, files, writable).catch((err) => {
    try {
      writable.abort(err);
    } catch { /* writable may already be closed */ }
  });

  const headers = new Headers();
  headers.set("content-type", "application/zip");
  headers.set("content-disposition", `attachment; filename="${filename}"`);
  headers.set("cache-control", "private, no-store");

  return new Response(readable, { headers });
}

async function streamZip(env, files, writable) {
  const writer = writable.getWriter();
  const encoder = new TextEncoder();
  const centralEntries = [];
  let offset = 0;
  let aborted = false;

  try {
    for (const fileObj of files) {
      const key = fileObj.key.replace(/^original\//, "");
      const nameBytes = encoder.encode(key);

      // Get the file from R2
      const object = await env.PHOTOS_BUCKET.get(fileObj.key);
      if (!object) continue;

      const fileSize = object.size;

      // Local file header (no CRC upfront — we use data descriptor)
      const localHeader = new Uint8Array(30 + nameBytes.length);
      const view = new DataView(localHeader.buffer);
      view.setUint32(0, 0x04034b50, true);   // signature
      view.setUint16(4, 20, true);            // version needed (2.0)
      view.setUint16(6, 0x0008, true);        // flags: bit 3 = data descriptor
      view.setUint16(8, 0, true);             // compression: STORE
      view.setUint16(10, 0, true);            // mod time
      view.setUint16(12, 0, true);            // mod date
      view.setUint32(14, 0, true);            // CRC32 (in data descriptor)
      view.setUint32(18, 0, true);            // compressed size (in data descriptor)
      view.setUint32(22, 0, true);            // uncompressed size (in data descriptor)
      view.setUint16(26, nameBytes.length, true);
      view.setUint16(28, 0, true);            // extra field length
      localHeader.set(nameBytes, 30);

      await writer.write(localHeader);
      const localHeaderOffset = offset;
      offset += localHeader.length;

      // Stream file data and compute CRC32
      let crc = 0xFFFFFFFF;
      const reader = object.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        crc = crc32update(crc, value);
        await writer.write(value);
        offset += value.length;
      }
      crc = (crc ^ 0xFFFFFFFF) >>> 0;

      // Data descriptor (with signature)
      const descriptor = new Uint8Array(16);
      const descView = new DataView(descriptor.buffer);
      descView.setUint32(0, 0x08074b50, true);  // descriptor signature
      descView.setUint32(4, crc, true);
      descView.setUint32(8, fileSize, true);     // compressed size (STORE)
      descView.setUint32(12, fileSize, true);    // uncompressed size
      await writer.write(descriptor);
      offset += 16;

      // Remember for central directory
      centralEntries.push({ nameBytes, crc, size: fileSize, offset: localHeaderOffset });
    }

    // Central directory
    const centralStart = offset;
    for (const entry of centralEntries) {
      const cdHeader = new Uint8Array(46 + entry.nameBytes.length);
      const cdView = new DataView(cdHeader.buffer);
      cdView.setUint32(0, 0x02014b50, true);   // signature
      cdView.setUint16(4, 20, true);            // version made by
      cdView.setUint16(6, 20, true);            // version needed
      cdView.setUint16(8, 0x0008, true);        // flags
      cdView.setUint16(10, 0, true);            // compression: STORE
      cdView.setUint16(12, 0, true);            // mod time
      cdView.setUint16(14, 0, true);            // mod date
      cdView.setUint32(16, entry.crc, true);
      cdView.setUint32(20, entry.size, true);   // compressed
      cdView.setUint32(24, entry.size, true);   // uncompressed
      cdView.setUint16(28, entry.nameBytes.length, true);
      cdView.setUint16(30, 0, true);            // extra length
      cdView.setUint16(32, 0, true);            // comment length
      cdView.setUint16(34, 0, true);            // disk start
      cdView.setUint16(36, 0, true);            // internal attrs
      cdView.setUint32(38, 0, true);            // external attrs
      cdView.setUint32(42, entry.offset, true); // local header offset
      cdHeader.set(entry.nameBytes, 46);
      await writer.write(cdHeader);
      offset += cdHeader.length;
    }

    // End of central directory
    const eocd = new Uint8Array(22);
    const eocdView = new DataView(eocd.buffer);
    eocdView.setUint32(0, 0x06054b50, true);
    eocdView.setUint16(4, 0, true);              // disk number
    eocdView.setUint16(6, 0, true);              // disk with CD
    eocdView.setUint16(8, centralEntries.length, true);
    eocdView.setUint16(10, centralEntries.length, true);
    eocdView.setUint32(12, offset - centralStart, true);
    eocdView.setUint32(16, centralStart, true);
    eocdView.setUint16(20, 0, true);             // comment length
    await writer.write(eocd);
  } catch (err) {
    aborted = true;
    try { await writer.abort(err); } catch { /* already aborted/closed */ }
    throw err;
  } finally {
    if (!aborted) {
      try { await writer.close(); } catch { /* already closed */ }
    }
  }
}

// CRC32 (IEEE 802.3) — table-based for performance
const crc32Table = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }
  return table;
})();

function crc32update(crc, data) {
  for (let i = 0; i < data.length; i++) {
    crc = crc32Table[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
  }
  return crc;
}

function requireAdmin(request, env) {
  const token = request.headers.get("x-admin-token") || "";

  if (!env.ADMIN_TOKEN || !timingSafeEqual(token, env.ADMIN_TOKEN)) {
    return Response.json({ error: "Unauthorized" }, { status: 401, headers: jsonHeaders });
  }

  return null;
}

function timingSafeEqual(a, b) {
  const enc = new TextEncoder();
  const bufA = enc.encode(a);
  const bufB = enc.encode(b);
  // Always compare against the longer length to avoid leaking token length via timing
  const len = Math.max(bufA.length, bufB.length);
  const paddedA = new Uint8Array(len);
  const paddedB = new Uint8Array(len);
  paddedA.set(bufA);
  paddedB.set(bufB);
  let result = bufA.length ^ bufB.length; // non-zero if lengths differ
  for (let i = 0; i < len; i++) {
    result |= paddedA[i] ^ paddedB[i];
  }
  return result === 0;
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

function sanitizeKeyToken(value) {
  // Only allow [a-z0-9-] up to 64 chars (UUID is 36)
  return String(value || "").toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 64);
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
