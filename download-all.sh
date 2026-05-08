#!/bin/bash
# Download all photos from R2 bucket to a local directory.
# Prerequisites: npm install -g wrangler && wrangler login

set -e

BUCKET="foto-challenge-uploads"
PREFIX="original/"
OUTPUT_DIR="./alle-fotos"

echo "📸 Downloading all photos from R2..."
echo "   Bucket: $BUCKET"
echo "   Output: $OUTPUT_DIR"
echo ""

mkdir -p "$OUTPUT_DIR"

# List all objects and download them
wrangler r2 object list "$BUCKET" --prefix "$PREFIX" --json \
  | jq -r '.objects[].key' \
  | while IFS= read -r key; do
      # Strip the "original/" prefix for local path
      local_path="$OUTPUT_DIR/${key#$PREFIX}"
      local_dir="$(dirname "$local_path")"

      mkdir -p "$local_dir"
      echo "⬇️  $key"
      wrangler r2 object get "$BUCKET" "$key" --file "$local_path"
    done

echo ""
echo "✅ Done! Photos saved to $OUTPUT_DIR"
echo "   Total: $(find "$OUTPUT_DIR" -type f | wc -l | tr -d ' ') files"
