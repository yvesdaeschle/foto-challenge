#!/bin/bash
# =============================================================
# Smoke Test für den Foto-Challenge Worker (Production)
# Testet alle Endpoints gegen die live URL
# =============================================================
set +e

WORKER_URL="https://white-unit-000b.sevyelsch.workers.dev"
ORIGIN="https://foto-challenge.pages.dev"
ADMIN_TOKEN="${ADMIN_TOKEN:-}"
PASSED=0
FAILED=0
TOTAL=0

if [ -z "$ADMIN_TOKEN" ]; then
  echo "⚠️  Set ADMIN_TOKEN env var to test admin endpoints (delete, zip)"
  echo "   Usage: ADMIN_TOKEN=xxx ./smoke-test.sh"
  echo ""
fi

pass() { PASSED=$((PASSED+1)); TOTAL=$((TOTAL+1)); echo "  ✅ $1"; }
fail() { FAILED=$((FAILED+1)); TOTAL=$((TOTAL+1)); echo "  ❌ $1: $2"; }

check() {
  if [ "$1" = "$2" ]; then
    pass "$3"
  else
    fail "$3" "$4"
  fi
}

echo "🔍 Smoke-Testing Worker: $WORKER_URL"
echo ""

# -----------------------------------------------------------
# 1. CORS preflight
# -----------------------------------------------------------
echo "1️⃣  CORS OPTIONS /upload"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X OPTIONS \
  -H "Origin: $ORIGIN" \
  -H "Access-Control-Request-Method: POST" \
  "$WORKER_URL/upload")
[ "$STATUS" = "204" ] && pass "OPTIONS → 204" || fail "OPTIONS" "got $STATUS"

# -----------------------------------------------------------
# 2. GET /photos (should return JSON array)
# -----------------------------------------------------------
echo "2️⃣  GET /photos"
RESP=$(curl -s -H "Origin: $ORIGIN" -H "x-admin-token: $ADMIN_TOKEN" "$WORKER_URL/photos")
echo "$RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); assert isinstance(d.get('photos'),list)" 2>/dev/null \
  && pass "Returns JSON array (${#RESP} bytes)" \
  || fail "/photos" "not a JSON array"

# -----------------------------------------------------------
# 3. POST /upload — invalid (no file)
# -----------------------------------------------------------
echo "3️⃣  POST /upload (no file → should fail)"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
  -H "Origin: $ORIGIN" \
  "$WORKER_URL/upload")
[ "$STATUS" = "400" ] && pass "No file → 400" || fail "Upload no-file" "got $STATUS"

# -----------------------------------------------------------
# 4. POST /upload — invalid challenge
# -----------------------------------------------------------
echo "4️⃣  POST /upload (bad challenge → should fail)"
# Create a tiny test image
echo -n "fakeimage" > /tmp/smoketest.jpg
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
  -H "Origin: $ORIGIN" \
  -F "photo=@/tmp/smoketest.jpg;type=image/jpeg" \
  -F "challengeId=99-invalid" \
  -F "name=SmokeTest" \
  "$WORKER_URL/upload")
[ "$STATUS" = "400" ] && pass "Bad challenge → 400" || fail "Bad challenge" "got $STATUS"

# -----------------------------------------------------------
# 5. POST /upload — valid upload
# -----------------------------------------------------------
echo "5️⃣  POST /upload (valid)"
# Create a real tiny JPEG (1x1 pixel)
python3 -c "
import struct, sys
# Minimal JPEG: SOI + APP0 + DQT + SOF0 + DHT + SOS + EOI
sys.stdout.buffer.write(bytes([
  0xFF,0xD8,0xFF,0xE0,0x00,0x10,0x4A,0x46,0x49,0x46,0x00,0x01,
  0x01,0x00,0x00,0x01,0x00,0x01,0x00,0x00,0xFF,0xDB,0x00,0x43,
  0x00,0x08,0x06,0x06,0x07,0x06,0x05,0x08,0x07,0x07,0x07,0x09,
  0x09,0x08,0x0A,0x0C,0x14,0x0D,0x0C,0x0B,0x0B,0x0C,0x19,0x12,
  0x13,0x0F,0x14,0x1D,0x1A,0x1F,0x1E,0x1D,0x1A,0x1C,0x1C,0x20,
  0x24,0x2E,0x27,0x20,0x22,0x2C,0x23,0x1C,0x1C,0x28,0x37,0x29,
  0x2C,0x30,0x31,0x34,0x34,0x34,0x1F,0x27,0x39,0x3D,0x38,0x32,
  0x3C,0x2E,0x33,0x34,0x32,0xFF,0xC0,0x00,0x0B,0x08,0x00,0x01,
  0x00,0x01,0x01,0x01,0x11,0x00,0xFF,0xC4,0x00,0x1F,0x00,0x00,
  0x01,0x05,0x01,0x01,0x01,0x01,0x01,0x01,0x00,0x00,0x00,0x00,
  0x00,0x00,0x00,0x00,0x01,0x02,0x03,0x04,0x05,0x06,0x07,0x08,
  0x09,0x0A,0x0B,0xFF,0xC4,0x00,0xB5,0x10,0x00,0x02,0x01,0x03,
  0x03,0x02,0x04,0x03,0x05,0x05,0x04,0x04,0x00,0x00,0x01,0x7D,
  0x01,0x02,0x03,0x00,0x04,0x11,0x05,0x12,0x21,0x31,0x41,0x06,
  0x13,0x51,0x61,0x07,0x22,0x71,0x14,0x32,0x81,0x91,0xA1,0x08,
  0x23,0x42,0xB1,0xC1,0x15,0x52,0xD1,0xF0,0x24,0x33,0x62,0x72,
  0x82,0x09,0x0A,0x16,0x17,0x18,0x19,0x1A,0x25,0x26,0x27,0x28,
  0x29,0x2A,0x34,0x35,0x36,0x37,0x38,0x39,0x3A,0x43,0x44,0x45,
  0x46,0x47,0x48,0x49,0x4A,0x53,0x54,0x55,0x56,0x57,0x58,0x59,
  0x5A,0x63,0x64,0x65,0x66,0x67,0x68,0x69,0x6A,0x73,0x74,0x75,
  0x76,0x77,0x78,0x79,0x7A,0x83,0x84,0x85,0x86,0x87,0x88,0x89,
  0x8A,0x92,0x93,0x94,0x95,0x96,0x97,0x98,0x99,0x9A,0xA2,0xA3,
  0xA4,0xA5,0xA6,0xA7,0xA8,0xA9,0xAA,0xB2,0xB3,0xB4,0xB5,0xB6,
  0xB7,0xB8,0xB9,0xBA,0xC2,0xC3,0xC4,0xC5,0xC6,0xC7,0xC8,0xC9,
  0xCA,0xD2,0xD3,0xD4,0xD5,0xD6,0xD7,0xD8,0xD9,0xDA,0xE1,0xE2,
  0xE3,0xE4,0xE5,0xE6,0xE7,0xE8,0xE9,0xEA,0xF1,0xF2,0xF3,0xF4,
  0xF5,0xF6,0xF7,0xF8,0xF9,0xFA,0xFF,0xDA,0x00,0x08,0x01,0x01,
  0x00,0x00,0x3F,0x00,0x7B,0x94,0x11,0x00,0x00,0x00,0xFF,0xD9
]))
" > /tmp/smoketest-real.jpg

UPLOAD_RESP=$(curl -s -w "\n%{http_code}" -X POST \
  -H "Origin: $ORIGIN" \
  -F "photo=@/tmp/smoketest-real.jpg;type=image/jpeg" \
  -F "thumb=@/tmp/smoketest-real.jpg;type=image/jpeg" \
  -F "challengeId=01-new-faces" \
  -F "challengeTitle=New Faces" \
  -F "name=SmokeTest" \
  -F "message=Automated test" \
  "$WORKER_URL/upload")
UPLOAD_STATUS=$(echo "$UPLOAD_RESP" | tail -1)
UPLOAD_BODY=$(echo "$UPLOAD_RESP" | sed '$d')
UPLOAD_KEY=$(echo "$UPLOAD_BODY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('key',''))" 2>/dev/null || echo "")
[ "$UPLOAD_STATUS" = "200" ] && pass "Upload → 200 (key: $UPLOAD_KEY)" || fail "Upload" "got $UPLOAD_STATUS: $UPLOAD_BODY"

# -----------------------------------------------------------
# 6. GET /photo/thumb/KEY
# -----------------------------------------------------------
if [ -n "$UPLOAD_KEY" ]; then
  echo "6️⃣  GET /photo/thumb/$UPLOAD_KEY"
  THUMB_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "Origin: $ORIGIN" \
    -H "x-admin-token: $ADMIN_TOKEN" \
    "$WORKER_URL/photo/thumb/$UPLOAD_KEY")
  [ "$THUMB_STATUS" = "200" ] && pass "Thumb → 200" || fail "Thumb" "got $THUMB_STATUS"

  echo "7️⃣  GET /photo/full/$UPLOAD_KEY"
  FULL_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "Origin: $ORIGIN" \
    -H "x-admin-token: $ADMIN_TOKEN" \
    "$WORKER_URL/photo/full/$UPLOAD_KEY")
  [ "$FULL_STATUS" = "200" ] && pass "Full → 200" || fail "Full" "got $FULL_STATUS"
fi

# -----------------------------------------------------------
# 8. GET /photos — verify uploaded photo appears
# -----------------------------------------------------------
echo "8️⃣  GET /photos — check SmokeTest photo in list"
PHOTOS=$(curl -s -H "Origin: $ORIGIN" -H "x-admin-token: $ADMIN_TOKEN" "$WORKER_URL/photos")
echo "$PHOTOS" | grep -q "SmokeTest" \
  && pass "SmokeTest photo in list" \
  || fail "List" "SmokeTest not found"

# -----------------------------------------------------------
# 9. GET /download/zip (needs admin token)
# -----------------------------------------------------------
echo "9️⃣  GET /download/zip (no token → should fail)"
ZIP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Origin: $ORIGIN" \
  "$WORKER_URL/download/zip?challenge=01-new-faces")
[ "$ZIP_STATUS" = "401" ] && pass "ZIP without token → 401" || fail "ZIP no-auth" "got $ZIP_STATUS"

if [ -n "$ADMIN_TOKEN" ]; then
  echo "9️⃣b GET /download/zip (with token → should work)"
  ZIP_OK=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "Origin: $ORIGIN" \
    "$WORKER_URL/download/zip?challenge=01-new-faces&token=$ADMIN_TOKEN")
  [ "$ZIP_OK" = "200" ] && pass "ZIP with token → 200" || fail "ZIP auth" "got $ZIP_OK"
fi

# -----------------------------------------------------------
# 10. DELETE /photo/KEY — cleanup test photo
# -----------------------------------------------------------
if [ -n "$UPLOAD_KEY" ] && [ -n "$ADMIN_TOKEN" ]; then
  echo "🔟  DELETE /photo/$UPLOAD_KEY"
  DEL_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE \
    -H "Origin: $ORIGIN" \
    -H "x-admin-token: $ADMIN_TOKEN" \
    "$WORKER_URL/photo/$UPLOAD_KEY")
  [ "$DEL_STATUS" = "200" ] && pass "Delete → 200" || fail "Delete" "got $DEL_STATUS"

  # Verify it's gone
  echo "1️⃣1️⃣ Verify deleted"
  GONE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "Origin: $ORIGIN" \
    -H "x-admin-token: $ADMIN_TOKEN" \
    "$WORKER_URL/photo/full/$UPLOAD_KEY")
  [ "$GONE_STATUS" = "404" ] && pass "Deleted photo → 404" || fail "Verify delete" "got $GONE_STATUS"
fi

# -----------------------------------------------------------
# 11. 404 for unknown routes
# -----------------------------------------------------------
echo "1️⃣2️⃣ Unknown route → 404"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Origin: $ORIGIN" \
  "$WORKER_URL/nonexistent")
[ "$STATUS" = "404" ] && pass "Unknown → 404" || fail "Unknown route" "got $STATUS"

# -----------------------------------------------------------
# Summary
# -----------------------------------------------------------
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Results: $PASSED/$TOTAL passed, $FAILED failed"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

rm -f /tmp/smoketest.jpg /tmp/smoketest-real.jpg
[ "$FAILED" -eq 0 ] && exit 0 || exit 1
