import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { Scan, Minus, Plus, Maximize2, MousePointer2, Hand, ArrowUpRight } from 'lucide-react';
import type { Asset, Project } from '../model';
import { clamp } from '../model';
import type { MediaLibrary } from '../engine/media';
import { AssetPreview } from './Preview';
import { IconButton } from './ui';
interface Props {
  project: Project;
  update: (fn: (p: Project) => Project) => void;
  selected: string | null;
  onSelect: (id: string) => void;
  onFocus: (asset: Asset) => void;
  media: MediaLibrary;
  children: ReactNode;
  hand: boolean;
  setHand: (value: boolean) => void;
  focusMode: boolean;
  setFocusMode: (value: boolean) => void;
}
export function SpatialCanvas({
  project,
  update,
  selected,
  onSelect,
  onFocus,
  media,
  children,
  hand,
  setHand,
  focusMode,
  setFocusMode,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const state = useRef(project);
  state.current = project;
  const gesture = useRef<
    | {
        kind: 'pan' | 'asset' | 'pinch';
        id?: string;
        startX: number;
        startY: number;
        x: number;
        y: number;
        zoom: number;
        distance?: number;
      }
    | undefined
  >(undefined);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const zoomAt = (scale: number, cx: number, cy: number) =>
    update((p) => {
      const z = clamp(scale, 0.2, 2);
      return {
        ...p,
        canvas: {
          zoom: z,
          x: cx - ((cx - p.canvas.x) * z) / p.canvas.zoom,
          y: cy - ((cy - p.canvas.y) * z) / p.canvas.zoom,
        },
      };
    });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const wheel = (e: WheelEvent) => {
      if ((e.target as HTMLElement).closest('.output-wrapper,.workspace-controls,.canvas-toolbar'))
        return;
      e.preventDefault();
      const p = state.current;
      const rect = el.getBoundingClientRect();
      if (e.ctrlKey || e.metaKey)
        zoomAt(
          p.canvas.zoom * Math.exp(-e.deltaY * 0.008),
          e.clientX - rect.left,
          e.clientY - rect.top,
        );
      else
        update((v) => ({
          ...v,
          canvas: { ...v.canvas, x: v.canvas.x - e.deltaX, y: v.canvas.y - e.deltaY },
        }));
    };
    el.addEventListener('wheel', wheel, { passive: false });
    return () => el.removeEventListener('wheel', wheel);
  }, [update]);
  const finish = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    gesture.current = undefined;
  };
  return (
    <div
      ref={ref}
      className={`spatial-canvas ${hand ? 'hand-mode' : ''} ${focusMode ? 'focus-mode' : ''}`}
      onPointerDown={(e) => {
        if (
          (e.target as HTMLElement).closest(
            'button,.output-wrapper,.workspace-controls,.canvas-toolbar',
          )
        )
          return;
        if (e.button !== 0 && e.button !== 1) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pointers.current.size === 2) {
          const [a, b] = [...pointers.current.values()];
          const r = e.currentTarget.getBoundingClientRect();
          gesture.current = {
            kind: 'pinch',
            startX: (a.x + b.x) / 2 - r.left,
            startY: (a.y + b.y) / 2 - r.top,
            x: project.canvas.x,
            y: project.canvas.y,
            zoom: project.canvas.zoom,
            distance: Math.hypot(a.x - b.x, a.y - b.y),
          };
          return;
        }
        const id = (e.target as HTMLElement).closest<HTMLElement>('[data-asset]')?.dataset.asset;
        const asset = project.assets.find((a) => a.id === id);
        if (asset && !hand && e.button === 0) {
          onSelect(asset.id);
          gesture.current = {
            kind: 'asset',
            id: asset.id,
            startX: e.clientX,
            startY: e.clientY,
            x: asset.x,
            y: asset.y,
            zoom: project.canvas.zoom,
          };
        } else
          gesture.current = {
            kind: 'pan',
            startX: e.clientX,
            startY: e.clientY,
            x: project.canvas.x,
            y: project.canvas.y,
            zoom: project.canvas.zoom,
          };
      }}
      onPointerMove={(e) => {
        if (!pointers.current.has(e.pointerId)) return;
        pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        const g = gesture.current;
        if (!g) return;
        if (g.kind === 'pinch' && pointers.current.size === 2) {
          const [a, b] = [...pointers.current.values()];
          const r = e.currentTarget.getBoundingClientRect();
          const z = clamp((g.zoom * Math.hypot(a.x - b.x, a.y - b.y)) / (g.distance || 1), 0.2, 2);
          update((p) => ({
            ...p,
            canvas: {
              zoom: z,
              x: (a.x + b.x) / 2 - r.left - ((g.startX - g.x) * z) / g.zoom,
              y: (a.y + b.y) / 2 - r.top - ((g.startY - g.y) * z) / g.zoom,
            },
          }));
        } else if (g.kind === 'pan')
          update((p) => ({
            ...p,
            canvas: { ...p.canvas, x: g.x + e.clientX - g.startX, y: g.y + e.clientY - g.startY },
          }));
        else if (g.kind === 'asset')
          update((p) => ({
            ...p,
            assets: p.assets.map((a) =>
              a.id === g.id
                ? {
                    ...a,
                    x: g.x + (e.clientX - g.startX) / g.zoom,
                    y: g.y + (e.clientY - g.startY) / g.zoom,
                  }
                : a,
            ),
          }));
      }}
      onPointerUp={finish}
      onPointerCancel={finish}
    >
      <div className="canvas-heading">
        <span>
          <i /> YOUR INFINITE WORKSPACE
        </span>
        <p>Room for every idea.</p>
      </div>
      {!focusMode && (
        <div
          className="canvas-world"
          style={{
            transform: `translate(${project.canvas.x}px,${project.canvas.y}px) scale(${project.canvas.zoom})`,
          }}
        >
          {project.assets.map((a) => (
            <div
              key={a.id}
              data-asset={a.id}
              className={`board-asset ${selected === a.id ? 'selected' : ''}`}
              style={{ left: a.x, top: a.y, width: a.boardWidth }}
              onDoubleClick={() => onFocus(a)}
            >
              <div className="board-asset-label">
                <span>{a.name}</span>
                <button
                  aria-label={`Present ${a.name}`}
                  title="Bring into frame"
                  onClick={() => onFocus(a)}
                >
                  <ArrowUpRight size={16} />
                </button>
              </div>
              <div
                className="board-preview"
                style={{ aspectRatio: `${a.width}/${a.height}`, maxHeight: 420 }}
              >
                <AssetPreview asset={a} media={media} />
              </div>
              {selected === a.id && (
                <span className="selection-caption">Double-click to focus</span>
              )}
            </div>
          ))}
        </div>
      )}
      {children}
      <div className="canvas-toolbar">
        <IconButton label="Select and move (V)" active={!hand} onClick={() => setHand(false)}>
          <MousePointer2 size={17} />
        </IconButton>
        <IconButton label="Pan canvas (H)" active={hand} onClick={() => setHand(true)}>
          <Hand size={17} />
        </IconButton>
        <span className="divider" />
        <IconButton label="Focus mode" active={focusMode} onClick={() => setFocusMode(!focusMode)}>
          <Scan size={18} />
        </IconButton>
      </div>
      <div className="workspace-controls">
        <IconButton
          label="Zoom out canvas"
          onClick={() =>
            zoomAt(
              project.canvas.zoom - 0.1,
              (ref.current?.clientWidth || 600) / 2,
              (ref.current?.clientHeight || 600) / 2,
            )
          }
        >
          <Minus size={15} />
        </IconButton>
        <span>{Math.round(project.canvas.zoom * 100)}%</span>
        <IconButton
          label="Zoom in canvas"
          onClick={() =>
            zoomAt(
              project.canvas.zoom + 0.1,
              (ref.current?.clientWidth || 600) / 2,
              (ref.current?.clientHeight || 600) / 2,
            )
          }
        >
          <Plus size={15} />
        </IconButton>
        <span className="divider" />
        <IconButton
          label="Reset canvas view"
          onClick={() => update((p) => ({ ...p, canvas: { x: 0, y: 0, zoom: 0.72 } }))}
        >
          <Maximize2 size={15} />
        </IconButton>
      </div>
      <div className="canvas-hint">
        {hand ? 'Drag to explore' : 'Drag assets to arrange'}
        <span>·</span>Pinch to zoom
      </div>
    </div>
  );
}
