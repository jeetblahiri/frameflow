import server from './api/browser.mjs';
server.listen(Number(process.env.BROWSER_PORT || 4317), '127.0.0.1', () =>
  console.log('Frameflow browser service ready on http://127.0.0.1:4317'),
);
