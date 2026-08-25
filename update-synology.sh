#!/bin/sh
set -eu

cd "$(dirname "$0")"
git pull --ff-only
docker compose up -d --build
docker image prune -f

echo "WACopy was updated successfully."
