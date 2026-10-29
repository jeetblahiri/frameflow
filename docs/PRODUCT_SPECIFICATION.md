# FRAMEFLOW — Product and Engineering Master Specification

## Product vision

Build Frameflow, a polished, web-first spatial content creation and recording studio for producing educational Instagram Reels, YouTube Shorts, and other vertical videos.

Frameflow combines an infinite canvas, a universal content presentation system, a fixed vertical output frame, a live presenter camera, a teleprompter, annotation tools, and a reliable audiovisual recording engine.

The creator should be able to import almost any supported visual material, arrange it on an expansive canvas, bring any portion of that material into a fixed 9:16 presentation frame, explain it live, annotate it, switch to other content, and produce one continuous recording.

The defining principle is:

**Unlimited content. One constant frame. One continuous recording.**

The product must be web-first and exceptionally usable on iPad, including touch and stylus interactions.

## 1. Core interface

Build a three-region studio.

### Left: Content and asset library
- Import and organize assets.
- Search existing project content.
- Create text, shapes, labels, arrows, and diagrams.
- Access recent assets and reusable templates.
- Manage media and project files.

### Centre: Infinite canvas and fixed recording frame
- Provide a spatial canvas that can be panned and zoomed freely.
- Let the creator position and organize content anywhere.
- Place a persistent 9:16 recording viewport over the workspace.
- Make the viewport visually distinct from the surrounding canvas.
- Keep the output viewport fixed in size and aspect ratio even when the workspace is zoomed or panned.
- Allow the creator to navigate through canvas content without exposing editor controls in the final recording.

### Right: Script and recording controls
- Editable teleprompter.
- Recording duration and status.
- Camera and microphone controls.
- Audio level meters.
- Scene navigation.
- Annotation tools.
- Start, pause, resume, and stop recording.
- Device and recording settings.

Panels should collapse on smaller screens. On iPad, provide a touch-friendly studio layout with a compact toolbar and a prominent recording frame.

## 2. Universal content import

The system must not be designed around research papers or any single content category. Implement a modular asset system that can accommodate different media types.

Support the following where technically and legally feasible:

- Images and screenshots.
- Webpages and articles.
- Selected portions of webpages.
- PDFs and individual document pages.
- YouTube videos and other supported embedded video players.
- Local video files.
- Animated GIFs and supported animated media.
- SVG illustrations and diagrams.
- Charts and graphs.
- Plain text, headings, equations, and formatted text.
- Audio clips.
- Slides and presentations.
- Imported visual assets from the clipboard.
- Additional asset types through extensible import adapters.

Each asset type must have its own import, preview, rendering, and interaction logic.

Provide multiple import paths where appropriate: file picker, drag and drop, clipboard paste, URL import, and in-app creation.

A URL must not automatically be assumed to provide downloadable or embeddable media. Handle cross-origin restrictions, authentication, unsupported formats, and platform policies gracefully.

For unsupported live webpages, offer an appropriate fallback such as an imported screenshot, permitted page snapshot, or extracted content. For external video services, use permitted embedding or supported local media rather than promising unrestricted video extraction.

## 3. Universal presentation and focus system

Implement a reusable presentation engine that can display supported assets inside the fixed 9:16 output frame.

Every supported asset must be capable of being presented independently of the infinite canvas.

The creator must be able to:

- Select an asset.
- Bring it into the output frame.
- Fit, fill, crop, zoom, and pan it.
- Change its size and position.
- Move between pages or sections when supported.
- Display an asset full-frame or alongside other assets.
- Overlay the presenter camera.
- Annotate the content.
- Save and restore a particular presentation view.

Support a Focus Lens interaction: selecting an asset opens a presentation view that preserves the original canvas object while providing independent control over its appearance inside the output frame.

Maintain separate coordinate systems for the canvas, asset, presentation view, and final output.

Do not modify the source object when changing the presentation crop or zoom.

For multi-page documents, allow page navigation and multiple saved views of the same document. For screenshots, preserve the original pixels. For web articles, offer a readable mobile layout when extraction is reliable. For videos and animations, preserve playback behavior when supported.

## 4. Fixed recording frame

The output frame must maintain a 9:16 aspect ratio regardless of the surrounding interface.

Target export resolution: 1080 × 1920 pixels.

Allow lower-resolution preview rendering where necessary to maintain performance.

The output frame should be rendered independently of the editor interface using a dedicated composition engine.

Support:
- Background layers.
- Imported visual assets.
- Text and graphics.
- Video and animation layers.
- Presenter camera.
- Live annotations.
- Pointer effects.
- Optional branding and captions.

The composition must remain clean. Canvas navigation controls, selection handles, editor panels, the teleprompter, and tooltips must never leak into the output.

## 5. Continuous audiovisual recording — highest priority

Treat the recording engine as a foundational subsystem, not a secondary feature.

Implement a robust pipeline that captures the rendered composition and synchronizes it with the selected audio sources.

### Video recording
- Capture the dedicated composition surface.
- Maintain the requested output aspect ratio.
- Record scene transitions and supported animations.
- Include presenter video and live annotations.
- Continue recording while the creator navigates between assets and presentation views.
- Provide clear recording status and elapsed time.
- Handle temporary interruptions and device failures gracefully.
- Allow the user to preview and download the resulting recording.

### Audio recording

Support independent selection and control of:

1. Microphone input — the creator's narration.
2. Application or media audio — audio from supported videos or media sources when technically accessible and permitted.
3. Optional external audio inputs or imported audio tracks where supported.

Provide:
- Device selection.
- Permission handling.
- Input level meters.
- Microphone gain controls where available.
- Per-source mute and volume controls.
- A master output level.
- Audio monitoring where appropriate.
- Clipping warnings.
- Audio-video synchronization.
- Clear handling of unavailable audio sources.
- Configurable audio mixing.

Avoid unintended duplicate audio, feedback, clipping, and echo. Do not silently combine the same source twice.

The creator's microphone must continue recording while visual assets change. Supported video playback must not cause the recording to stop or reset.

Use a deliberate audio mixing pipeline, such as Web Audio API where supported, to combine the microphone and permitted media audio into a single recording track.

Do not assume that every external webpage, embedded YouTube player, or browser tab exposes its audio to the application. Validate actual media access and provide clear controls and fallbacks.

### Recording reliability

Before recording, allow the creator to verify the camera, microphone, media audio, and output composition.

During recording, display clear indicators for:
- Recording state.
- Elapsed time.
- Microphone activity.
- Audio clipping or device errors.
- Active media playback where relevant.

Handle unsupported codecs, permission denial, device disconnection, and recording failures with actionable messages.

Prefer a stable recording session that can be recovered where technically feasible.

Use MediaRecorder or another suitable browser-compatible approach after checking the capabilities of the current device and browser.

Support downloadable video in an appropriate format. Provide MP4 export through a supported native path or a reliable conversion process where required; do not assume all browsers natively produce MP4.

## 6. Presenter camera

Allow the creator to position their camera within the output frame.

Support:
- Circular overlay.
- Rounded rectangle.
- Square or rectangular overlay.
- Full-width presenter view.
- Adjustable size, position, border, and shadow.
- Camera selection.
- Horizontal mirroring in the preview.
- Optional background blur or removal.
- Per-scene presenter placement.

The camera overlay must be rendered into the final video.

Keep background removal optional so the application remains usable when real-time segmentation is unavailable or too expensive.

## 7. Live annotation

Support annotations directly on the presentation surface.

Tools:
- Freehand pen.
- Highlighter.
- Arrow.
- Circle and rectangle.
- Straight line.
- Laser pointer.
- Temporary pointer trail.
- Eraser.
- Clear annotations.

Support mouse, touch, and stylus input, with Apple Pencil as an important iPad use case.

Annotations must be included in the recorded output. Allow persistent annotations and temporary marks.

Separate content-navigation gestures from drawing gestures to prevent accidental marks while panning or zooming.

## 8. Scene navigation

Allow creators to prepare and save presentation states.

Each scene should preserve:
- Selected assets.
- Asset transforms and crops.
- Viewport position and zoom.
- Layer order.
- Presenter configuration.
- Annotation state where appropriate.
- Transition settings.
- Optional associated script section.

During recording, previous and next controls must switch between scenes without stopping the recording.

Support manual canvas exploration as well as prepared scene sequences.

Allow configurable transitions, including instant cuts and short crossfades where appropriate.

The output frame must remain fixed while its content changes.

## 9. Teleprompter

Provide an independent script editor with:
- Adjustable font size.
- Manual and optional automatic scrolling.
- Paragraph navigation.
- Script sections linked to scenes.
- Pause and resume controls.
- Touch-friendly interaction.
- Keyboard shortcuts.

Never include the script panel in the recording unless the creator deliberately adds script text as a visual asset.

## 10. iPad compatibility

Build a responsive, web-first application that is explicitly tested on supported iPad hardware and browser configurations.

Support:
- Touch-based canvas navigation.
- Pinch-to-zoom.
- Apple Pencil annotations.
- Large recording controls.
- Landscape studio mode.
- Portrait-friendly recording mode.
- Camera and microphone permissions.
- Local project persistence.
- Recovery after interruptions where feasible.

Do not rely on whole-screen recording to generate the final video. Render the composition inside the application itself.

Validate recording duration, memory consumption, background behavior, and export reliability on real target devices.

## 11. Technical architecture

Use React and TypeScript or an equivalent maintainable web stack.

Separate the system into modules:

- Spatial canvas.
- Asset import adapters.
- Asset renderer.
- Focus Lens and viewport transforms.
- Scene manager.
- Presenter camera.
- Annotation engine.
- Audio capture and mixing.
- Video composition and recording.
- Project persistence.
- Export and recovery.

Use a dedicated rendering surface, with Canvas or WebGL as appropriate.

Use IndexedDB for local project metadata and media where practical. Avoid unnecessary backend dependencies.

Use workers and media-processing optimizations where beneficial. Keep the architecture modular enough to support a native application later if browser limitations warrant it.

## 12. Visual design

Use a restrained, professional visual language.

- Dark neutral studio workspace.
- Clear separation between canvas and output frame.
- Subtle borders and alignment guides.
- Minimal decorative animation.
- Compact, predictable controls.
- Strong recording-status indicators.
- Readable typography.
- Touch-friendly controls on tablets.

Avoid a cluttered dashboard, excessive gradients, unnecessary floating panels, and decorative complexity.

## 13. MVP development sequence

### Phase 1: Validate the recording pipeline
Build a small working prototype that:
- Captures camera and microphone.
- Renders two or more visual assets into a fixed vertical frame.
- Changes the displayed asset during recording.
- Preserves audio-video synchronization.
- Exports a playable vertical video.

### Phase 2: Build the studio
Add the infinite canvas, image imports, presenter placement, script panel, and local project persistence.

### Phase 3: Add universal presentation
Implement Focus Lens, independent zoom and crop, PDF support, webpage snapshots, video playback, and saved scenes.

### Phase 4: Add production tools
Implement live annotations, audio-source mixing, background removal, transitions, and basic trimming.

### Phase 5: Validate iPad workflows
Test the complete experience on actual iPad hardware, including long recordings, stylus interactions, device permissions, audio playback, export, and session recovery.

## 14. Acceptance criteria

The application is not complete merely because its interface looks correct.

Demonstrate that:
1. Multiple supported asset types can be imported.
2. Assets can be arranged independently on the infinite canvas.
3. The output frame remains fixed at 9:16.
4. Any supported asset can be brought into the frame without moving its original canvas object.
5. Zoom, pan, crop, and annotations affect the intended output.
6. Camera and microphone work together.
7. Supported media audio can be mixed without duplicate playback or obvious synchronization problems.
8. Visual changes do not interrupt recording.
9. The final video contains the intended composition, presenter, annotations, and audio.
10. The exported file plays correctly and has the intended aspect ratio.
11. Recording errors are surfaced clearly.
12. The core workflow is tested on a supported iPad configuration.
13. No essential control is merely decorative or nonfunctional.

Begin with the recording pipeline and a working end-to-end prototype. Then build the canvas, asset system, and advanced interactions around it.

The primary measure of success is how quickly and reliably a creator can turn arbitrary source material into a coherent, informative vertical video without repeatedly stopping to edit.