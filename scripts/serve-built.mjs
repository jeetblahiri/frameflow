import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
const root = resolve('dist'),
  prefix = '/frameflow/',
  port = Number(process.env.PORT || 4173);
const html = await readFile(resolve(root, 'index.html'), 'utf8');
const policy = html
  .match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)?.[1]
  ?.replaceAll('&#39;', "'")
  .replaceAll('&amp;', '&');
if (!policy) throw new Error('Build the production app before running the production server.');
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.wasm': 'application/wasm',
  '.bcmap': 'application/octet-stream',
  '.txt': 'text/plain; charset=utf-8',
};
createServer(async (req, res) => {
  res.setHeader('Content-Security-Policy', `${policy}; frame-ancestors 'none'`);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(self), microphone=(self), display-capture=()');
  res.setHeader('X-Frame-Options', 'DENY');
  try {
    const path = new URL(req.url, 'http://localhost').pathname;
    if (path === '/frameflow') {
      res.writeHead(308, { Location: prefix });
      res.end();
      return;
    }
    if (!['GET', 'HEAD'].includes(req.method) || !path.startsWith(prefix)) {
      res.writeHead(404);
      res.end();
      return;
    }
    const name = decodeURIComponent(path.slice(prefix.length)) || 'index.html';
    const file = resolve(root, name);
    if (!file.startsWith(`${root}${sep}`)) {
      res.writeHead(403);
      res.end();
      return;
    }
    const info = await stat(file);
    if (!info.isFile()) throw new Error('Not a file');
    res.setHeader('Content-Type', mime[extname(file)] || 'application/octet-stream');
    res.setHeader('Content-Length', info.size);
    res.setHeader(
      'Cache-Control',
      name.startsWith('assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
    );
    res.writeHead(200);
    if (req.method === 'HEAD') res.end();
    else createReadStream(file).pipe(res);
  } catch {
    res.writeHead(404);
    res.end();
  }
}).listen(port, '127.0.0.1', () =>
  console.log(`Production preview: http://127.0.0.1:${port}${prefix}`),
);
