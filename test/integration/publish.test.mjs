import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));

async function publish(t, failure) {
  const dir = await mkdtemp(join(tmpdir(), 'wasix-net-publish-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await mkdir(join(dir, 'scripts'));
  await mkdir(join(dir, 'bin'));
  await copyFile(
    join(root, 'scripts/set-crate-version.mjs'),
    join(dir, 'scripts/set-crate-version.mjs')
  );
  await writeFile(join(dir, 'Cargo.toml'), '[package]\nname = "wasix-net"\nversion = "0.1.0"\n');
  await writeFile(join(dir, 'failure'), failure ?? '');
  await writeFile(
    join(dir, 'bin/cargo'),
    '#!/bin/sh\nset -eu\nprintf "%s\\n" "$*" >> "$COMMAND_LOG"\nif [ "$1" = fetch ]; then touch "$CACHE_WARM"; else test -f "$CACHE_WARM" || { echo "no matching package named serde found in offline mode" >&2; exit 101; }; fi\nif [ "$1" = publish ] && [ -s "$FAILURE" ]; then cat "$FAILURE" >&2; exit 101; fi\n',
    { mode: 0o755 }
  );
  await writeFile(join(dir, 'bin/sleep'), '#!/bin/sh\nexit 0\n', { mode: 0o755 });
  const result = spawnSync('sh', [join(root, 'scripts/publish-crate.sh'), '0.1.2'], {
    cwd: dir,
    env: {
      ...process.env,
      PATH: `${join(dir, 'bin')}:${process.env.PATH}`,
      COMMAND_LOG: join(dir, 'commands'),
      CACHE_WARM: join(dir, 'cache-warm'),
      FAILURE: join(dir, 'failure'),
    },
    encoding: 'utf8',
    timeout: 5000,
  });
  const commands = await readFile(join(dir, 'commands'), 'utf8');
  const publishes = commands.split('\n').filter((line) => line.startsWith('publish')).length;
  const manifest = await readFile(join(dir, 'Cargo.toml'), 'utf8');
  return { ...result, commands, publishes, manifest };
}

test('crate publication warms a fresh registry before the offline version update', async (t) => {
  const result = await publish(t);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(
    result.commands,
    'fetch --locked\nupdate --offline -p wasix-net\npublish --locked --allow-dirty\n'
  );
  assert.match(result.manifest, /version = "0\.1\.2"/);
});

test('a crates.io rate limit warns, skips the release once, and passes', async (t) => {
  const result = await publish(
    t,
    'error: failed to publish wasix-net v0.1.2 to registry at https://crates.io\n\nCaused by:\n  the remote server responded with an error (status 429 Too Many Requests): You have published too many versions of this crate in the last 24 hours\n'
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.publishes, 1, 'no retry');
  assert.match(
    result.stdout,
    /^::warning::crates\.io rate-limited wasix-net 0\.1\.2; skipped it, the next release publishes the newest version$/m
  );
  assert.match(
    result.stdout,
    /^publish-crate: SKIP wasix-net 0\.1\.2 rate-limited by crates\.io$/m
  );
});

test('any other publish error still fails after 8 attempts', async (t) => {
  const result = await publish(
    t,
    'error: failed to publish wasix-net v0.1.2\n\nCaused by:\n  the remote server responded with an error (status 403 Forbidden): this token cannot publish\n'
  );
  assert.notEqual(result.status, 0);
  assert.equal(result.publishes, 8);
  assert.doesNotMatch(result.stdout, /::warning::|publish-crate: SKIP/);
});

test('an already uploaded version counts as published', async (t) => {
  const result = await publish(t, 'error: crate version `0.1.2` is already uploaded\n');
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.publishes, 1);
});
