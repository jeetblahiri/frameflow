import type { Annotation, Asset, Composition, Layer } from '../model';
import type { MediaLibrary } from './media';

export function imageRect(
  sw: number,
  sh: number,
  dw: number,
  dh: number,
  fit: 'contain' | 'cover',
  zoom = 1,
  panX = 0,
  panY = 0,
) {
  const scale = (fit === 'cover' ? Math.max(dw / sw, dh / sh) : Math.min(dw / sw, dh / sh)) * zoom;
  return {
    x: (dw - sw * scale) / 2 + panX * dw,
    y: (dh - sh * scale) / 2 + panY * dh,
    w: sw * scale,
    h: sh * scale,
  };
}
function lines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  return text.split('\n').flatMap((paragraph) => {
    if (!paragraph) return [''];
    const result: string[] = [];
    let line = '';
    for (const word of paragraph.split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (ctx.measureText(next).width > maxWidth && line) {
        result.push(line);
        line = word;
      } else line = next;
    }
    result.push(line);
    return result;
  });
}
function drawText(ctx: CanvasRenderingContext2D, asset: Asset, w: number, h: number) {
  ctx.fillStyle = asset.background || '#e8e9dc';
  ctx.fillRect(0, 0, w, h);
  const scale = w / 1080;
  const pad = 80 * scale;
  const size = (asset.fontSize || 64) * scale;
  ctx.fillStyle = asset.color || '#263e35';
  ctx.font = `${asset.kind === 'article' ? '400' : '500'} ${size}px ${asset.kind === 'article' ? 'sans-serif' : 'Georgia, serif'}`;
  ctx.textBaseline = 'top';
  const all = lines(ctx, asset.text || asset.name, w - pad * 2);
  const lineHeight = size * 1.48;
  const start = asset.kind === 'article' ? pad : Math.max(pad, (h - all.length * lineHeight) / 2);
  all.forEach((line, i) => ctx.fillText(line, pad, start + i * lineHeight));
}
function drawLayer(
  ctx: CanvasRenderingContext2D,
  asset: Asset,
  layer: Layer,
  W: number,
  H: number,
  media: MediaLibrary,
) {
  const x = layer.x * W,
    y = layer.y * H,
    w = layer.w * W,
    h = layer.h * H;
  ctx.save();
  ctx.globalAlpha = layer.opacity;
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.translate(x, y);
  if (asset.kind === 'text' || asset.kind === 'article') {
    const r = imageRect(
      asset.width,
      asset.height,
      w,
      h,
      layer.fit,
      layer.zoom,
      layer.panX,
      layer.panY,
    );
    ctx.translate(r.x, r.y);
    drawText(ctx, asset, r.w, r.h);
  } else if (asset.kind === 'shape') {
    ctx.translate(layer.panX * w, layer.panY * h);
    ctx.fillStyle = asset.color || '#c8ef81';
    ctx.strokeStyle = asset.color || '#c8ef81';
    ctx.lineWidth = 12;
    ctx.scale(layer.zoom, layer.zoom);
    if (asset.shape === 'circle') {
      ctx.beginPath();
      ctx.ellipse(w / 2, h / 2, w * 0.4, h * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (asset.shape === 'arrow') {
      ctx.beginPath();
      ctx.moveTo(w * 0.1, h / 2);
      ctx.lineTo(w * 0.9, h / 2);
      ctx.lineTo(w * 0.65, h * 0.3);
      ctx.moveTo(w * 0.9, h / 2);
      ctx.lineTo(w * 0.65, h * 0.7);
      ctx.stroke();
    } else ctx.fillRect(w * 0.1, h * 0.1, w * 0.8, h * 0.8);
  } else if (asset.kind === 'link') {
    ctx.fillStyle = '#e7e9db';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#344b3c';
    ctx.font = `${w * 0.055}px sans-serif`;
    ctx.fillText('LINKED REFERENCE', w * 0.08, h * 0.15);
    ctx.font = `${w * 0.07}px Georgia,serif`;
    lines(ctx, asset.name, w * 0.84).forEach((s, i) =>
      ctx.fillText(s, w * 0.08, h * 0.3 + i * w * 0.1),
    );
    ctx.font = `${w * 0.032}px sans-serif`;
    ctx.fillText('Open in the library to view the source.', w * 0.08, h * 0.78);
  } else if (asset.kind === 'audio') {
    media.ensure(asset);
    ctx.fillStyle = '#1b3438';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#c8ef81';
    ctx.lineWidth = w * 0.008;
    for (let i = 0; i < 32; i++) {
      const size = (0.15 + Math.abs(Math.sin(i * 1.7)) * 0.45) * h * 0.5;
      ctx.beginPath();
      ctx.moveTo(w * (0.1 + i * 0.025), h / 2 - size / 2);
      ctx.lineTo(w * (0.1 + i * 0.025), h / 2 + size / 2);
      ctx.stroke();
    }
    ctx.font = `${w * 0.05}px sans-serif`;
    ctx.fillStyle = '#d9e6d6';
    ctx.fillText(asset.name.slice(0, 35), w * 0.08, h * 0.85);
  } else {
    const source = media.ensure(asset, layer.page);
    if (source) {
      const s = source as HTMLVideoElement & HTMLImageElement;
      const sw = s.videoWidth || s.naturalWidth || s.width || asset.width;
      const sh = s.videoHeight || s.naturalHeight || s.height || asset.height;
      if (sw && sh) {
        const r = imageRect(sw, sh, w, h, layer.fit, layer.zoom, layer.panX, layer.panY);
        try {
          ctx.drawImage(source, r.x, r.y, r.w, r.h);
        } catch {
          /* Media can be between decoded frames. */
        }
      }
    } else {
      ctx.fillStyle = '#26332d';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#dce7d5';
      ctx.font = `${w * 0.04}px sans-serif`;
      ctx.fillText('Loading visual…', w * 0.1, h / 2);
    }
  }
  ctx.restore();
}
export function drawAnnotation(ctx: CanvasRenderingContext2D, a: Annotation, W: number, H: number) {
  if (!a.points.length) return;
  const first = a.points[0],
    last = a.points[a.points.length - 1];
  ctx.save();
  ctx.strokeStyle = a.color;
  ctx.fillStyle = a.color;
  ctx.lineWidth = a.width * W;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (a.tool === 'highlighter') {
    ctx.globalAlpha = 0.3;
    ctx.lineWidth = a.width * W * 4;
  }
  if (a.tool === 'laser') {
    ctx.shadowColor = a.color;
    ctx.shadowBlur = 14;
    ctx.lineWidth = 4;
    ctx.globalAlpha = Math.max(0, 1 - (Date.now() - a.createdAt) / 1400);
  }
  ctx.beginPath();
  if (a.tool === 'rectangle')
    ctx.rect(first.x * W, first.y * H, (last.x - first.x) * W, (last.y - first.y) * H);
  else if (a.tool === 'circle')
    ctx.ellipse(
      ((first.x + last.x) * W) / 2,
      ((first.y + last.y) * H) / 2,
      Math.max(1, (Math.abs(last.x - first.x) * W) / 2),
      Math.max(1, (Math.abs(last.y - first.y) * H) / 2),
      0,
      0,
      Math.PI * 2,
    );
  else if (a.tool === 'arrow' || a.tool === 'line') {
    ctx.moveTo(first.x * W, first.y * H);
    ctx.lineTo(last.x * W, last.y * H);
    if (a.tool === 'arrow') {
      const angle = Math.atan2((last.y - first.y) * H, (last.x - first.x) * W);
      const len = W * 0.035;
      ctx.moveTo(
        last.x * W - Math.cos(angle - 0.5) * len,
        last.y * H - Math.sin(angle - 0.5) * len,
      );
      ctx.lineTo(last.x * W, last.y * H);
      ctx.lineTo(
        last.x * W - Math.cos(angle + 0.5) * len,
        last.y * H - Math.sin(angle + 0.5) * len,
      );
    }
  } else {
    ctx.moveTo(first.x * W, first.y * H);
    for (const p of a.points) ctx.lineTo(p.x * W, p.y * H);
    if (a.points.length === 1) {
      ctx.lineTo(first.x * W + 0.1, first.y * H + 0.1);
    }
  }
  ctx.stroke();
  ctx.restore();
}
export function drawComposition(
  ctx: CanvasRenderingContext2D,
  composition: Composition,
  assets: Asset[],
  media: MediaLibrary,
  camera?: HTMLVideoElement,
) {
  const W = ctx.canvas.width,
    H = ctx.canvas.height;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = composition.background;
  ctx.fillRect(0, 0, W, H);
  for (const layer of composition.layers) {
    const asset = assets.find((a) => a.id === layer.assetId);
    if (asset) drawLayer(ctx, asset, layer, W, H, media);
  }
  const c = composition.camera;
  if (c.enabled && camera && camera.readyState >= 2) {
    const w = W * c.size,
      h = c.shape === 'wide' ? w * 0.5625 : c.shape === 'rounded' ? w * 1.25 : w;
    const x = W * c.x,
      y = H * c.y;
    ctx.save();
    ctx.shadowColor = '#0008';
    ctx.shadowBlur = 28;
    ctx.shadowOffsetY = 10;
    ctx.beginPath();
    if (c.shape === 'circle') ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
    else ctx.roundRect(x, y, w, h, c.shape === 'rounded' ? W * 0.03 : 0);
    ctx.fillStyle = c.border;
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.clip();
    ctx.filter = c.blur ? `blur(${c.blur}px)` : 'none';
    const r = imageRect(camera.videoWidth, camera.videoHeight, w, h, 'cover');
    ctx.translate(x, y);
    if (c.mirror) {
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(camera, r.x, r.y, r.w, r.h);
    ctx.restore();
    if (c.border) {
      ctx.save();
      ctx.strokeStyle = c.border;
      ctx.lineWidth = W * 0.004;
      ctx.beginPath();
      if (c.shape === 'circle') ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
      else ctx.roundRect(x, y, w, h, c.shape === 'rounded' ? W * 0.03 : 0);
      ctx.stroke();
      ctx.restore();
    }
  }
  for (const a of composition.annotations)
    if (a.tool !== 'laser' || Date.now() - a.createdAt < 1400) drawAnnotation(ctx, a, W, H);
  if (composition.branding) {
    ctx.fillStyle = '#ffffffb3';
    ctx.font = `500 ${W * 0.021}px sans-serif`;
    ctx.fillText('MADE WITH FRAMEFLOW', W * 0.07, H * 0.96);
  }
}
