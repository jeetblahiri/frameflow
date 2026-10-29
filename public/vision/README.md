# Local presenter segmentation

- Runtime: `@mediapipe/tasks-vision` 0.10.32, Apache-2.0. The build copies the locked runtime and WASM files from node_modules; no CDN is used at runtime.
- Model: Google MediaPipe SelfieSegmenter landscape, float16, version 1.
- Source: https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter_landscape/float16/1/selfie_segmenter_landscape.tflite
- SHA-256: `490e9ea734313e0de10fa0cd9e3c6133e36ea4db2b7a49bde9ef019f72796b8e`
- Model documentation: https://ai.google.dev/edge/mediapipe/solutions/vision/image_segmenter

The classic worker loads the CommonJS bundle into an explicit exports object. Using a classic worker allows the upstream Emscripten WASM loader to use importScripts under the production CSP. Frames are transferred at up to 15 fps with one in flight, processed at a maximum 640-pixel width, and returned with an alpha channel. The last complete processed frame is drawn into the 30 fps compositor. Both input and replaced output ImageBitmaps are closed. Camera pixels are never transmitted to a server.
