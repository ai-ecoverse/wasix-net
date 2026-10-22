import { test } from 'node:test';
import { cargoTest } from './rust.mjs';

test('cargo test on stable', (t) => cargoTest(t, 'stable', ['--features', 'json']));
