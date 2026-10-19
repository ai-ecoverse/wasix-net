import assert from 'node:assert/strict';
import { test } from 'node:test';
import { kernelWithNonblocking, output } from './harness.mjs';

test('nonblocking socket reads ignore timeouts and blocking reads keep them', {
  timeout: 15000,
}, async () => {
  const kernel = await kernelWithNonblocking();
  try {
    const result = await kernel.run(['wasix-net-nonblocking']);
    assert.equal(result.status, 0, output(result));
    assert.match(result.stdout, /nonblocking read: WouldBlock/);
    assert.match(result.stdout, /blocking read: TimedOut/);
    assert.match(result.stdout, /socket options preserved/);
  } finally {
    kernel.terminate();
  }
});
