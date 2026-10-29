import type { Asset } from '../model';
import { openPdf } from './pdf';
import type { AudioMixer } from './audio';
import { parseGIF, decompressFrames } from 'gifuct-js';
import type { ParsedFrame } from 'gifuct-js';

type Drawable = CanvasImageSource & { width?: number; height?: number };
interface Resource {
  drawable?: Drawable;
  element?: HTMLMediaElement;
  pending?: boolean;
  error?: boolean;
}
export class MediaLibrary {
  private resources = new Map<string, Resource>();
  private documents = new Map<string, Promise<import('pdfjs-dist').PDFDocumentProxy>>();
  private gifs = new Map<
    string,
    {
      frames: ParsedFrame[];
      canvas: HTMLCanvasElement;
      index: number;
      start: number;
      previous?: ImageData;
    }
  >();
  mixer?: AudioMixer;
  onError: (message: string) => void = () => {};
  ensure(asset: Asset, page = 1): Drawable | undefined {
    const key = asset.kind === 'pdf' ? `${asset.id}:${page}` : asset.id;
    let resource = this.resources.get(key);
    if (!resource) {
      resource = { pending: true };
      this.resources.set(key, resource);
      if (asset.kind === 'pdf') void this.loadPdf(asset, page, key);
      else if (asset.kind === 'video' || asset.kind === 'audio') {
        const el = document.createElement(asset.kind === 'video' ? 'video' : 'audio');
        el.src = asset.src!;
        el.preload = 'auto';
        el.loop = true;
        el.setAttribute('playsinline', '');
        el.muted = true;
        el.addEventListener('loadeddata', () => {
          resource!.pending = false;
        });
        el.addEventListener('error', () =>
          this.fail(
            key,
            `${asset.name}: this browser could not decode the media. Try an MP4 (H.264) or WAV/MP3 file.`,
          ),
        );
        resource.element = el;
        if (asset.kind === 'video') resource.drawable = el as HTMLVideoElement;
        this.mixer?.connectMedia(el);
      } else if (asset.mime === 'image/gif') void this.loadGif(asset, key);
      else if (asset.src) {
        const image = new Image();
        image.onload = () => {
          resource!.drawable = image;
          resource!.pending = false;
        };
        image.onerror = () =>
          this.fail(key, `${asset.name} could not be displayed. Re-import the file.`);
        image.src = asset.src;
      } else resource.pending = false;
    }
    if (resource.element) this.mixer?.setSourceVolume(resource.element, asset.volume ?? 1);
    const gif = this.gifs.get(key);
    if (gif) {
      const total = gif.frames.reduce((n, f) => n + Math.max(f.delay, 20), 0);
      let time = (performance.now() - gif.start) % total;
      let target = 0;
      while (target < gif.frames.length - 1 && time >= Math.max(gif.frames[target].delay, 20)) {
        time -= Math.max(gif.frames[target].delay, 20);
        target++;
      }
      if (target < gif.index) {
        gif.canvas.getContext('2d')!.clearRect(0, 0, gif.canvas.width, gif.canvas.height);
        gif.index = -1;
      }
      const ctx = gif.canvas.getContext('2d')!;
      while (gif.index < target) {
        const prev = gif.frames[gif.index];
        if (prev?.disposalType === 2)
          ctx.clearRect(prev.dims.left, prev.dims.top, prev.dims.width, prev.dims.height);
        if (prev?.disposalType === 3 && gif.previous) ctx.putImageData(gif.previous, 0, 0);
        gif.index++;
        const f = gif.frames[gif.index];
        if (f.disposalType === 3)
          gif.previous = ctx.getImageData(0, 0, gif.canvas.width, gif.canvas.height);
        const patch = document.createElement('canvas');
        patch.width = f.dims.width;
        patch.height = f.dims.height;
        patch
          .getContext('2d')!
          .putImageData(
            new ImageData(new Uint8ClampedArray(f.patch), f.dims.width, f.dims.height),
            0,
            0,
          );
        ctx.drawImage(patch, f.dims.left, f.dims.top);
      }
    }
    return resource.drawable;
  }
  private fail(key: string, message: string) {
    this.resources.set(key, { error: true });
    this.onError(message);
  }
  private async loadGif(asset: Asset, key: string) {
    try {
      const parsed = parseGIF(await (await fetch(asset.src!)).arrayBuffer());
      if (parsed.lsd.width * parsed.lsd.height * parsed.frames.length > 60_000_000)
        throw new Error(
          'This GIF is too large for safe live playback. Convert it to a local video.',
        );
      const frames = decompressFrames(parsed, true);
      const canvas = document.createElement('canvas');
      canvas.width = parsed.lsd.width;
      canvas.height = parsed.lsd.height;
      this.gifs.set(key, { frames, canvas, index: -1, start: performance.now() });
      this.resources.set(key, { drawable: canvas });
    } catch (e) {
      this.fail(key, e instanceof Error ? e.message : 'GIF could not be decoded.');
    }
  }
  private async loadPdf(asset: Asset, page: number, key: string) {
    try {
      let doc = this.documents.get(asset.id);
      if (!doc) {
        doc = (async () =>
          openPdf(new Uint8Array(await (await fetch(asset.src!)).arrayBuffer())))();
        this.documents.set(asset.id, doc);
      }
      const document = await doc;
      const p = await document.getPage(page);
      const viewport = p.getViewport({
        scale: Math.min(2, 1600 / p.getViewport({ scale: 1 }).width),
      });
      const canvas = window.document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await p.render({ canvas, canvasContext: canvas.getContext('2d')!, viewport }).promise;
      this.resources.set(key, { drawable: canvas });
    } catch {
      this.fail(
        key,
        `${asset.name}: this PDF page could not be read. Check whether the document is password protected.`,
      );
    }
  }
  isPlaying(id: string) {
    return this.resources.get(id)?.element?.paused === false;
  }
  elements() {
    return [...this.resources.values()].flatMap((r) => (r.element ? [r.element] : []));
  }
  element(asset: Asset) {
    this.ensure(asset);
    return this.resources.get(asset.id)?.element;
  }
  async play(asset: Asset) {
    const el = this.element(asset);
    if (!el) return;
    this.mixer?.connectMedia(el);
    await el.play();
  }
  pause(asset: Asset) {
    this.element(asset)?.pause();
  }
  pauseVideosExcept(ids: string[]) {
    for (const [id, r] of this.resources)
      if (r.element instanceof HTMLVideoElement && !ids.includes(id)) r.element.pause();
  }
  async prepare(assets: Asset[], layers: { assetId: string; page: number }[]) {
    await Promise.all(
      layers.map(async (l) => {
        const a = assets.find((a) => a.id === l.assetId);
        if (!a) return;
        this.ensure(a, l.page);
        const key = a.kind === 'pdf' ? `${a.id}:${l.page}` : a.id;
        const start = performance.now();
        while (this.resources.get(key)?.pending && performance.now() - start < 12000)
          await new Promise((r) => setTimeout(r, 50));
        if (this.resources.get(key)?.error || this.resources.get(key)?.pending)
          throw new Error(
            `${a.name} is not ready to record. Wait for it to load or remove it from the frame.`,
          );
      }),
    );
  }
  releaseAsset(id: string) {
    for (const [key, r] of this.resources) {
      if (key === id || key.startsWith(`${id}:`)) {
        if (r.element) {
          r.element.pause();
          this.mixer?.disconnectMedia(r.element);
          r.element.removeAttribute('src');
          r.element.load();
        }
        this.resources.delete(key);
        this.gifs.delete(key);
      }
    }
    const doc = this.documents.get(id);
    if (doc) void doc.then((p) => p.loadingTask.destroy()).catch(() => {});
    this.documents.delete(id);
  }
  dispose() {
    for (const e of this.elements()) {
      e.pause();
      this.mixer?.disconnectMedia(e);
      e.removeAttribute('src');
      e.load();
    }
    for (const d of this.documents.values())
      void d.then((p) => p.loadingTask.destroy()).catch(() => {});
    this.documents.clear();
    this.resources.clear();
    this.gifs.clear();
  }
}
