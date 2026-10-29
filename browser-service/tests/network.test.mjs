import { test } from 'node:test';
import assert from 'node:assert/strict';
import { publicAddress, websiteUrl, createEgressProxy } from '../network.mjs';
import net from 'node:net';
test('blocks private, mapped, link-local and reserved egress', () => {
  for (const address of [
    '127.0.0.1',
    '10.0.0.1',
    '172.16.0.1',
    '192.168.1.1',
    '169.254.169.254',
    '100.64.0.1',
    '0.0.0.0',
    '224.0.0.1',
    '::1',
    '::ffff:127.0.0.1',
    'fe80::1',
    'fc00::1',
  ])
    assert.equal(publicAddress(address), false, address);
  assert.equal(publicAddress('93.184.215.14'), true);
  assert.equal(publicAddress('2606:4700:4700::1111'), true);
});
test('rejects active schemes, nonstandard ports and credentials', () => {
  for (const value of [
    'file:///etc/passwd',
    'javascript:alert(1)',
    'http://example.com:22',
    'https://user:pass@example.com',
  ])
    assert.throws(() => websiteUrl(value));
});
test('the actual proxy rejects private CONNECT destinations', async () => {
  const proxy = await createEgressProxy();
  try {
    const address = new URL(proxy.server);
    const response = await new Promise((resolve, reject) => {
      const socket = net.connect(Number(address.port), address.hostname, () =>
        socket.write('CONNECT 169.254.169.254:80 HTTP/1.1\r\nHost: 169.254.169.254:80\r\n\r\n'),
      );
      socket.once('data', (chunk) => {
        resolve(chunk.toString());
        socket.destroy();
      });
      socket.on('error', reject);
    });
    assert.match(response, /403 Forbidden/);
  } finally {
    proxy.close();
  }
});
