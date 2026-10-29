# Contributing

Use Node.js 22.13+ and `npm ci`. Keep source-media coordinates separate from presentation transforms, and keep editor DOM out of the composition renderer.

Before submitting a pull request:

```bash
npm run check
npm test
npm run build
npx playwright install chromium --only-shell
npm run test:production
```

Use `npm run format` for consistent formatting. Explain the behavior change and relevant verification in the PR. Recording, device, persistence, and import changes need a test of the actual user workflow. Visual-only changes can use a focused browser check.

Do not add credentials, media with unclear reuse rights, or recordings of people to fixtures. Use generated images/audio and simulated browser devices. Do not claim physical-device coverage from viewport emulation. Update `docs/VALIDATION.md` when adding hardware verification.
