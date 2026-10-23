#!/bin/sh
set -eu
version=$1
cargo fetch --locked
node scripts/set-crate-version.mjs "$version"
cargo update --offline -p wasix-net
attempt=1
while [ "$attempt" -le 8 ]; do
  log=$(mktemp)
  if cargo publish --locked --allow-dirty >"$log" 2>&1; then
    cat "$log"
    rm -f "$log"
    exit 0
  fi
  cat "$log"
  if grep -q 'already uploaded' "$log" || grep -q 'already exists' "$log"; then
    rm -f "$log"
    exit 0
  fi
  if grep -i -E 'status 429|too many requests|too many versions|rate.?limit' "$log" >/dev/null; then
    rm -f "$log"
    echo "::warning::crates.io rate-limited wasix-net $version; skipped it, the next release publishes the newest version"
    echo "publish-crate: SKIP wasix-net $version rate-limited by crates.io"
    exit 0
  fi
  rm -f "$log"
  if [ "$attempt" -eq 8 ]; then
    exit 1
  fi
  attempt=$((attempt + 1))
  sleep 15
done
