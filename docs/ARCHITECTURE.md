# Architecture

## The recording contract

The output is an independent canvas, not a screenshot of the editor. Every recorded visual is drawn by `drawComposition`; editor DOM is excluded by construction. Output dimensions never depend on workspace pan/zoom or responsive CSS dimensions.

Four coordinate spaces have separate ownership:

1. **Workspace:** source asset `x`, `y`, `boardWidth`; CSS translates/scales the spatial board.
2. **Source:** original image dimensions, document page, text, or decoded media frame.
3. **Presentation:** a scene’s layer rectangle, contain/cover fit, independent zoom and pan. Output layers and camera positions use normalized coordinates.
4. **Output:** actual canvas pixels, 1080 × 1920 or 720 × 1280.

`imageRect` is the shared fit/crop transform. Focus Lens edits scene layers, never source asset positions. Each scene owns a deep snapshot of the composition, presenter configuration, annotations, script, and transition. A short crossfade blends a snapshot of the previous output over the next scene.

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
- Add native MP4 conversion as an explicit optional module or service; preserve the source file and report progress/errors.
- Add on-device presenter segmentation only behind a capability/performance check.
- Move expensive PDF/GIF preprocessing into workers if profiling identifies contention.
- A native wrapper can reuse project, presentation, scene, and import models while replacing device/encoder bindings.
