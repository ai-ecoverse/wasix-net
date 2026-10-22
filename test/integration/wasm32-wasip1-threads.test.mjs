import { httpTests } from './http.mjs';
import { nonblockingTests } from './nonblocking.mjs';
import { build } from './rust.mjs';

const dir = build('wasm32-wasip1-threads');
httpTests(dir);
nonblockingTests(dir);
