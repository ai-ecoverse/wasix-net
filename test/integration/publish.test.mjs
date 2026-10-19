import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));

test('crate publication warms a fresh registry before the offline version update', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'wasix-net-publish-'));
  try {
    await mkdir(join(dir, 'scripts'));
    await mkdir(join(dir, 'bin'));
    await copyFile(
      join(root, 'scripts/set-crate-version.mjs'),
      join(dir, 'scripts/set-crate-version.mjs')
    );
    await writeFile(join(dir, 'Cargo.toml'), '[package]\nname = "wasix-net"\nversion = "0.1.0"\n');
    await writeFile(
      join(dir, 'bin/cargo'),
      '#!/bin/sh\nset -eu\nprintf "%s\\n" "$*" >> "$COMMAND_LOG"\nif [ "$1" = fetch ]; then touch "$CACHE_WARM"; else test -f "$CACHE_WARM" || { echo "no matching package named serde found in offline mode" >&2; exit 101; }; fi\n',
      { mode: 0o755 }
    );
    const result = spawnSync('sh', [join(root, 'scripts/publish-crate.sh'), '0.1.2'], {
      cwd: dir,
      env: {
        ...process.env,
        PATH: `${join(dir, 'bin')}:${process.env.PATH}`,
        COMMAND_LOG: join(dir, 'commands'),
        CACHE_WARM: join(dir, 'cache-warm'),
      },
      encoding: 'utf8',
      timeout: 5000,
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(
      await readFile(join(dir, 'commands'), 'utf8'),
      'fetch --locked\nupdate --offline -p wasix-net\npublish --locked --allow-dirty\n'
    );
    assert.match(await readFile(join(dir, 'Cargo.toml'), 'utf8'), /version = "0\.1\.2"/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
