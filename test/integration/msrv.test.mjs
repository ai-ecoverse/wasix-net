import { test } from 'node:test';
import { cargoTest } from './rust.mjs';

test('cargo test on the MSRV, 1.83.0', (t) => cargoTest(t, '1.83.0', ['--features', 'json']));
