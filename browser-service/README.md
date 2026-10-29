# Frameflow mobile browser service

This optional Node.js service opens real webpages in isolated mobile Chromium contexts and streams viewport JPEG frames over WebSocket. The frontend composites these frames with the local camera and annotations. It does not depend on third-party iframe permission and does not receive local camera, microphone, imported files or recorded videos.

The frontend is intentionally shipped with `public/browser-config.json` set to `{"endpoint":""}`. Deploy and enable a service only after choosing this data flow explicitly. The UI offers local website-tab sharing when the service is not configured.

## Local development

Requires Node 22.13+, an installed Chromium-compatible browser, and the normal frontend dependencies.

```sh
npm ci --prefix browser-service
FRAMEFLOW_BROWSER_EXECUTABLE='/path/to/Chrome' node browser-service/server.mjs
VITE_BROWSER_SERVICE_URL=http://127.0.0.1:4317 npm run dev
```

Alternatively serve the frontend with a local configuration response identifying that loopback endpoint. Production tests supply this response only inside their isolated test browser. The test fixture rejects iframe embedding and exercises real browser input/rendering through the service.

## Vercel deployment

Deploy this directory as a Node.js project with Node 22, the included `vercel.json`, and `api/browser.mjs` as the function. The Chromium package's compressed runtime is included explicitly and unpacked into ephemeral runtime storage. WebSocket connections stay with the function instance. The 270-second session cap fits within the configured 300-second function duration. Production origins default to `https://jeetblahiri.github.io`; set `ALLOWED_ORIGINS` explicitly for other frontend origins.

After verifying `/health` and a real browser session on the deployed host, set the frontend's `public/browser-config.json` endpoint to that HTTPS origin. This configuration is public and contains no secret. Do not put API keys, cookies, or personal browsing state there. Local development may use `VITE_BROWSER_SERVICE_URL`; it is also a public build setting.

## Boundaries

- Each connection launches an independent browser/context; storage is fresh, downloads are cancelled, permissions do not expose local devices, and disconnect closes the session.
- The server accepts narrow navigation, mouse, scroll, keyboard, text and reader commands, never arbitrary JavaScript or filesystem requests.
- The egress proxy validates public destinations and connects to the resolved checked IP, avoiding DNS-rebinding between validation and connection. Private, loopback, reserved and metadata network addresses are rejected. Nonstandard ports and embedded credentials are rejected.
- `FRAMEFLOW_BROWSER_TEST=1` permits only loopback fixtures during local tests. It is always ignored in Vercel production.
- The service limits message size, connection rates, simultaneous browsers, frame buffers, network sockets and session lifetime. Additional account-wide limits and authentication are appropriate before opening a commercial browser service to many users.
- Source sites can require sign-in, verification, or decline access. The service does not remove their security headers, decrypt protected media, or import personal browser profiles.
- Website pixels update around 5–8 fps, depending on page cost and network speed. Webpage audio and file uploads are not included. Annotation positions are fixed to the recording frame.
- Reader view copies text and HTTP/HTTPS image URLs into a simple temporary layout. Reload restores the original page.

Run `npm test --prefix browser-service` for the address/proxy regression tests. Root `npm run test:production` starts the service and an isolated iframe-denying fixture automatically; install the service dependencies first.
