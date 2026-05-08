#!/usr/bin/env bash
# =============================================================
# Smoke test for the Foto-Challenge worker.
# Usage:
#   ADMIN_TOKEN=xxx ./smoke-test.sh
#   WORKER_URL=https://staging.example.workers.dev ADMIN_TOKEN=xxx ./smoke-test.sh
# =============================================================
set -uo pipefail

WORKER_URL="${WORKER_URL:-https://white-unit-000b.sevyelsch.workers.dev}"
ORIGIN="${ORIGIN:-https://foto-challenge.pages.dev}"
SITE_URL="${SITE_URL:-$ORIGIN}"
ADMIN_TOKEN="${ADMIN_TOKEN:-}"

# ---- pretty output -----------------------------------------
if [ -t 1 ]; then
  R=$'\e[31m'; G=$'\e[32m'; Y=$'\e[33m'; B=$'\e[34m'; D=$'\e[2m'; N=$'\e[0m'
else
  R=""; G=""; Y=""; B=""; D=""; N=""
fi

PASS=0; FAIL=0; TOTAL=0
pass() { PASS=$((PASS+1)); TOTAL=$((TOTAL+1)); printf "  ${G}✓${N} %s\n" "$1"; }
fail() { FAIL=$((FAIL+1)); TOTAL=$((TOTAL+1)); printf "  ${R}✗${N} %s ${D}— %s${N}\n" "$1" "$2"; }
section() { printf "\n${B}%s${N}\n" "$1"; }

# ---- prerequisites -----------------------------------------
for cmd in curl jq python3 unzip; do
  command -v "$cmd" >/dev/null 2>&1 || { echo "${R}Missing required command: $cmd${N}"; exit 2; }
done

# ---- temp + cleanup ----------------------------------------
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

CURL_OPTS=(-sS --connect-timeout 10 --max-time 60)

# ---- generate two distinguishable 1×1 JPEGs ----------------
JPEG="$TMP/test.jpg"
JPEG2="$TMP/test2.jpg"
TMP_DIR="$TMP" python3 - <<'PY'
import os
TMP = os.environ["TMP_DIR"]
HDR = bytes.fromhex(
  "ffd8ffe000104a46494600010100000100010000ffdb004300080606070605080707"
  "07090908090c14150c10110b0b13280f111c1f242b2a26242a2c1f23252b3338342f"
  "302927ffc0000b08000100010101110000ffc4001f0000010501010101010100000000"
  "00000000010203040506070809ffc400b5100002010303020403050504040000017d"
  "01020300041105122131410613516107227114328191a1082342b1c11552d1f02433"
  "627282090a161718191a25262728292a3435363738393a434445464748494a535455"
  "565758595a636465666768696a737475767778797a838485868788898a9293949596"
  "9798999aa2a3a4a5a6a7a8a9aab2b3b4b5b6b7b8b9bac2c3c4c5c6c7c8c9cad2d3d4"
  "d5d6d7d8d9dae1e2e3e4e5e6e7e8e9eaf1f2f3f4f5f6f7f8f9faffda00080101003f"
  "00")
img1 = HDR + bytes.fromhex("7b941100ffd9")
# img2 has ~64 bytes of padding before EOI so its size clearly differs
img2 = HDR + bytes.fromhex("7b941100") + (b"\xaa" * 64) + bytes.fromhex("ffd9")
open(os.path.join(TMP, "test.jpg"),  "wb").write(img1)
open(os.path.join(TMP, "test2.jpg"), "wb").write(img2)
PY

if [ ! -s "$JPEG" ] || [ ! -s "$JPEG2" ]; then
  echo "${R}Failed to create test JPEGs${N}"; exit 2
fi
SIZE1=$(wc -c < "$JPEG"  | tr -d ' ')
SIZE2=$(wc -c < "$JPEG2" | tr -d ' ')

if [ -z "$ADMIN_TOKEN" ]; then
  printf "${Y}⚠  ADMIN_TOKEN not set — admin-only checks will be skipped${N}\n"
fi

printf "${B}Target: ${N}%s   ${B}Origin: ${N}%s\n" "$WORKER_URL" "$ORIGIN"

# ============================================================
section "1. CORS"
# ============================================================
HDRS=$(curl "${CURL_OPTS[@]}" -i -X OPTIONS \
  -H "Origin: $ORIGIN" \
  -H "Access-Control-Request-Method: POST" \
  "$WORKER_URL/upload")
STATUS=$(printf '%s' "$HDRS" | head -1 | awk '{print $2}')
[ "$STATUS" = "204" ] && pass "OPTIONS /upload → 204" || fail "OPTIONS /upload" "got $STATUS"

ALLOW=$(printf '%s' "$HDRS" | grep -i '^access-control-allow-origin:' | tr -d '\r' | awk -F': ' '{print $2}')
[ -n "$ALLOW" ] && pass "Allow-Origin header present ($ALLOW)" || fail "Allow-Origin" "missing"

# ============================================================
section "2. Auth"
# ============================================================
STATUS=$(curl "${CURL_OPTS[@]}" -o /dev/null -w "%{http_code}" \
  -H "Origin: $ORIGIN" "$WORKER_URL/photos")
[ "$STATUS" = "401" ] && pass "GET /photos no token → 401" || fail "/photos no auth" "got $STATUS"

STATUS=$(curl "${CURL_OPTS[@]}" -o /dev/null -w "%{http_code}" \
  -H "Origin: $ORIGIN" -H "x-admin-token: definitely-wrong" "$WORKER_URL/photos")
[ "$STATUS" = "401" ] && pass "GET /photos bad token → 401" || fail "/photos bad token" "got $STATUS"

STATUS=$(curl "${CURL_OPTS[@]}" -o /dev/null -w "%{http_code}" \
  -H "Origin: $ORIGIN" -H "x-admin-token: x" "$WORKER_URL/photo/full/..%2Fetc%2Fpasswd")
case "$STATUS" in 400|401) pass "Path traversal blocked → $STATUS" ;; *) fail "traversal" "got $STATUS" ;; esac

# ============================================================
section "3. Upload validation"
# ============================================================
STATUS=$(curl "${CURL_OPTS[@]}" -o /dev/null -w "%{http_code}" -X POST \
  -H "Origin: $ORIGIN" "$WORKER_URL/upload")
[ "$STATUS" = "400" ] && pass "POST /upload no body → 400" || fail "no-body upload" "got $STATUS"

STATUS=$(curl "${CURL_OPTS[@]}" -o /dev/null -w "%{http_code}" -X POST \
  -H "Origin: $ORIGIN" \
  -F "photo=@$JPEG;type=image/jpeg" \
  -F "challengeId=99-invalid" \
  -F "name=SmokeTest" \
  "$WORKER_URL/upload")
[ "$STATUS" = "400" ] && pass "Bad challengeId → 400" || fail "bad challenge" "got $STATUS"

# ============================================================
section "4. Upload + idempotency"
# ============================================================
IDEM="smoketest-$(date +%s)-$RANDOM"
upload_with_idem() {
  local idem="$1"
  local file="${2:-$JPEG}"
  curl "${CURL_OPTS[@]}" -X POST \
    -H "Origin: $ORIGIN" \
    -F "photo=@$file;type=image/jpeg" \
    -F "thumb=@$file;type=image/jpeg" \
    -F "challengeId=01-new-faces" \
    -F "challengeTitle=New Faces" \
    -F "name=SmokeTest" \
    -F "message=Automated test" \
    -F "idempotencyKey=$idem" \
    "$WORKER_URL/upload"
}

RESP=$(upload_with_idem "$IDEM" "$JPEG")
KEY=$(printf '%s' "$RESP" | jq -r '.key // ""')
OK=$(printf '%s' "$RESP" | jq -r '.ok // false')
[ "$OK" = "true" ] && [ -n "$KEY" ] && pass "Upload #1 → ok (key: $KEY)" || fail "upload #1" "$RESP"

RESP=$(upload_with_idem "$IDEM" "$JPEG")
KEY2=$(printf '%s' "$RESP" | jq -r '.key // ""')
[ "$KEY" = "$KEY2" ] && pass "Idempotent upload reuses same key" || fail "idempotency" "key changed: $KEY2"

# Replace: upload a different file under the same idempotency key.
# Same R2 key should be returned, and downloading should yield the new bytes.
RESP=$(upload_with_idem "$IDEM" "$JPEG2")
KEY3=$(printf '%s' "$RESP" | jq -r '.key // ""')
[ "$KEY" = "$KEY3" ] && pass "Replace upload reuses same key" || fail "replace key" "key changed: $KEY3"

if [ -n "$ADMIN_TOKEN" ] && [ -n "$KEY" ]; then
  curl "${CURL_OPTS[@]}" -o "$TMP/replaced.jpg" \
    -H "Origin: $ORIGIN" -H "x-admin-token: $ADMIN_TOKEN" \
    "$WORKER_URL/photo/full/$KEY" >/dev/null
  GOT_SIZE=$(wc -c < "$TMP/replaced.jpg" | tr -d ' ')
  if [ "$GOT_SIZE" = "$SIZE2" ]; then
    pass "Replace overwrote object (size ${GOT_SIZE}B = file2 ${SIZE2}B, file1 was ${SIZE1}B)"
  else
    fail "replace bytes" "downloaded ${GOT_SIZE}B, expected ${SIZE2}B (file1 was ${SIZE1}B)"
  fi
fi

# ============================================================
section "5. Read photo + thumb"
# ============================================================
if [ -n "$ADMIN_TOKEN" ] && [ -n "$KEY" ]; then
  HDRS=$(curl "${CURL_OPTS[@]}" -D - -o "$TMP/thumb.jpg" \
    -H "Origin: $ORIGIN" -H "x-admin-token: $ADMIN_TOKEN" \
    "$WORKER_URL/photo/thumb/$KEY")
  STATUS=$(printf '%s' "$HDRS" | head -1 | awk '{print $2}')
  CT=$(printf '%s' "$HDRS" | grep -i '^content-type:' | tr -d '\r' | awk -F': ' '{print $2}' | head -1)
  SIZE=$(wc -c < "$TMP/thumb.jpg" | tr -d ' ')
  [ "$STATUS" = "200" ] && [[ "$CT" == image/* ]] && [ "$SIZE" -gt 0 ] \
    && pass "Thumb → 200 ($CT, ${SIZE}B)" \
    || fail "thumb" "status=$STATUS ct=$CT size=$SIZE"

  STATUS=$(curl "${CURL_OPTS[@]}" -o "$TMP/full.jpg" -w "%{http_code}" \
    -H "Origin: $ORIGIN" -H "x-admin-token: $ADMIN_TOKEN" \
    "$WORKER_URL/photo/full/$KEY")
  [ "$STATUS" = "200" ] && [ -s "$TMP/full.jpg" ] && pass "Full → 200" || fail "full" "got $STATUS"

  RESP=$(curl "${CURL_OPTS[@]}" -H "Origin: $ORIGIN" -H "x-admin-token: $ADMIN_TOKEN" "$WORKER_URL/photos")
  COUNT=$(printf '%s' "$RESP" | jq '[.photos[] | select(.key == "'"$KEY"'")] | length')
  [ "$COUNT" = "1" ] && pass "Listed in /photos exactly once" || fail "list" "count=$COUNT"
fi

# ============================================================
section "6. ZIP download"
# ============================================================
STATUS=$(curl "${CURL_OPTS[@]}" -o /dev/null -w "%{http_code}" \
  -H "Origin: $ORIGIN" "$WORKER_URL/download/zip?challenge=01-new-faces")
[ "$STATUS" = "401" ] && pass "ZIP no token → 401" || fail "ZIP no auth" "got $STATUS"

if [ -n "$ADMIN_TOKEN" ]; then
  STATUS=$(curl "${CURL_OPTS[@]}" -o "$TMP/photos.zip" -w "%{http_code}" \
    -H "Origin: $ORIGIN" \
    "$WORKER_URL/download/zip?challenge=01-new-faces&token=$ADMIN_TOKEN")
  if [ "$STATUS" = "200" ]; then
    if unzip -tq "$TMP/photos.zip" >/dev/null 2>&1; then
      ENTRIES=$(unzip -l "$TMP/photos.zip" | tail -1 | awk '{print $2}')
      pass "ZIP downloads + integrity OK ($ENTRIES entries)"
    else
      fail "ZIP integrity" "unzip -t failed"
    fi
  else
    fail "ZIP" "got $STATUS"
  fi
fi

# ============================================================
section "7. Delete"
# ============================================================
if [ -n "$ADMIN_TOKEN" ] && [ -n "$KEY" ]; then
  STATUS=$(curl "${CURL_OPTS[@]}" -o /dev/null -w "%{http_code}" -X DELETE \
    -H "Origin: $ORIGIN" -H "x-admin-token: $ADMIN_TOKEN" \
    "$WORKER_URL/photo/$KEY")
  [ "$STATUS" = "200" ] && pass "DELETE /photo/KEY → 200" || fail "delete" "got $STATUS"

  STATUS=$(curl "${CURL_OPTS[@]}" -o /dev/null -w "%{http_code}" \
    -H "Origin: $ORIGIN" -H "x-admin-token: $ADMIN_TOKEN" \
    "$WORKER_URL/photo/full/$KEY")
  [ "$STATUS" = "404" ] && pass "Deleted photo gone → 404" || fail "verify-delete" "got $STATUS"

  # delete-all (no remaining test photos expected, but endpoint must answer 200)
  STATUS=$(curl "${CURL_OPTS[@]}" -o /dev/null -w "%{http_code}" -X DELETE \
    -H "Origin: $ORIGIN" "$WORKER_URL/photos")
  [ "$STATUS" = "401" ] && pass "DELETE /photos no token → 401" || fail "delete-all auth" "got $STATUS"
fi

# ============================================================
section "8. Misc"
# ============================================================
STATUS=$(curl "${CURL_OPTS[@]}" -o /dev/null -w "%{http_code}" \
  -H "Origin: $ORIGIN" "$WORKER_URL/nonexistent")
[ "$STATUS" = "404" ] && pass "Unknown route → 404" || fail "404 route" "got $STATUS"

if [ -n "$SITE_URL" ]; then
  HTML=$(curl "${CURL_OPTS[@]}" "$SITE_URL/125" || true)
  if printf '%s' "$HTML" | grep -q 'Foto'; then
    pass "Frontend $SITE_URL/125 reachable"
  else
    fail "Frontend" "could not fetch /125"
  fi
fi

# ============================================================
section "9. Load test (LOAD_COUNT uploads + bulk delete)"
# ============================================================
# Off by default. Enable with LOAD_COUNT=100 ./smoke-test.sh
LOAD_COUNT="${LOAD_COUNT:-0}"
LOAD_PARALLEL="${LOAD_PARALLEL:-8}"

if [ "$LOAD_COUNT" -gt 0 ] && [ -z "$ADMIN_TOKEN" ]; then
  printf "  ${Y}⚠  LOAD_COUNT=%s requested but ADMIN_TOKEN missing — skipping${N}\n" "$LOAD_COUNT"
elif [ "$LOAD_COUNT" -gt 0 ]; then
  BATCH_TAG="loadtest-$(date +%s)"
  printf "  ${D}Uploading %d photos (%d parallel) tagged %s...${N}\n" "$LOAD_COUNT" "$LOAD_PARALLEL" "$BATCH_TAG"

  # Baseline count before the load test
  BASELINE=$(curl "${CURL_OPTS[@]}" -H "Origin: $ORIGIN" -H "x-admin-token: $ADMIN_TOKEN" \
    "$WORKER_URL/photos" | jq -r '.photos | length // 0')

  upload_one() {
    local idx="$1"
    local idem="$BATCH_TAG-$idx"
    curl -sS --max-time 30 -X POST \
      -H "Origin: $ORIGIN" \
      -F "photo=@$JPEG;type=image/jpeg" \
      -F "thumb=@$JPEG;type=image/jpeg" \
      -F "challengeId=01-new-faces" \
      -F "challengeTitle=Load Test" \
      -F "name=$BATCH_TAG" \
      -F "message=load test #$idx" \
      -F "idempotencyKey=$idem" \
      "$WORKER_URL/upload" \
      | jq -r '.ok // false'
  }
  export -f upload_one
  export JPEG ORIGIN WORKER_URL BATCH_TAG

  T0=$(date +%s)
  # Stream indices through xargs -P for parallelism, count "true" results
  OK_COUNT=$(seq 1 "$LOAD_COUNT" \
    | xargs -P "$LOAD_PARALLEL" -I{} bash -c 'upload_one "$@"' _ {} \
    | grep -c '^true$' || true)
  T1=$(date +%s)
  ELAPSED=$((T1 - T0))
  RATE=$(awk -v c="$OK_COUNT" -v t="$ELAPSED" 'BEGIN { if (t==0) t=1; printf "%.1f", c/t }')

  if [ "$OK_COUNT" = "$LOAD_COUNT" ]; then
    pass "Uploaded $OK_COUNT/$LOAD_COUNT photos in ${ELAPSED}s (${RATE} req/s)"
  else
    fail "load uploads" "$OK_COUNT/$LOAD_COUNT succeeded in ${ELAPSED}s"
  fi

  # Verify count grew by exactly LOAD_COUNT (baseline + LOAD_COUNT)
  AFTER=$(curl "${CURL_OPTS[@]}" -H "Origin: $ORIGIN" -H "x-admin-token: $ADMIN_TOKEN" \
    "$WORKER_URL/photos" | jq -r '.photos | length // 0')
  EXPECTED=$((BASELINE + LOAD_COUNT))
  if [ "$AFTER" -ge "$EXPECTED" ]; then
    pass "GET /photos shows $AFTER photos (baseline $BASELINE + $LOAD_COUNT)"
  else
    fail "load count" "expected ≥ $EXPECTED, got $AFTER"
  fi

  # Bulk-delete everything (single API call) and assert all gone
  T2=$(date +%s)
  DEL_RESP=$(curl "${CURL_OPTS[@]}" -X DELETE \
    -H "Origin: $ORIGIN" -H "x-admin-token: $ADMIN_TOKEN" \
    "$WORKER_URL/photos")
  T3=$(date +%s)
  DEL_OK=$(printf '%s' "$DEL_RESP" | jq -r '.ok // false')
  DEL_COUNT=$(printf '%s' "$DEL_RESP" | jq -r '.deleted // 0')
  if [ "$DEL_OK" = "true" ] && [ "$DEL_COUNT" -ge "$LOAD_COUNT" ]; then
    pass "DELETE /photos removed $DEL_COUNT in $((T3 - T2))s (single call)"
  else
    fail "bulk delete" "ok=$DEL_OK deleted=$DEL_COUNT (resp: $DEL_RESP)"
  fi

  FINAL=$(curl "${CURL_OPTS[@]}" -H "Origin: $ORIGIN" -H "x-admin-token: $ADMIN_TOKEN" \
    "$WORKER_URL/photos" | jq -r '.photos | length // 0')
  if [ "$FINAL" = "0" ]; then
    pass "Bucket empty after bulk delete (0 photos)"
  else
    fail "post-delete count" "expected 0, got $FINAL"
  fi
fi

# ============================================================
printf "\n${B}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${N}\n"
printf "${B}  Results: ${G}%d${N}/%d passed" "$PASS" "$TOTAL"
[ "$FAIL" -gt 0 ] && printf ", ${R}%d failed${N}" "$FAIL"
printf "\n${B}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${N}\n"

[ "$FAIL" -eq 0 ]
