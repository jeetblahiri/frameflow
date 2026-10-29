import http from 'node:http';
import { WebSocketServer } from 'ws';
import { chromium as playwright } from 'playwright-core';
import { createEgressProxy, websiteUrl } from '../network.mjs';
import { showReader } from '../reader.mjs';

const allowed = new Set(
  (
    process.env.ALLOWED_ORIGINS ||
    (process.env.VERCEL
      ? 'https://jeetblahiri.github.io'
      : 'https://jeetblahiri.github.io,http://127.0.0.1:4173,http://127.0.0.1:5173')
  ).split(','),
);
const limits = new Map();
let active = 0;
const MAX_SESSION = 270000;
export const server = http.createServer((req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (allowed.has(req.headers.origin))
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }
  if (req.url === '/health' || req.url === '/api/browser/health' || req.url === '/api/browser') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', version: '0.4.0', sessionSeconds: MAX_SESSION / 1000 }));
    return;
  }
  res.writeHead(404);
  res.end();
});
const wss = new WebSocketServer({ noServer: true, maxPayload: 16384, perMessageDeflate: false });
server.on('upgrade', (req, socket, head) => {
  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '')
    .toString()
    .split(',')[0];
  const now = Date.now();
  for (const [key, value] of limits) if (now - value.start > 60000) limits.delete(key);
  const rate = limits.get(ip) || { start: now, count: 0 };
  rate.count++;
  limits.set(ip, rate);
  if (!allowed.has(req.headers.origin) || active >= 2 || rate.count > 6 || limits.size > 5000) {
    socket.end('HTTP/1.1 429 Too Many Requests\r\n\r\n');
    return;
  }
  wss.handleUpgrade(req, socket, head, (ws) => {
    active++;
    wss.emit('connection', ws);
  });
});
wss.on('connection', (ws) => {
  let browser, context, page, cdp, proxy, watchdog, frameTimer;
  let started = false,
    closed = false,
    busy = false,
    lastInput = 0,
    pressed = false;
  const send = (value) => {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(value));
  };
  const cleanup = async () => {
    if (closed) return;
    closed = true;
    active--;
    clearTimeout(watchdog);
    clearTimeout(frameTimer);
    await context?.close().catch(() => {});
    await browser?.close().catch(() => {});
    proxy?.close();
  };
  ws.on('close', () => void cleanup());
  ws.on('error', () => void cleanup());
  watchdog = setTimeout(() => {
    send({
      type: 'expired',
      message: 'The private browser session has ended. Reconnect to start a fresh session.',
    });
    ws.close(1000, 'Session expired');
  }, MAX_SESSION);
  ws.on('message', async (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }
    try {
      if (msg.type === 'start') {
        if (started) return;
        started = true;
        const url = websiteUrl(msg.url);
        send({ type: 'status', message: 'Starting your mobile browser…' });
        proxy = await createEgressProxy();
        let options = { headless: true, proxy: { server: proxy.server, bypass: '<-loopback>' } };
        if (process.env.VERCEL) {
          const { default: chromium } = await import('@sparticuz/chromium');
          options = {
            ...options,
            executablePath: await chromium.executablePath(),
            args: [
              ...chromium.args.filter(
                (arg) =>
                  !arg.startsWith('--disable-web-security') &&
                  !arg.startsWith('--proxy-server') &&
                  !arg.startsWith('--proxy-bypass-list'),
              ),
              '--force-webrtc-ip-handling-policy=disable_non_proxied_udp',
            ],
          };
        } else {
          options = {
            ...options,
            ...(process.env.FRAMEFLOW_BROWSER_EXECUTABLE
              ? { executablePath: process.env.FRAMEFLOW_BROWSER_EXECUTABLE }
              : {}),
            args: ['--disable-gpu', '--force-webrtc-ip-handling-policy=disable_non_proxied_udp'],
          };
        }
        browser = await playwright.launch(options);
        if (closed) {
          await browser.close();
          proxy.close();
          return;
        }
        context = await browser.newContext({
          viewport: { width: 390, height: 693 },
          deviceScaleFactor: 2,
          isMobile: true,
          hasTouch: true,
          userAgent:
            'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
        });
        await context.route('**/*', async (route) => {
          try {
            websiteUrl(route.request().url());
            await route.continue();
          } catch {
            await route.abort();
          }
        });
        page = await context.newPage();
        page.on('dialog', (dialog) => void dialog.dismiss());
        context.on('page', (popup) => {
          if (popup !== page) {
            const url = popup.url();
            void popup.close();
            if (/^https?:/.test(url)) void navigate(url);
          }
        });
        page.on('download', (download) => void download.cancel());
        page.on('crash', () => {
          send({
            type: 'error',
            message:
              'This page exceeded the browser limits. Reconnect or share the website tab instead.',
          });
          ws.close();
        });
        cdp = await context.newCDPSession(page);
        await cdp.send('Page.enable');
        const capture = async () => {
          if (closed) return;
          try {
            if (ws.readyState === ws.OPEN && ws.bufferedAmount < 512000) {
              const frame = await page.screenshot({
                type: 'jpeg',
                quality: 80,
                fullPage: false,
                scale: 'device',
                caret: 'initial',
                timeout: 4000,
              });
              if (ws.readyState === ws.OPEN) ws.send(frame);
            }
          } catch {
            /* Navigation may replace the current frame; retry the next complete image. */
          }
          if (!closed) frameTimer = setTimeout(capture, 100);
        };
        void capture();
        await navigate(url.href);
      } else if (page && !closed) {
        if (Date.now() - lastInput < 8 && msg.type === 'move') return;
        lastInput = Date.now();
        const x = Math.max(0, Math.min(389, Number(msg.x) || 0));
        const y = Math.max(0, Math.min(692, Number(msg.y) || 0));
        if (msg.type === 'down') pressed = true;
        if (msg.type === 'up') pressed = false;
        if (['down', 'up', 'move'].includes(msg.type))
          await cdp.send('Input.dispatchMouseEvent', {
            type:
              msg.type === 'down'
                ? 'mousePressed'
                : msg.type === 'up'
                  ? 'mouseReleased'
                  : 'mouseMoved',
            x,
            y,
            button: msg.type === 'move' && !pressed ? 'none' : 'left',
            buttons: pressed ? 1 : 0,
            clickCount: msg.type === 'move' ? 0 : 1,
          });
        else if (msg.type === 'scroll')
          await cdp.send('Input.dispatchMouseEvent', {
            type: 'mouseWheel',
            x,
            y,
            deltaX: Math.max(-2000, Math.min(2000, Number(msg.dx) || 0)),
            deltaY: Math.max(-2000, Math.min(2000, Number(msg.dy) || 0)),
          });
        else if (msg.type === 'text' && typeof msg.text === 'string')
          await cdp.send('Input.insertText', { text: msg.text.slice(0, 2000) });
        else if (msg.type === 'key' && typeof msg.key === 'string' && msg.key.length < 32) {
          await page.keyboard.press(msg.key);
        } else if (msg.type === 'reader') {
          const info = await showReader(page);
          send({ type: 'ready', ...info });
        } else if (msg.type === 'navigate') await navigate(msg.url);
        else if (!busy && ['back', 'forward', 'reload'].includes(msg.type)) {
          busy = true;
          try {
            if (msg.type === 'back')
              await page.goBack({ waitUntil: 'domcontentloaded', timeout: 20000 });
            else if (msg.type === 'forward')
              await page.goForward({ waitUntil: 'domcontentloaded', timeout: 20000 });
            else await page.reload({ waitUntil: 'domcontentloaded', timeout: 20000 });
            send({ type: 'ready', url: page.url(), title: await page.title() });
          } finally {
            busy = false;
          }
        }
      }
    } catch (error) {
      send({
        type: 'error',
        message: error.message?.includes('ERR_BLOCKED')
          ? 'The website could not be opened. Try sharing it from your browser instead.'
          : 'This page could not be opened in the live browser. Try again or share the website tab.',
      });
      if (!page) ws.close(1011, 'Browser unavailable');
    }
  });
  async function navigate(input) {
    if (busy) return;
    busy = true;
    try {
      const url = websiteUrl(input);
      send({ type: 'status', message: 'Loading the mobile page…' });
      await page.goto(url.href, { waitUntil: 'domcontentloaded', timeout: 30000 });

      send({
        type: 'ready',
        url: page.url(),
        title: await page.title(),
        expiresAt: Date.now() + MAX_SESSION,
      });
    } finally {
      busy = false;
    }
  }
});
export default server;
