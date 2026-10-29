/* MediaPipe runs in a dedicated worker. Camera frames never leave this device. */
self.exports = {};
importScripts('./vision_bundle.js');
let segmenter;
let canvas;
let context;
let maskCanvas;
let maskContext;
self.onmessage = async ({ data }) => {
  if (data.type === 'init') {
    try {
      const files = await self.exports.FilesetResolver.forVisionTasks(
        new URL('./wasm', self.location.href).href,
      );
      segmenter = await self.exports.ImageSegmenter.createFromOptions(files, {
        baseOptions: {
          modelAssetPath: new URL('./selfie_segmenter_landscape.tflite', self.location.href).href,
          delegate: 'CPU',
        },
        runningMode: 'VIDEO',
        outputConfidenceMasks: true,
        outputCategoryMask: false,
      });
      canvas = new OffscreenCanvas(640, 360);
      context = canvas.getContext('2d');
      maskCanvas = new OffscreenCanvas(256, 144);
      maskContext = maskCanvas.getContext('2d');
      self.postMessage({ type: 'ready' });
    } catch (error) {
      self.postMessage({ type: 'error', message: String(error) });
    }
    return;
  }
  if (data.type !== 'frame') return;
  const image = data.image;
  try {
    if (!segmenter) throw new Error('Background removal is not ready.');
    canvas.width = image.width;
    canvas.height = image.height;
    context.globalCompositeOperation = 'source-over';
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0);
    segmenter.segmentForVideo(image, data.time, (result) => {
      // The selfie model exposes one foreground mask (some models expose background + person).
      const masks = result.confidenceMasks;
      const mask = masks[masks.length === 1 ? 0 : 1];
      const values = mask.getAsFloat32Array();
      maskCanvas.width = mask.width;
      maskCanvas.height = mask.height;
      const pixels = maskContext.createImageData(mask.width, mask.height);
      for (let i = 0; i < values.length; i++) {
        pixels.data[i * 4] = 255;
        pixels.data[i * 4 + 1] = 255;
        pixels.data[i * 4 + 2] = 255;
        // Smooth confidence edges, retaining hair without a hard binary outline.
        pixels.data[i * 4 + 3] = Math.round(
          Math.max(0, Math.min(1, (values[i] - 0.2) / 0.6)) * 255,
        );
      }
      maskContext.putImageData(pixels, 0, 0);
      context.globalCompositeOperation = 'destination-in';
      context.drawImage(maskCanvas, 0, 0, canvas.width, canvas.height);
      context.globalCompositeOperation = 'source-over';
    });
    const frame = canvas.transferToImageBitmap();
    self.postMessage({ type: 'frame', image: frame }, [frame]);
  } catch (error) {
    self.postMessage({ type: 'error', message: String(error) });
  } finally {
    image.close();
  }
};
