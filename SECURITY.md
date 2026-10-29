# Security and data boundaries

The studio is a local-first browser application. It does not send imported project files, camera frames, microphone audio or recordings to an application server. Direct media URL imports use credentials omitted. Live webpage URLs load in a sandboxed iframe; the source site may receive normal browser cookies subject to browser third-party cookie rules. Live recording requests explicit tab-sharing permission and crops to the output frame; tab audio is not requested. Camera segmentation uses a local worker, WASM and model. There is no analytics or account backend.

The production build includes a Content Security Policy, local PDF workers/fonts/decoders, self-contained SVG restrictions, bounded ZIP decompression, complete project-model validation and isolated media keys for project imports. Recording chunks and recovery metadata are committed together in IndexedDB transactions. Failed native encoder starts clear only their own empty recovery state.

Dependencies are locked, audited in CI and checked by Dependabot. Production deployment is gated on the tested build, and pull requests do not receive deployment permissions. No credentials belong in the repository or project archives.

Report security defects through the repository's private vulnerability reporting facility when available. Otherwise report a minimal issue without sensitive recordings, documents, credentials or personal data. Include the browser, reproduction steps and affected project version.

Browser storage can be evicted or cleared by the browser or device. Download important recordings and project backups. Real-device recording limits and known feature boundaries are documented in `docs/VALIDATION.md`.
