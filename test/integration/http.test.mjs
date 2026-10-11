import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { after, before, test } from 'node:test';
import { fetchTransport } from '@ai-ecoverse/slicc-kernel/node';
import { kernelWithHttp, output } from './harness.mjs';

let server;
let base;
const fetched = [];

before(async () => {
  server = createServer((req, res) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      const body = Buffer.concat(chunks);
      const url = new URL(req.url, 'http://origin.test');
      if (url.pathname === '/hello') {
        res.setHeader('X-Origin', 'node');
        res.end(`hello ${req.headers['x-test'] ?? ''}`);
      } else if (url.pathname === '/echo') {
        res.setHeader('Content-Type', 'application/json');
        res.end(
          JSON.stringify({
            method: req.method,
            type: req.headers['content-type'] ?? null,
            hex: body.toString('hex'),
            text: body.toString('utf8'),
          })
        );
      } else if (url.pathname === '/big') {
        res.end('x'.repeat(2 * 1024 * 1024));
      } else if (url.pathname === '/redirect') {
        res.statusCode = 302;
        res.setHeader('Location', '/hello');
        res.end();
      } else {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'application/json');
        res.end('{"error":"nope"}');
      }
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => server.close());

const transport = () =>
  fetchTransport({
    fetch: (url, init) => {
      fetched.push(String(url));
      const parsed = new URL(url);
      return fetch(`${base}${parsed.pathname}${parsed.search}`, { ...init, redirect: 'manual' });
    },
  });

async function run(args, env) {
  const kernel = await kernelWithHttp({ network: { transport: transport() } });
  try {
    return await kernel.run(['wasix-net-http', ...args], {
      cwd: '/tmp',
      ...(env ? { env } : {}),
    });
  } finally {
    kernel.terminate();
  }
}

const bodyOf = (stdout) => stdout.slice(stdout.indexOf('\n\n') + 2);

test('GET https:// with a header goes through the proxy in absolute form', async () => {
  fetched.length = 0;
  const result = await run(['GET', 'https://origin.test/hello?q=1', '-H', 'X-Test: yes']);
  assert.equal(result.status, 0, output(result));
  assert.match(result.stdout, /^status 200$/m);
  assert.match(result.stdout, /^header x-origin: node$/m);
  assert.equal(bodyOf(result.stdout), 'hello yes');
  assert.deepEqual(fetched, ['https://origin.test/hello?q=1']);
});

test('POST JSON and binary bodies', async () => {
  let result = await run(['POST', 'https://origin.test/echo', '--json', '{"a":[1,2],"b":"ü"}']);
  assert.equal(result.status, 0, output(result));
  let echo = JSON.parse(bodyOf(result.stdout));
  assert.deepEqual(
    [echo.method, echo.type, JSON.parse(echo.text)],
    ['POST', 'application/json', { a: [1, 2], b: 'ü' }]
  );
  const hex = Buffer.from(Array.from({ length: 256 }, (_, i) => i)).toString('hex');
  result = await run([
    'PUT',
    'http://origin.test/echo',
    '--data-hex',
    hex,
    '-H',
    'Content-Type: application/octet-stream',
  ]);
  assert.equal(result.status, 0, output(result));
  echo = JSON.parse(bodyOf(result.stdout));
  assert.deepEqual([echo.method, echo.type, echo.hex], ['PUT', 'application/octet-stream', hex]);
});

test('a 2 MiB body, a redirect and a 404', async () => {
  let result = await run(['GET', 'https://origin.test/big']);
  assert.equal(result.status, 0, output(result).slice(0, 2000));
  assert.equal(bodyOf(result.stdout).length, 2 * 1024 * 1024);
  fetched.length = 0;
  result = await run(['GET', 'https://origin.test/redirect']);
  assert.equal(result.status, 0, output(result));
  assert.match(result.stdout, /^url https:\/\/origin\.test\/hello$/m);
  assert.equal(bodyOf(result.stdout), 'hello ');
  assert.deepEqual(fetched, ['https://origin.test/redirect', 'https://origin.test/hello']);
  result = await run(['GET', 'https://origin.test/missing']);
  assert.equal(result.status, 0, output(result));
  assert.match(result.stdout, /^status 404$/m);
});

test('https:// without a proxy is a clear error', async () => {
  const noProxy = { https_proxy: '', HTTPS_PROXY: '', all_proxy: '', ALL_PROXY: '' };
  const result = await run(['GET', 'https://origin.test/hello'], noProxy);
  assert.equal(result.status, 3, output(result));
  assert.match(result.stderr, /^error tls-unsupported: .*no TLS/m);
});
