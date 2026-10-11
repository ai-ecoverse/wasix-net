#!/bin/sh
set -eu
version=$1
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
  rm -f "$log"
  if [ "$attempt" -eq 8 ]; then
    exit 1
  fi
  attempt=$((attempt + 1))
  sleep 15
done
