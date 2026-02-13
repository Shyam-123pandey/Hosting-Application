#!/bin/sh
set -e

if [ -z "$GIT_REPOSITORY_URL" ]; then
  echo "❌ GIT_REPOSITORY_URL not set"
  exit 1
fi

echo "📦 Cloning repo into /home/app/output"

mkdir -p /home/app/output
git clone "$GIT_REPOSITORY_URL" /home/app/output

exec node scripts.js
