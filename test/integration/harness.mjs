import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createNodeKernel } from '@ai-ecoverse/slicc-kernel/node';

const manifest = {
  name: 'wasix-net-http',
  version: '0.0.0',
  slicc: {
    abi: 'wasi',
    commands: { 'wasix-net-http': { wasm: 'bin/wasix-net-http.wasm' } },
  },
};

export async function kernelWithHttp(dir, options = {}) {
  const kernel = await createNodeKernel(options);
  await kernel.writeFile('/node_modules/wasix-net-http/package.json', JSON.stringify(manifest));
  await kernel.writeFile(
    '/node_modules/wasix-net-http/bin/wasix-net-http.wasm',
    await readFile(join(dir, 'wasix-net-http.wasm'))
  );
  await kernel.writeFile('/tmp/.keep', '');
  return kernel;
}

export async function kernelWithNonblocking(dir) {
  const kernel = await createNodeKernel();
  const pkg = '/node_modules/wasix-net-nonblocking';
  await kernel.writeFile(
    `${pkg}/package.json`,
    JSON.stringify({
      name: 'wasix-net-nonblocking',
      slicc: {
        abi: 'wasi',
        commands: { 'wasix-net-nonblocking': { wasm: 'bin/nonblocking.wasm' } },
      },
    })
  );
  await kernel.writeFile(
    `${pkg}/bin/nonblocking.wasm`,
    await readFile(join(dir, 'examples/nonblocking.wasm'))
  );
  return kernel;
}

export const output = (result) =>
  `status ${result.status}\n--- stdout\n${result.stdout}\n--- stderr\n${result.stderr}`;
