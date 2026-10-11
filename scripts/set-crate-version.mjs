import { readFileSync, writeFileSync } from 'node:fs';

const version = process.argv[2];
if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version) || version === '0.0.0') {
  process.stderr.write(`refusing version ${version}\n`);
  process.exit(1);
}
const path = 'Cargo.toml';
const text = readFileSync(path, 'utf8');
const found = text.match(/^version = "0\.1\.0"$/gm);
if (found?.length !== 1) {
  process.stderr.write(`expected 1 version line at 0.1.0, found ${found ? found.length : 0}\n`);
  process.exit(1);
}
writeFileSync(path, text.replaceAll('version = "0.1.0"', `version = "${version}"`));
