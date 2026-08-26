#!/bin/sh
set -eu

cd "$(dirname "$0")"
git pull --ff-only
docker compose pull
docker compose up -d

echo "WACopy was updated successfully."
