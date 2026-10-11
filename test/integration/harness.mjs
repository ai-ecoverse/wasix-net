import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createNodeKernel } from '@ai-ecoverse/slicc-kernel/node';

const wasmPath =
  process.env.WASIX_NET_HTTP_WASM ??
  fileURLToPath(new URL('../../target/wasm32-wasip1/release/wasix-net-http.wasm', import.meta.url));

const manifest = {
  name: 'wasix-net-http',
  version: '0.0.0',
  slicc: {
    abi: 'wasi',
    commands: { 'wasix-net-http': { wasm: 'bin/wasix-net-http.wasm' } },
  },
};

export async function kernelWithHttp(options = {}) {
  const kernel = await createNodeKernel(options);
  await kernel.writeFile('/node_modules/wasix-net-http/package.json', JSON.stringify(manifest));
  await kernel.writeFile(
    '/node_modules/wasix-net-http/bin/wasix-net-http.wasm',
    await readFile(wasmPath)
  );
  await kernel.writeFile('/tmp/.keep', '');
  return kernel;
}

export const output = (result) =>
  `status ${result.status}\n--- stdout\n${result.stdout}\n--- stderr\n${result.stderr}`;
