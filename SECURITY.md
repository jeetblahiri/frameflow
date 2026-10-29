# Security and data boundaries

The studio is a browser-only application. Imported project files, shared-tab pixels, camera frames, microphone audio and recordings are processed on the device and are not uploaded to an application server. Direct media URL imports use credentials omitted. Website tabs load normally in the user's own browser and make their usual requests to that website; Frameflow cannot inspect their cookies or bypass website sign-in, CAPTCHA or embedding restrictions. No browser-rendering backend, session endpoint, telemetry or account service is included.

Tab capture starts only from an explicit click through the browser's sharing picker. Only browser-tab sources are accepted; website audio is not requested. Where available, CaptureController forwards wheel input to the chosen tab after a separate user gesture and browser permission. Annotation mode, disconnect and unmount stop forwarding. Unsupported or denied scroll control preserves capture and gives source-window guidance. Links and typing are handled in the source window. Narrow website windows use noopener/noreferrer. Optional iframe mode respects X-Frame-Options and frame-ancestors; camera, microphone, geolocation, display capture and payment are disabled in embedded websites. Camera segmentation uses a bundled local worker, WASM and model.

The production build includes a Content Security Policy, local PDF workers/fonts/decoders, self-contained SVG restrictions, bounded ZIP decompression, complete project-model validation and isolated media keys for project imports. Recording chunks and recovery metadata are committed together in IndexedDB transactions. Failed native encoder starts clear only their own empty recovery state.

Dependencies are locked, audited in CI and checked by Dependabot. Production deployment is gated on the tested build, and pull requests do not receive deployment permissions. No credentials belong in the repository or project archives.

Report security defects through the repository's private vulnerability reporting facility when available. Otherwise report a minimal issue without sensitive recordings, documents, credentials or personal data. Include the browser, reproduction steps and affected project version.

Browser storage can be evicted or cleared by the browser or device. Download important recordings and project backups. Real-device recording limits and known feature boundaries are documented in `docs/VALIDATION.md`.
