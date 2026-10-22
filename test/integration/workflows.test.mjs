import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { test } from 'node:test';

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
const ci = await read('.github/workflows/ci.yml');
const pkg = JSON.parse(await read('package.json'));
const job = (name) => ci.match(new RegExp(`\\n {2}${name}:\\n((?: {4}.*\\n|\\n)+)`))?.[1] ?? '';
const input = (name) => job('ci').match(new RegExp(`\\n {6}${name}: (.+)\\n`))?.[1];

test('ci.yml is the only workflow and calls pipeline.yml at the devDependency version', async () => {
  assert.deepEqual(await readdir(new URL('../../.github/workflows/', import.meta.url)), ['ci.yml']);
  const version = pkg.devDependencies['@ai-ecoverse/slicc-shared-web'];
  assert.match(version, /^2\.\d+\.\d+$/);
  assert.match(
    job('ci'),
    new RegExp(
      `^ {4}uses: ai-ecoverse/slicc-shared-web/\\.github/workflows/pipeline\\.yml@v${version.replaceAll('.', '\\.')}\\n {4}secrets: inherit\\n`
    )
  );
  assert.equal(ci.match(/uses: ai-ecoverse\/slicc-shared-web\//g).length, 1);
  assert.deepEqual(ci.split('\njobs:\n')[1].match(/^ {2}[a-z-]+:$/gm), [
    '  ci:',
    '  released:',
    '  crates:',
  ]);
  assert.doesNotMatch(ci, /workflow_dispatch|schedule:|workflow_run/);
  for (const name of ['runs-on', 'after-release', 'require-tests', 'test', 'node-options'])
    assert.equal(input(name), undefined, name);
});

test('the shards split exactly the files npm test runs, one at a time', () => {
  assert.equal(input('test-glob'), 'test/integration/*.test.mjs');
  assert.ok(pkg.scripts.test.endsWith(` '${input('test-glob')}'`), pkg.scripts.test);
  assert.match(pkg.scripts.test, /--test-concurrency=1/);
});

test('crates.io gets the crate from ci.yml only after a new v* tag at HEAD on main', () => {
  assert.match(job('released'), /needs: ci\n/);
  assert.match(
    job('released'),
    /if: github\.event_name == 'push' && github\.ref == 'refs\/heads\/main'\n/
  );
  assert.match(job('released'), /git tag --points-at HEAD --list 'v\*'/);
  assert.match(job('crates'), /needs: released\n/);
  assert.match(job('crates'), /if: needs\.released\.outputs\.version != ''\n/);
  assert.match(job('crates'), /id-token: write/);
  assert.match(job('crates'), /rust-lang\/crates-io-auth-action@/);
  assert.match(job('crates'), /sh scripts\/publish-crate\.sh "\$VERSION"/);
  assert.equal(pkg.private, true);
  assert.equal(pkg.fledgling, undefined);
});

test('semantic-release runs on main and publishes nothing to npm', async () => {
  const release = JSON.parse(await read('.releaserc.json'));
  assert.deepEqual(release.branches, ['main']);
  assert.deepEqual(release.plugins[2], ['@semantic-release/npm', { npmPublish: false }]);
  assert.match(await read('Cargo.toml'), /^version = "0\.1\.0"$/m);
});

test('ci.yml has no comments', () => {
  for (const line of ci.split('\n')) assert.doesNotMatch(line, /^\s*#/);
});
