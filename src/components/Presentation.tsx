import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import { LockKeyhole, Maximize, MousePointer2 } from 'lucide-react';
import type { Annotation, Asset, Composition, Point, RecordingState, Tool } from '../model';
import { clamp, uid } from '../model';
import { drawComposition } from '../engine/composition';
import { hitsAnnotation } from '../engine/annotations';
import type { MediaLibrary } from '../engine/media';
interface Props {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  composition: Composition;
  assets: Asset[];
  media: MediaLibrary;
  camera: HTMLVideoElement | null;
  tool: Tool;
  color: string;
  strokeWidth: number;
  update: (fn: (c: Composition) => Composition) => void;
  sceneId: string;
  fade: boolean;
  width: number;
  state: RecordingState;
  onExpand: () => void;
}
export function Presentation({
  canvasRef,
  composition,
  assets,
  media,
  camera,
  tool,
  color,
  strokeWidth,
  update,
  sceneId,
  fade,
  width,
  state,
  onExpand,
}: Props) {
  const latest = useRef({ composition, assets, camera });
  latest.current = { composition, assets, camera };
  const previousScene = useRef(sceneId);
  const transition = useRef<{ canvas: HTMLCanvasElement; time: number } | undefined>(undefined);
  const gesture = useRef<
    | {
        kind: 'draw' | 'pan' | 'camera';
        start: Point;
        annotation?: Annotation;
        panX: number;
        panY: number;
        camX: number;
        camY: number;
      }
    | undefined
  >(undefined);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (previousScene.current !== sceneId && fade && canvas) {
      const snapshot = document.createElement('canvas');
      snapshot.width = canvas.width;
      snapshot.height = canvas.height;
      snapshot.getContext('2d')!.drawImage(canvas, 0, 0);
      transition.current = { canvas: snapshot, time: performance.now() };
    }
    previousScene.current = sceneId;
  }, [sceneId, fade, canvasRef]);
  useEffect(() => {
    let frame = 0,
      last = 0;
    const render = (now: number) => {
      if (now - last > 30) {
        const ctx = canvasRef.current?.getContext('2d', { alpha: false });
        if (ctx) {
          const d = latest.current;
          drawComposition(ctx, d.composition, d.assets, media, d.camera || undefined);
          const t = transition.current;
          if (t) {
            const opacity = 1 - (now - t.time) / 320;
            if (opacity > 0) {
              ctx.globalAlpha = opacity;
              ctx.drawImage(t.canvas, 0, 0, ctx.canvas.width, ctx.canvas.height);
              ctx.globalAlpha = 1;
            } else transition.current = undefined;
          }
        }
        last = now;
      }
      frame = requestAnimationFrame(render);
    };
    frame = requestAnimationFrame(render);
    return () => cancelAnimationFrame(frame);
  }, [canvasRef, media]);
  const point = (e: React.PointerEvent): Point => {
    const r = e.currentTarget.getBoundingClientRect();
    return {
      x: clamp((e.clientX - r.left) / r.width, 0, 1),
      y: clamp((e.clientY - r.top) / r.height, 0, 1),
      pressure: e.pressure,
    };
  };
  const erase = (p: Point) =>
    update((c) => ({ ...c, annotations: c.annotations.filter((a) => !hitsAnnotation(a, p)) }));
  return (
    <div className={`output-wrapper ${state === 'recording' ? 'is-recording' : ''}`}>
      <div className="output-label">
        <span>
          <i />
          {state === 'recording' ? 'LIVE OUTPUT' : 'RECORDING FRAME'}
        </span>
        <span>
          9:16 <LockKeyhole size={10} />
        </span>
      </div>
      <div className="output-border">
        <canvas
          ref={canvasRef}
          width={width}
          height={(width * 16) / 9}
          data-testid="composition"
          aria-label="Vertical output composition. Drag to pan content or use an annotation tool."
          style={{ cursor: tool === 'select' ? 'grab' : tool === 'eraser' ? 'cell' : 'crosshair' }}
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            e.currentTarget.setPointerCapture(e.pointerId);
            const p = point(e);
            const c = composition;
            const layer = c.layers.at(-1);
            if (tool === 'eraser') {
              erase(p);
              return;
            }
            if (tool === 'select') {
              const cam = c.camera;
              const camHeight =
                ((cam.size * 9) / 16) *
                (cam.shape === 'rounded' ? 1.25 : cam.shape === 'wide' ? 0.5625 : 1);
              const isCamera =
                cam.enabled &&
                p.x > cam.x &&
                p.x < cam.x + cam.size &&
                p.y > cam.y &&
                p.y < cam.y + camHeight;
              gesture.current = {
                kind: isCamera ? 'camera' : 'pan',
                start: p,
                panX: layer?.panX || 0,
                panY: layer?.panY || 0,
                camX: cam.x,
                camY: cam.y,
              };
            } else {
              const annotation: Annotation = {
                id: uid(),
                tool,
                color,
                width: strokeWidth,
                points: [p],
                createdAt: Date.now(),
              };
              gesture.current = {
                kind: 'draw',
                start: p,
                annotation,
                panX: 0,
                panY: 0,
                camX: 0,
                camY: 0,
              };
              update((c) => ({
                ...c,
                annotations: [
                  ...c.annotations.filter(
                    (a) => a.tool !== 'laser' || Date.now() - a.createdAt < 1400,
                  ),
                  annotation,
                ],
              }));
            }
          }}
          onPointerMove={(e) => {
            if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
            const p = point(e);
            if (tool === 'eraser') {
              erase(p);
              return;
            }
            const g = gesture.current;
            if (!g) return;
            if (g.kind === 'pan')
              update((c) => ({
                ...c,
                layers: c.layers.map((l, i) =>
                  i === c.layers.length - 1
                    ? {
                        ...l,
                        panX: g.panX + (p.x - g.start.x) / l.w,
                        panY: g.panY + (p.y - g.start.y) / l.h,
                      }
                    : l,
                ),
              }));
            else if (g.kind === 'camera')
              update((c) => ({
                ...c,
                camera: {
                  ...c.camera,
                  x: clamp(g.camX + p.x - g.start.x, 0, 1 - c.camera.size),
                  y: clamp(g.camY + p.y - g.start.y, 0, 1 - ((c.camera.size * 9) / 16) * 1.25),
                },
              }));
            else if (g.annotation) {
              const a = g.annotation;
              const shape = ['arrow', 'rectangle', 'circle', 'line'].includes(a.tool);
              a.points = shape ? [g.start, p] : [...a.points, p];
              a.createdAt = Date.now();
              update((c) => ({
                ...c,
                annotations: c.annotations.map((v) =>
                  v.id === a.id ? { ...a, points: [...a.points] } : v,
                ),
              }));
            }
          }}
          onPointerUp={() => {
            gesture.current = undefined;
          }}
          onPointerCancel={() => {
            gesture.current = undefined;
          }}
        />
        <div className="frame-corner tl" />
        <div className="frame-corner tr" />
        <div className="frame-corner bl" />
        <div className="frame-corner br" />
      </div>
      <div className="output-footer">
        <span>
          {width} × {(width * 16) / 9} <span>·</span> 30 fps
        </span>
        <button aria-label="Toggle distraction-free view" onClick={onExpand}>
          <Maximize size={13} />
        </button>
      </div>
      <div className="focus-instruction">
        <MousePointer2 size={11} />
        {tool === 'select'
          ? 'Drag inside to reframe. Your source stays put.'
          : `${tool.charAt(0).toUpperCase() + tool.slice(1)} · Draw directly on your output`}
      </div>
    </div>
  );
}
