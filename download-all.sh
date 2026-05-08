#!/bin/bash
# Download all original photos from R2 using rclone
# Prerequisites: brew install rclone && rclone config (set up R2 remote named "r2")
#
# rclone config steps:
#   Name: r2
#   Type: s3
#   Provider: Cloudflare
#   Access Key ID: (from Cloudflare Dashboard → R2 → API Tokens)
#   Secret Access Key: (from same token)
#   Endpoint: https://<ACCOUNT_ID>.r2.cloudflarestorage.com
#   Leave rest as defaults

set -e

REMOTE="r2"
BUCKET="foto-challenge-uploads"
PREFIX="original/"
DEST="./alle-fotos"

if ! command -v rclone &> /dev/null; then
  echo "rclone not found. Install with: brew install rclone"
  exit 1
fi

echo "Downloading all photos to $DEST ..."
rclone sync "$REMOTE:$BUCKET/$PREFIX" "$DEST" --progress --transfers 8

echo ""
echo "Done! Photos saved to $DEST"
echo "Total: $(find "$DEST" -type f | wc -l | tr -d ' ') files"
