import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { env, must, root, toolchain } from './rust.mjs';

test('the crate publishes from a fresh registry cache with a stamped version', (t) => {
  toolchain('stable');
  const scratch = mkdtempSync(join(tmpdir(), 'wasix-net-package-'));
  t.after(() => rmSync(scratch, { recursive: true, force: true }));
  const tree = join(scratch, 'tree');
  const files = must('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'])
    .stdout.split('\0')
    .filter(Boolean);
  for (const file of files) {
    try {
      cpSync(join(root, file), join(tree, file), { recursive: true });
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  const fresh = {
    ...env,
    CARGO_HOME: join(scratch, 'cargo'),
    CARGO_TARGET_DIR: join(scratch, 'target'),
  };
  const options = { cwd: tree, env: fresh };
  must('cargo', ['+stable', 'fetch', '--locked'], options);
  must('node', ['scripts/set-crate-version.mjs', '0.1.2'], options);
  must('cargo', ['+stable', 'update', '--offline', '-p', 'wasix-net'], options);
  const result = must(
    'cargo',
    ['+stable', 'publish', '--dry-run', '--locked', '--allow-dirty'],
    options
  );
  assert.match(result.stderr, /Packaging wasix-net v0\.1\.2/);
});
