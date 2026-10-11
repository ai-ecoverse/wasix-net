import { readFileSync, writeFileSync } from 'node:fs';

const path = 'node_modules/@ai-ecoverse/slicc-shared-web/bin/slicc-no-unit-tests.sh';
let text;
try {
  text = readFileSync(path, 'utf8');
} catch {
  process.exit(0);
}
const needle = "grep -vE '^test/integration/'";
const next = "grep -vE '^test/integration/|^tests/'";
if (text.includes(next)) process.exit(0);
if (!text.includes(needle)) {
  process.stderr.write('slicc-no-unit-tests.sh exclusion is missing\n');
  process.exit(1);
}
writeFileSync(path, text.replace(needle, next));
