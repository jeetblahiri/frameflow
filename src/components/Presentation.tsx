import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import {
  LockKeyhole,
  Maximize,
  MousePointer2,
  Globe2,
  LoaderCircle,
  MonitorUp,
} from 'lucide-react';
import type { Annotation, Asset, Composition, Point, RecordingState, Tool } from '../model';
import { clamp, uid } from '../model';
import { cameraHeight, drawComposition } from '../engine/composition';
import { hitsAnnotation } from '../engine/annotations';
import type { MediaLibrary } from '../engine/media';
import type { PresenterProcessor } from '../engine/presenter';
import type { WebCapture } from '../hooks/useWebCapture';
interface Props {
  web: WebCapture;
  presenter: PresenterProcessor;
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
  web,
  presenter,
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
  const preview = useRef<HTMLCanvasElement>(null);
  const border = useRef<HTMLDivElement>(null);
  const [displayWidth, setDisplayWidth] = useState(300);
  const { interact, setInteract } = web;
  useEffect(() => {
    if (tool !== 'select') setInteract(false);
  }, [tool]);
  const webLayer = [...composition.layers]
    .reverse()
    .find((l) => assets.find((a) => a.id === l.assetId)?.kind === 'webpage');
  const webAsset = assets.find((a) => a.id === webLayer?.assetId);
  const embedded = !!webAsset && web.view === 'embed' && web.mode !== 'tab';
  const boundWeb = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (web.mode === 'remote' && webAsset) {
      if (boundWeb.current && boundWeb.current !== webAsset.id)
        web.remote.send({ type: 'navigate', url: webAsset.url });
      boundWeb.current = webAsset.id;
    } else if (web.mode === 'off') boundWeb.current = undefined;
  }, [webAsset?.id, web.mode, web.remote.send]);
  const latest = useRef({ composition, assets, camera, web, embedded });
  latest.current = { composition, assets, camera, web, embedded };
  useEffect(() => {
    if (!border.current) return;
    const observer = new ResizeObserver((entries) => setDisplayWidth(entries[0].contentRect.width));
    observer.observe(border.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (composition.camera.background === 'remove' && camera) presenter.enable();
    else presenter.dispose();
    return () => presenter.dispose();
  }, [composition.camera.background, !!camera, presenter]);
  const previousScene = useRef(sceneId);
  const transition = useRef<{ canvas: HTMLCanvasElement; time: number } | undefined>(undefined);
  const gesture = useRef<
    | {
        kind: 'draw' | 'pan' | 'camera' | 'resize' | 'remote';
        touch?: boolean;
        last?: Point;
        camSize?: number;
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
          const source =
            d.camera && d.composition.camera.background === 'remove'
              ? presenter.draw(d.camera, now)
              : d.camera || undefined;
          drawComposition(ctx, d.composition, d.assets, media, source, {
            webSource: d.web.source,
            capturedFrame: d.embedded && d.web.mode === 'embedded',
          });
          const t = transition.current;
          if (t) {
            const opacity = 1 - (now - t.time) / 320;
            if (opacity > 0) {
              ctx.globalAlpha = opacity;
              ctx.drawImage(t.canvas, 0, 0, ctx.canvas.width, ctx.canvas.height);
              ctx.globalAlpha = 1;
            } else transition.current = undefined;
          }
          const visible = preview.current?.getContext('2d');
          if (visible) {
            if (d.embedded)
              drawComposition(visible, d.composition, d.assets, media, source, {
                overlayOnly: true,
              });
            else {
              visible.clearRect(0, 0, visible.canvas.width, visible.canvas.height);
              visible.drawImage(ctx.canvas, 0, 0);
            }
          }
        }
        last = now;
      }
      frame = requestAnimationFrame(render);
    };
    frame = requestAnimationFrame(render);
    return () => cancelAnimationFrame(frame);
  }, [canvasRef, media, presenter]);
  const point = (e: React.PointerEvent): Point => {
    const r = e.currentTarget.getBoundingClientRect();
    return {
      x: clamp((e.clientX - r.left) / r.width, 0, 1),
      y: clamp((e.clientY - r.top) / r.height, 0, 1),
      pressure: e.pressure,
    };
  };
  const remotePoint = (p: Point) => ({
    x: clamp(((p.x - (webLayer?.x || 0)) / (webLayer?.w || 1)) * 390, 0, 389),
    y: clamp(((p.y - (webLayer?.y || 0)) / (webLayer?.h || 1)) * 693, 0, 692),
  });
  useEffect(() => {
    const el = preview.current;
    if (!el) return;
    const wheel = (event: WheelEvent) => {
      const d = latest.current;
      if (
        d.web.mode !== 'remote' ||
        !d.web.interact ||
        !d.composition.layers.some(
          (l) => d.assets.find((a) => a.id === l.assetId)?.kind === 'webpage',
        )
      )
        return;
      event.preventDefault();
      const rect = el.getBoundingClientRect();
      d.web.remote.send({
        type: 'scroll',
        x: (390 * (event.clientX - rect.left)) / rect.width,
        y: (693 * (event.clientY - rect.top)) / rect.height,
        dx: event.deltaX,
        dy: event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 693 : 1),
      });
    };
    el.addEventListener('wheel', wheel, { passive: false });
    return () => el.removeEventListener('wheel', wheel);
  }, []);
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
      <div
        className="output-border"
        ref={(element) => {
          border.current = element;
          web.target.current = element;
        }}
      >
        <div
          className="live-page-target"
          style={{
            display: embedded ? 'block' : 'none',
            left: `${(webLayer?.x || 0) * 100}%`,
            top: `${(webLayer?.y || 0) * 100}%`,
            width: `${(webLayer?.w || 1) * 100}%`,
            height: `${(webLayer?.h || 1) * 100}%`,
          }}
        >
          {web.view === 'embed' &&
            assets
              .filter((a) => a.kind === 'webpage')
              .map((a) => (
                <iframe
                  key={a.id}
                  src={a.url}
                  title={`Live mobile website: ${a.name}`}
                  className="mobile-webpage"
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                  allow="camera 'none'; microphone 'none'; geolocation 'none'; display-capture 'none'; payment 'none'"
                  referrerPolicy="no-referrer"
                  style={{
                    display: a.id === webAsset?.id ? 'block' : 'none',
                    width: 390,
                    height: (((390 * 16) / 9) * (webLayer?.h || 1)) / (webLayer?.w || 1),
                    transform: `scale(${(displayWidth * (webLayer?.w || 1)) / 390})`,
                  }}
                />
              ))}
        </div>
        <canvas
          ref={canvasRef}
          width={width}
          height={(width * 16) / 9}
          className="recording-canvas"
          aria-hidden="true"
        />
        <canvas
          ref={preview}
          tabIndex={web.mode === 'remote' && interact ? 0 : -1}
          onPaste={(e) => {
            if (web.mode !== 'remote' || !interact || !webAsset) return;
            e.preventDefault();
            e.stopPropagation();
            web.remote.send({
              type: 'text',
              text: e.clipboardData.getData('text/plain').slice(0, 2000),
            });
          }}
          onKeyDown={(e) => {
            if (web.mode !== 'remote' || !interact || !webAsset) return;
            e.stopPropagation();
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'a') {
              e.preventDefault();
              web.remote.send({ type: 'key', key: 'ControlOrMeta+A' });
            } else if (e.key.length === 1 && !e.metaKey && !e.ctrlKey) {
              e.preventDefault();
              web.remote.send({ type: 'text', text: e.key });
            } else if (
              [
                'Enter',
                'Backspace',
                'Delete',
                'Tab',
                'ArrowLeft',
                'ArrowRight',
                'ArrowUp',
                'ArrowDown',
                'Escape',
                'Home',
                'End',
              ].includes(e.key)
            ) {
              e.preventDefault();
              web.remote.send({
                type: 'key',
                key: e.key === 'Tab' && e.shiftKey ? 'Shift+Tab' : e.key,
              });
            }
          }}
          width={width}
          height={(width * 16) / 9}
          data-testid="composition"
          aria-label="Vertical output composition. Drag to pan content or use an annotation tool."
          style={{
            cursor: tool === 'select' ? 'grab' : tool === 'eraser' ? 'cell' : 'crosshair',
            pointerEvents: embedded && interact ? 'none' : 'auto',
          }}
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            e.currentTarget.setPointerCapture(e.pointerId);
            const p = point(e);
            if (web.mode === 'remote' && interact && webAsset) {
              e.currentTarget.focus({ preventScroll: true });
              gesture.current = {
                kind: 'remote',
                touch: e.pointerType === 'touch',
                start: p,
                last: p,
                panX: 0,
                panY: 0,
                camX: 0,
                camY: 0,
              };
              if (e.pointerType !== 'touch') web.remote.send({ type: 'down', ...remotePoint(p) });
              return;
            }
            const c = composition;
            const layer = c.layers.at(-1);
            if (tool === 'eraser') {
              erase(p);
              return;
            }
            if (tool === 'select') {
              const cam = c.camera;
              const camHeight = cameraHeight(
                cam,
                camera ? camera.videoHeight / camera.videoWidth : 9 / 16,
              );
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
            if (tool === 'eraser' && gesture.current?.kind !== 'remote') {
              erase(p);
              return;
            }
            const g = gesture.current;
            if (!g) return;
            if (g.kind === 'remote') {
              if (g.touch)
                web.remote.send({
                  type: 'scroll',
                  ...remotePoint(p),
                  dx: 0,
                  dy: ((g.last?.y || p.y) - p.y) * 693,
                });
              else web.remote.send({ type: 'move', ...remotePoint(p) });
              g.last = p;
            } else if (g.kind === 'pan')
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
            else if (g.kind === 'resize')
              update((c) => ({
                ...c,
                camera: { ...c.camera, size: clamp((g.camSize || 0.3) + p.x - g.start.x, 0.1, 3) },
              }));
            else if (g.kind === 'camera')
              update((c) => ({
                ...c,
                camera: {
                  ...c.camera,
                  x: clamp(g.camX + p.x - g.start.x, -2.9, 1),
                  y: clamp(g.camY + p.y - g.start.y, -2.9, 1),
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
          onPointerUp={(e) => {
            const g = gesture.current;
            if (g?.kind === 'remote') {
              const p = point(e);
              if (g.touch && Math.hypot(p.x - g.start.x, p.y - g.start.y) < 0.02)
                web.remote.send({ type: 'down', ...remotePoint(p) });
              web.remote.send({ type: 'up', ...remotePoint(p) });
            }
            gesture.current = undefined;
          }}
          onPointerCancel={() => {
            if (gesture.current?.kind === 'remote')
              web.remote.send({
                type: 'up',
                ...remotePoint(gesture.current.last || gesture.current.start),
              });
            gesture.current = undefined;
          }}
        />
        {webAsset && !embedded && web.mode !== 'remote' && web.mode !== 'tab' && (
          <div className="website-empty">
            <span className="website-empty-icon">
              <Globe2 size={28} />
            </span>
            <h2>
              {web.remote.status === 'connecting'
                ? 'Opening your website…'
                : web.remote.status === 'error'
                  ? 'Let’s reconnect your page.'
                  : 'Your website, in frame.'}
            </h2>
            <p>
              {web.remote.message ||
                (web.remote.available
                  ? 'Open an interactive mobile browser. Scroll, click and type, then switch to annotation.'
                  : 'Open this website in a browser tab, then share the tab here to annotate and record it.')}
            </p>
            {web.remote.available ? (
              <button
                className="primary"
                disabled={web.remote.status === 'connecting'}
                onClick={() => web.connectBrowser(webAsset.url!)}
              >
                {web.remote.status === 'connecting' ? (
                  <LoaderCircle className="spin" size={16} />
                ) : (
                  <Globe2 size={16} />
                )}{' '}
                {web.remote.status === 'error' ? 'Retry live browser' : 'Open live browser'}
              </button>
            ) : (
              <a className="primary" href={webAsset.url} target="_blank" rel="noreferrer">
                Open website ↗
              </a>
            )}
            <button
              className="secondary"
              disabled={web.busy}
              onClick={() => void web.connect('tab')}
            >
              <MonitorUp size={15} />
              Share website tab
            </button>
            {web.remote.available && (
              <a className="website-original" href={webAsset.url} target="_blank" rel="noreferrer">
                Open original website ↗
              </a>
            )}
            <small>
              {web.remote.available
                ? 'Temporary cloud browser · Camera & files stay local'
                : 'Camera & imported files stay on this device'}
            </small>
          </div>
        )}
        {composition.camera.enabled &&
          camera &&
          tool === 'select' &&
          !(embedded && interact) &&
          web.mode !== 'embedded' && (
            <button
              className="presenter-resize"
              aria-label="Resize presenter"
              style={{
                left: `${Math.min(0.96, Math.max(0.02, composition.camera.x + composition.camera.size)) * 100}%`,
                top: `${Math.min(0.97, Math.max(0.02, composition.camera.y + cameraHeight(composition.camera, camera.videoHeight / camera.videoWidth))) * 100}%`,
              }}
              onPointerDown={(e) => {
                e.stopPropagation();
                const handle = e.currentTarget;
                handle.setPointerCapture(e.pointerId);
                const start = e.clientX;
                const size = composition.camera.size;
                const move = (event: PointerEvent) =>
                  update((c) => ({
                    ...c,
                    camera: {
                      ...c.camera,
                      size: clamp(size + (event.clientX - start) / displayWidth, 0.1, 3),
                    },
                  }));
                const end = () => {
                  handle.removeEventListener('pointermove', move);
                  handle.removeEventListener('pointerup', end);
                  handle.removeEventListener('pointercancel', end);
                };
                handle.addEventListener('pointermove', move);
                handle.addEventListener('pointerup', end);
                handle.addEventListener('pointercancel', end);
              }}
            >
              ↘
            </button>
          )}
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
