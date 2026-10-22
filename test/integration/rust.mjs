import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { homedir } from 'node:os';
import { delimiter, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = fileURLToPath(new URL('../../', import.meta.url));
export const env = {
  ...process.env,
  PATH: `${join(homedir(), '.cargo', 'bin')}${delimiter}${process.env.PATH}`,
};
export const targets = ['wasm32-wasip1', 'wasm32-wasip1-threads'];

export function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    env,
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
    ...options,
  });
  if (result.error) throw result.error;
  return result;
}

export function must(command, args, options) {
  const result = run(command, args, options);
  assert.equal(
    result.status,
    0,
    `${command} ${args.join(' ')} exited ${result.status}\n${result.stdout.slice(-4000)}\n${result.stderr.slice(-4000)}`
  );
  return result;
}

export function toolchain(name, { target = [] } = {}) {
  must('rustup', ['toolchain', 'install', name, '--profile', 'minimal']);
  if (target.length) must('rustup', ['target', 'add', '--toolchain', name, ...target]);
}

export function build(target) {
  toolchain('stable', { target: [target] });
  must('cargo', [
    '+stable',
    'build',
    '--locked',
    '--release',
    '--features',
    'json',
    '--bin',
    'wasix-net-http',
    '--example',
    'nonblocking',
    '--target',
    target,
  ]);
  return join(root, 'target', target, 'release');
}

export async function cargoTest(t, name, args) {
  toolchain(name);
  const result = run('cargo', [`+${name}`, 'test', '--locked', ...args]);
  const cases = [...result.stdout.matchAll(/^test (.+) \.\.\. (ok|FAILED|ignored)$/gm)];
  for (const [, id, verdict] of cases)
    await t.test(id, { skip: verdict === 'ignored' }, () => assert.equal(verdict, 'ok'));
  assert.equal(result.status, 0, `${result.stdout.slice(-4000)}\n${result.stderr.slice(-4000)}`);
  assert.ok(cases.length > 0, 'cargo test ran no test');
}
