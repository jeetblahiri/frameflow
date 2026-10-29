# Architecture

## The recording contract

The output is an independent canvas, not a screenshot of the editor. Every recorded visual is drawn by `drawComposition`; local-media scenes exclude editor DOM by construction. Website scenes composite a local shared-tab video with presenter and marks. Opt-in embedded mode uses explicit permission-driven Region Capture of the visible output frame, including its iframe and overlay canvas. Output dimensions never depend on workspace pan/zoom or responsive CSS dimensions.

Four coordinate spaces have separate ownership:

1. **Workspace:** source asset `x`, `y`, `boardWidth`; CSS translates/scales the spatial board.
2. **Source:** original image dimensions, document page, text, or decoded media frame.
3. **Presentation:** a scene’s layer rectangle, contain/cover fit, independent zoom and pan. Output layers and camera positions use normalized coordinates.
4. **Output:** actual canvas pixels, 1080 × 1920 or 720 × 1280.

`imageRect` is the shared fit/crop transform. Focus Lens edits scene layers, never source asset positions. Each scene owns a deep snapshot of its layers, annotations, script, and transition. An optional project-level presenter configuration is shared across scenes and synchronized into scene camera data for backward compatibility. Older projects without that field adopt the active presenter on the first edit or camera activation. A short crossfade blends a snapshot of the previous output over the next scene.

`project-updates` applies asset and scene deletion as one project transformation. It removes source references everywhere, prunes only views emptied by that asset deletion, keeps surviving overlays and intentional blank views, and selects a neighbouring active scene. Removing the final view resets it to an empty working scene while retaining the shared presenter. The scene strip derives numbering and selection from this same project state. Source membership changes also pause inactive video elements without replacing the microphone or recorder.

The teleprompter replaces the normal navigation row with a fixed-height reader centered on the preview. It is a sibling of the workspace and sits outside the Region Capture rectangle. Its edit dialog uses the same overlay lifecycle as the studio dialogs; active embedded capture pauses before editing. Reading settings stay separate from scene script data, while scene changes reset the reading position before paint. Reading also pauses while studio dialogs are open.

## Live websites and presenter processing

The preview measures its available workspace, preserves the 9:16 border and keeps labels/footer in separate grid rows. Website controls share the ordinary fixed-height toolbar. A viewport-height loss during the native capture permission transaction is reclaimed from preview margins, bounded by actual available space. A later window resize restores ordinary responsive fitting. None of this changes the recording canvas dimensions or composition coordinates.

`useWebCapture` owns browser-native sharing, its muted decoding video, and an optional CaptureController. It opens a narrow local website window on an explicit click with noopener/noreferrer, then requests a browser-tab source through getDisplayMedia on a separate click. It does not fetch, proxy or host webpages. Window sizing is a browser hint and does not override the website's user agent.

When Captured Surface Control is available, **Scroll here** invokes `forwardWheel(previewCanvas)` directly from a click so the browser can ask for permission. It forwards actual wheel gestures to the shared tab without DOM access to the third-party website. Annotation mode, a drawing tool, disconnect and unmount call `forwardWheel(null)`. Generation counters invalidate pending capture and scroll requests. Permission denial or lack of support leaves the video source available with source-window scrolling instructions. Clicks, typing and page controls stay in the original website window. Capture is bound to the selected website asset; presenting a different website disconnects the old source and pauses a take. Website source changes do not recreate the local recorder.

Optional iframe mode is selected explicitly and respects frame-ancestors/X-Frame-Options. Iframe load events are not treated as proof that an external site rendered. Region Capture narrows embedded captures to the visible output border and validates decoded dimensions before recording. The preview does not display its own captured stream, preventing a feedback loop. In that mode the recording canvas copies the crop without applying presenter/marks twice. Shared-tab mode uses the ordinary compositor with the camera and annotations drawn once. Sharing loss pauses an active take. No backend, cloud browser or session configuration is included.

`PresenterProcessor` bounds background-removal work to one transferred frame at a time in a classic worker. MediaPipe's pinned local model and WASM generate alpha-masked frames at up to 15 fps and a maximum 640-pixel source width; the 30 fps compositor reuses the last complete frame. The worker closes input and replaced output bitmaps. Loading/failure status is surfaced and original camera pixels are never silently substituted while removal is selected.

## Media and audio ownership

`MediaLibrary` owns the decoded resources and HTML media elements. PDF.js is dynamically imported, uses a bundled worker, and renders selected pages at bounded resolution. GIFs are composited from decoded patches with disposal handling. Self-contained local media prevents an imported external reference from tainting the output canvas.

`AudioMixer` owns one long-lived AudioContext:

```text
microphone → mic gain ─────────────┐
                                  ├→ master gain → limiter → stream destination → recorder
media elements → media gain ──────┘
                         └→ monitor gain → speakers
```

Microphone analysis and pre-limiter master analysis drive actual meters and clipping warnings. Microphone monitoring is intentionally absent. Each HTML media element connects to the audio graph once via a WeakMap. Supported video scene changes pause inactive video playback while keeping the microphone, destination track, and MediaRecorder intact. Imported audio playback can continue across scene changes.

Devices are requested separately. A replacement microphone connects to the existing mixer while the recording’s destination track stays stable. Unexpected microphone disconnection pauses an active take. Camera disconnection removes the presenter and surfaces an error while the remaining composition remains usable.

## Recording and recovery

`StudioRecorder` creates a canvas capture track and adds the mixer’s destination audio track. MIME selection checks `MediaRecorder.isTypeSupported`. The session progresses through idle → starting → recording ↔ paused → stopping → idle. Only the capture video track is stopped when a take ends; device inputs remain available for the next take.

One-second `dataavailable` events queue atomic chunk-and-metadata transactions into IndexedDB. If the pending write queue exceeds 64 MB, recording stops and saves the captured portion instead of growing without a bound. Failed encoder starts clear their own empty recovery state. The session metadata identifies the pending take and chunk sequence. Finalization awaits queued writes, assembles the native container, stores the completed take, and clears successfully consumed recovery data. A browser restart can assemble the remaining chunks as a recovered take. A partial container may not always be playable; no unsupported durability guarantee is made.

Visibility changes pause an active take. `beforeunload` requests a final available chunk and provides the browser’s leave-page guard. These improve recovery but cannot override browser process termination or iOS suspension rules.

Trimming plays a selected interval into a separate canvas and audio destination and encodes it in real time. Cancellation or background interruption stops the trim; the original take remains stored.

## Persistence and portable files

IndexedDB stores project metadata, original media blobs, completed takes, pending session metadata, and recording chunks. Blob object URLs are runtime-only. On load, original media is read from IndexedDB and assigned fresh URLs.

A `.frameflow` file is a ZIP with `project.json` and `media/<blob-key>`. Import checks the ZIP directory and actual streamed output against size limits, then validates the entire supported schema, scene/layer values, media existence, supported asset kinds, URL schemes, and SVG safety constraints before writing anything. Valid media is committed in one transaction under freshly generated keys, so an archive cannot overwrite existing source files. The archive intentionally excludes recorded takes; download videos separately. Local storage is versioned at schema version 1.

## Extending the MVP

- Add another import adapter with its own file validation and renderer support.
- Add migrations before increasing the project/database schema version.
- Add browser-local MP4 conversion as an explicit optional module; preserve the source file and report progress/errors.
- Move expensive PDF/GIF preprocessing into workers if profiling identifies contention.
- A native wrapper can reuse project, presentation, scene, and import models while replacing device/encoder bindings.
