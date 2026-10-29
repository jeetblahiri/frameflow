# Validation and release boundaries

Validated on 29 October 2026. This release is prepared for static HTTPS deployment. Physical iPad certification remains pending.

## Automated checks

- Strict TypeScript compilation: pass.
- Production static build: pass. The app and bundled assets also load beneath a `/frameflow/` repository subpath.
- Twenty-three frontend unit tests: pass, including shape-outline erasing, project schema validation and bounded archive expansion.
- Sixteen production browser workflow tests: pass in Brave 154.1.96.61 / Chromium 154 on macOS, with simulated camera and a generated WAV microphone input.
- Desktop visual inspection at 1440 × 960: pass; screenshot in `docs/studio.png`.
- Viewport checks at 1024 × 768, 768 × 1024, and 390 × 844: output remains 9:16, no horizontal document overflow, annotation controls work. These use a desktop engine and pointer input, not Safari or Apple Pencil.

The newest local Chrome 156 / Playwright browser had a native rendering stall even on a minimal standalone screenshot. The workflow suite used the installed Brave browser after a successful baseline check. The repository pins a stable Playwright release for reproducible CI installation. Local production workflows run against the compiled app at `/frameflow/` with the actual production CSP enforced. GitHub-hosted CI/deployment status must be checked separately after upload.

## Live website and presenter checks

- The studio defaults to a light color scheme with a white header, readable controls, and a clear preview. The content library, canvas board and inspector start closed. Each is reachable from the navigation bar.
- Shared presenter settings retain enabled state, position, scale and cutout mode through scene changes and reload. A pixel regression checks that camera pixels remain in the next scene.
- The production background-removal worker loads its local WASM/model under the enforced CSP. A real sample portrait smoke check retained the person and produced transparent background pixels; no camera uploads occur.
- A controlled live website confirms a 390 px inner viewport, form input, button interaction, page scrolling, annotation switching, capture compositing, and pause on sharing loss. Automated permission/stream behavior is deterministic; native Region Capture was additionally checked in a visible Brave/Chromium window, with the scrolled page color verified in the recording canvas. Element Capture was rejected after native testing produced stale whole-tab frames; the final implementation uses the verified Region Capture path.
- The browser-only regression covers passing a native controller into tab capture, binding wheel forwarding to the visible preview, stopping forwarding for annotations, preserving capture after scroll permission denial, and pausing on capture loss. Another regression covers browsers without CaptureController. Captured website pixels never go to an app backend.
- A separate visible native-browser test opens a real narrow window with noopener, captures a page with X-Frame-Options DENY, interacts with its form in the source window, forwards real wheel input from Frameflow, annotates, stops forwarding in annotation mode, and records a playable vertical video. Run with `npm run test:native-web` on desktop Chromium; this is separate from simulated CI capture.
- The exact reported ScienceAlert article was verified in a real local 430 × 819 browser window, then captured with zero iframe elements. A wheel gesture in the Frameflow preview moved the source page from scrollY 0 to 763; an annotated 1080 × 1920 video decoded successfully. No browser-rendering server was used.
- Recovery checks wait for a committed checkpoint before simulating interruption; empty interrupted sessions no longer advertise a recoverable take.
- Website audio, automatic scroll-anchored DOM marks, physical-device certification and long-session thermal behavior are not claimed. Browser-native capture and scroll control are feature-detected; unsupported browsers show source-window guidance.

## Production hardening

- PDF imports use the upstream compatibility build and matching worker, with an explicit regression check for browsers missing the newest Map APIs.
- PDF.js upgraded to 6.4.299 and Vitest to 5.0.5. The complete locked dependency graph reports zero known advisories with `npm audit` at validation time.
- All archive model and media checks finish before persistent writes. Media receives fresh keys and is written atomically, protecting the existing project from rejected archives.
- Both advertised and streamed archive expansion are bounded. Invalid references, coordinates, URL schemes, shapes and pages are rejected.
- Recording chunks and recovery metadata commit together. Failed native encoder startup can be retried without a stale recovery session. A 64 MB pending-write cap stops slow storage from causing unbounded queue growth.
- Production HTML enforces CSP; browser verification confirms that injected inline scripts are blocked while native recording, PDF rendering and media mixing continue to work.
- Dragging a file into the import dialog produces one asset, and the outer workspace correctly clears its drag overlay.
- GitHub Actions tests the production artifact before deploying it, retains browser evidence and never publishes pull requests.

## Acceptance evidence

| Requirement                             | Evidence                                                                                                                                                                                 |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Multiple asset types import             | Browser test imports self-contained SVG, text, a two-page PDF, WAV, and generated local WebM video                                                                                       |
| Independent infinite canvas arrangement | Pointer drag changes source coordinates and survives reload                                                                                                                              |
| Fixed vertical frame                    | Canvas attributes are 1080 × 1920; responsive viewport tests preserve 9:16                                                                                                               |
| Independent Focus Lens                  | Fit/fill/zoom changes are persisted without moving the source object                                                                                                                     |
| Crop and page navigation affect output  | Pixel test verifies the selected PDF page in the composition, allowing native color rounding                                                                                             |
| Annotations enter the composition       | Pointer strokes are drawn directly into the captured canvas while recording                                                                                                              |
| Camera and microphone together          | Browser simulated camera and generated microphone input recorded into a native playable take                                                                                             |
| Deliberate media mixing                 | Frequency analysis verifies distinct 220 Hz imported audio, 440 Hz microphone, and 660 Hz video audio; the first two continue after the video scene changes, while the video tone ceases |
| Visual changes preserve recording       | Scene navigation, annotation, pause, and resume all occur during one take                                                                                                                |
| Output is playable and vertical         | Native video element decodes the result; ffprobe confirms H.264, 1080 × 1920, DAR 9:16 and AAC stereo at 44.1 kHz in the tested browser                                                  |
| Native export and trim                  | Original and trimmed downloads complete; original take remains stored                                                                                                                    |
| Error feedback                          | Denied microphone access is surfaced with browser permission guidance; webpage recording requires explicit tab permission; capture loss pauses a take                                    |
| Persistence and portability             | Source metadata survives reload, and archive roundtrip restores imported media and scenes                                                                                                |
| Recovery                                | Reload during recording exposes saved chunks and produces a recovered take                                                                                                               |
| Physical iPad core workflow             | **Pending real-device validation**                                                                                                                                                       |

## Actual output inspection

The recording test produced a playable MP4 with one H.264 video stream at 1080 × 1920 and one AAC audio stream at 44.1 kHz stereo. Its duration was approximately four seconds, excluding the deliberate pause. FFmpeg decoded the audio and reported a non-silent signal. Output format is browser dependent; this does not imply MP4 support in every browser.

Run the tests to regenerate artifacts under `test-results/`. The recorded-take test saves its original and trimmed videos; the mixed-media test saves its output. Those generated artifacts and browser caches are intentionally ignored by Git.

## Real-device release checklist

Before describing the app as iPad validated, record the exact device model, iPadOS version, browser version, and results for:

- Camera and microphone permission denial, retry, selection, interruption and reconnection.
- A short take combining a PDF page, image, local video/audio, scene changes, presenter camera and persistent annotations.
- Landscape and portrait layouts, touch panning, two-finger workspace zoom, Apple Pencil drawing and accidental palm input.
- Long takes at 720p and 1080p with memory, thermal behavior, delivered frame rate and audio/video synchronization observed.
- Screen locking, tab switching, app switching, audio route changes and recovery after process termination.
- Playback and download of the actual encoded format in Files, Photos where supported, and the intended social publishing workflow.
- Project archive export/import with substantial local media, limited storage and private-browsing restrictions.
- Trim playback, cancellation and foreground interruption.

## Explicit MVP boundaries

- MP4 uses browser-native encoding only. There is no cross-browser MP4 conversion service.
- Browser-level recording and background suspension behavior cannot be overridden.
- Website browsing is local tab sharing or opt-in embedding. A narrow source window triggers responsive design where the site supports it; it does not guarantee a mobile user agent. In-preview scrolling requires Captured Surface Control in a supported desktop browser. Links and typing use the source window. Iframe-blocking headers cannot be overridden by this app.
- PPTX imports text; PDF preserves presentation visuals.
- Presenter background removal is bundled and processed locally at up to 15 fps; automatic captions are not included.
- GIF decoding is bounded to avoid unbounded live-animation memory. Large animations should be converted to local video.
- Storage recovery is best effort, dependent on written chunks and container recoverability. Download important takes and project archives.
