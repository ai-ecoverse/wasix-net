import assert from 'node:assert/strict';
import { test } from 'node:test';
import { kernelWithNonblocking, output } from './harness.mjs';

export function nonblockingTests(dir) {
  test('nonblocking socket reads ignore timeouts and blocking reads keep them', {
    timeout: 15000,
  }, async () => {
    const kernel = await kernelWithNonblocking(dir);
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
}
