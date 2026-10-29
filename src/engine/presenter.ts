export type PresenterStatus = 'off' | 'loading' | 'ready' | 'error';
/** Keeps segmentation off the recording/render thread and allows only one frame in flight. */
export class PresenterProcessor {
  private worker?: Worker;
  private frame?: ImageBitmap;
  private busy = false;
  private lastTime = -100;
  private generation = 0;
  status: PresenterStatus = 'off';
  onStatus?: (status: PresenterStatus) => void;
  private setStatus(status: PresenterStatus) {
    this.status = status;
    this.onStatus?.(status);
  }
  enable() {
    if (this.worker) return;
    this.setStatus('loading');
    let worker: Worker;
    try {
      worker = new Worker(
        new URL(`${import.meta.env.BASE_URL}vision/presenter-worker.js`, location.href),
      );
    } catch {
      this.fail();
      return;
    }
    this.worker = worker;
    worker.onerror = () => this.fail();
    worker.onmessage = ({ data }) => {
      if (data.type === 'ready') this.setStatus('ready');
      else if (data.type === 'error') this.fail();
      else if (data.type === 'frame') {
        this.frame?.close();
        this.frame = data.image;
        this.busy = false;
      }
    };
    worker.postMessage({ type: 'init' });
  }
  private fail() {
    this.dispose();
    this.setStatus('error');
  }
  draw(video: HTMLVideoElement, now: number): ImageBitmap | undefined {
    if (this.status === 'error') return undefined;
    if (!this.worker) this.enable();
    if (
      this.status === 'ready' &&
      !this.busy &&
      now - this.lastTime >= 66 &&
      video.readyState >= 2
    ) {
      this.busy = true;
      this.lastTime = now;
      const generation = this.generation;
      const ratio = video.videoHeight / video.videoWidth;
      void createImageBitmap(video, { resizeWidth: 640, resizeHeight: Math.round(640 * ratio) })
        .then((image) => {
          if (generation !== this.generation || !this.worker) {
            image.close();
            return;
          }
          this.worker.postMessage({ type: 'frame', image, time: now }, [image]);
        })
        .catch(() => this.fail());
    }
    return this.frame;
  }
  dispose() {
    this.generation++;
    this.worker?.terminate();
    this.worker = undefined;
    this.frame?.close();
    this.frame = undefined;
    this.busy = false;
    this.setStatus('off');
  }
}
