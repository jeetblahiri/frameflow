import http from 'node:http';
import net from 'node:net';
import { lookup } from 'node:dns/promises';
import ipaddr from 'ipaddr.js';

export function publicAddress(address) {
  try {
    return ipaddr.process(address).range() === 'unicast';
  } catch {
    return false;
  }
}
export function websiteUrl(input) {
  const url = new URL(input);
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.href.length > 8192
  )
    throw new Error('Enter a public HTTP or HTTPS website without embedded credentials.');
  if (
    url.port &&
    !['80', '443'].includes(url.port) &&
    !(process.env.FRAMEFLOW_BROWSER_TEST === '1' && !process.env.VERCEL)
  )
    throw new Error('This browser supports standard website ports only.');
  return url;
}
async function destination(host, port) {
  host = host.replace(/^\[|\]$/g, '');
  if (process.env.FRAMEFLOW_BROWSER_TEST === '1' && !process.env.VERCEL && host === '127.0.0.1')
    return { address: host, family: 4, port };
  const addresses = net.isIP(host)
    ? [{ address: host, family: net.isIP(host) }]
    : await lookup(host, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(({ address }) => !publicAddress(address)))
    throw new Error('Private and local network destinations are not allowed.');
  return { ...(addresses.find((a) => a.family === 4) || addresses[0]), port };
}
/** Resolve, validate, then connect to the checked IP: Chromium never resolves origin hosts itself. */
export async function createEgressProxy() {
  const sockets = new Set();
  const proxy = http.createServer(async (req, res) => {
    let outgoing;
    try {
      const url = websiteUrl(req.url);
      const dest = await destination(url.hostname, Number(url.port) || 80);
      const headers = { ...req.headers, host: url.host };
      delete headers['proxy-authorization'];
      delete headers['proxy-connection'];
      outgoing = http.request(
        {
          hostname: dest.address,
          family: dest.family,
          port: dest.port,
          method: req.method,
          path: url.pathname + url.search,
          headers,
          timeout: 20000,
        },
        (response) => {
          res.writeHead(response.statusCode || 502, response.headers);
          response.pipe(res);
        },
      );
      outgoing.on('error', () => {
        if (!res.headersSent) res.writeHead(502);
        res.end();
      });
      outgoing.on('timeout', () => outgoing.destroy());
      req.on('aborted', () => outgoing.destroy());
      req.pipe(outgoing);
    } catch {
      res.writeHead(403);
      res.end('Destination unavailable');
    }
  });
  proxy.on('connect', async (req, client, head) => {
    try {
      const url = websiteUrl(`https://${req.url}`);
      const dest = await destination(url.hostname, Number(url.port) || 443);
      const upstream = net.connect({ host: dest.address, family: dest.family, port: dest.port });
      sockets.add(upstream);
      upstream.setTimeout(45000, () => upstream.destroy());
      upstream.once('connect', () => {
        client.write('HTTP/1.1 200 Connection Established\r\n\r\n');
        if (head.length) upstream.write(head);
        upstream.pipe(client);
        client.pipe(upstream);
      });
      upstream.on('error', () => client.destroy());
      client.on('error', () => upstream.destroy());
      client.on('close', () => upstream.destroy());
      upstream.on('close', () => {
        sockets.delete(upstream);
        client.destroy();
      });
    } catch {
      client.end('HTTP/1.1 403 Forbidden\r\n\r\n');
    }
  });
  proxy.on('connection', (socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    if (sockets.size > 100) socket.destroy();
  });
  await new Promise((resolve) => proxy.listen(0, '127.0.0.1', resolve));
  return {
    server: `http://127.0.0.1:${proxy.address().port}`,
    close: () => {
      sockets.forEach((s) => s.destroy());
      proxy.close();
    },
  };
}
