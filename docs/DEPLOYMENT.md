# Production deployment

Frameflow serves static files and keeps creator media in the browser. It requires HTTPS for camera and microphone access. No application secrets, backend, or account database is required.

## GitHub Pages

Repository: https://github.com/jeetblahiri/frameflow

1. In the repository's **Settings → Pages → Build and deployment**, choose **GitHub Actions** as the source. This is a one-time repository administration action; the workflow's standard `GITHUB_TOKEN` cannot enable Pages itself.
2. Push to `main`, or manually run **Validate and deploy Frameflow** from Actions.
3. The workflow pins Ubuntu 24.04 for supported browser dependencies, audits dependencies, checks TypeScript, runs unit tests, and runs browser workflows against the compiled app under `/frameflow/` with its production content policy enforced.
4. Only after all checks pass does the deployment job publish that same `dist/` artifact. Pull requests never deploy. Browser evidence is retained for seven days.
5. Follow the `github-pages` environment link shown by the deployment job. The expected default URL is https://jeetblahiri.github.io/frameflow/; verify the workflow and actual HTTP response before treating it as live.

Do not add a personal token to this project just to run the deployment. After Pages is enabled, GitHub supplies the narrowly scoped `pages:write` and `id-token:write` token to the deployment job.

## Other static hosts

Run `npm ci && npm run build` on Node.js 22.13 or later and deploy all of `dist/`. Keep the bundled PDF resources, fonts and license notices. The build uses relative asset URLs for repository subpaths.

The generated HTML enforces a Content Security Policy which permits the application's local media and PDF WebAssembly decoder while blocking inline scripts, JavaScript eval, plugins and embedded frames. Inline styles are needed to position canvas objects. External HTTPS/HTTP fetches are permitted for explicit URL imports and still require source CORS permission.

Hosts that support custom response headers should also set `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`, `Permissions-Policy: camera=(self), microphone=(self), display-capture=(self)`, and `frame-ancestors 'none'` in the CSP header. GitHub Pages does not expose arbitrary response-header configuration; the HTML policy is the portable enforcement mechanism.

## Local production verification

```bash
npm ci
npx playwright install chromium --only-shell
npm run check
npm test
npm run test:production
```

To inspect the compiled app manually, run `npm run serve:production` after building and open http://127.0.0.1:4173/frameflow/. This server binds to loopback and is intended for local verification, not internet hosting.

## Rollback and device data

Revert the offending commit and push to `main`; the previous source is rebuilt, tested and published. Keep the same origin and path. Browser project data and takes are not deployed, copied or erased by a code rollback, though future schema migrations require explicit compatibility handling.

Physical iPad, Apple Pencil, long-session thermal/memory, background suspension and device-routing validation remain release gates for a claim of iPad certification. See [VALIDATION.md](VALIDATION.md).
