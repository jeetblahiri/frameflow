import type {
  Annotation,
  Asset,
  AssetKind,
  CameraConfig,
  Composition,
  Layer,
  Point,
  Project,
  Scene,
  Tool,
} from '../model';

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error(`Invalid ${label} in project.`);
  return value as Record<string, unknown>;
}
function text(value: unknown, label: string, max = 120, min = 0): string {
  if (typeof value !== 'string' || value.length < min || value.length > max)
    throw new Error(`Invalid ${label} in project.`);
  return value;
}
function number(value: unknown, label: string, min: number, max: number, integer = false): number {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < min ||
    value > max ||
    (integer && !Number.isInteger(value))
  )
    throw new Error(`Invalid ${label} in project.`);
  return value;
}
function boolean(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`Invalid ${label} in project.`);
  return value;
}
function choice<T extends string>(value: unknown, values: readonly T[], label: string): T {
  if (typeof value !== 'string' || !values.includes(value as T))
    throw new Error(`Invalid ${label} in project.`);
  return value as T;
}
function list(value: unknown, label: string, max: number, min = 0): unknown[] {
  if (!Array.isArray(value) || value.length < min || value.length > max)
    throw new Error(`Invalid ${label} in project.`);
  return value;
}
function id(value: unknown, label: string): string {
  const result = text(value, label, 128, 1);
  if (!/^[\w-]+$/.test(result)) throw new Error(`Invalid ${label} in project.`);
  return result;
}
function color(value: unknown, label: string): string {
  const result = text(value, label, 9, 4);
  if (!/^#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i.test(result))
    throw new Error(`Invalid ${label} in project.`);
  return result;
}
function unique<T extends { id: string }>(items: T[], label: string): T[] {
  if (new Set(items.map((i) => i.id)).size !== items.length)
    throw new Error(`Duplicate ${label} in project.`);
  return items;
}
const kinds: readonly AssetKind[] = [
  'image',
  'video',
  'audio',
  'pdf',
  'text',
  'article',
  'shape',
  'link',
  'webpage',
];
const tools: readonly Tool[] = [
  'pen',
  'highlighter',
  'arrow',
  'rectangle',
  'circle',
  'line',
  'laser',
];
function asset(value: unknown): Asset {
  const a = object(value, 'asset');
  const result: Asset = {
    id: id(a.id, 'asset ID'),
    kind: choice(a.kind, kinds, 'asset type'),
    name: text(a.name, 'asset name'),
    width: number(a.width, 'asset width', 0.01, 100000),
    height: number(a.height, 'asset height', 0.01, 100000),
    x: number(a.x, 'canvas X', -1e6, 1e6),
    y: number(a.y, 'canvas Y', -1e6, 1e6),
    boardWidth: number(a.boardWidth, 'canvas asset width', 1, 10000),
  };
  if (a.blobKey !== undefined) result.blobKey = id(a.blobKey, 'media key');
  if (a.mime !== undefined) result.mime = text(a.mime, 'media format', 128);
  if (a.volume !== undefined) result.volume = number(a.volume, 'source volume', 0, 1);
  if (a.text !== undefined) result.text = text(a.text, 'asset text', 30000);
  if (a.color !== undefined) result.color = color(a.color, 'asset color');
  if (a.background !== undefined) result.background = color(a.background, 'asset background');
  if (a.fontSize !== undefined) result.fontSize = number(a.fontSize, 'font size', 18, 240);
  if (a.shape !== undefined)
    result.shape = choice(a.shape, ['rectangle', 'circle', 'arrow'] as const, 'shape');
  if (a.pages !== undefined) result.pages = number(a.pages, 'document page count', 1, 10000, true);
  if (a.url !== undefined) {
    const value = text(a.url, 'source URL', 8192);
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new Error('Invalid source URL in project.');
    }
    if (!['https:', 'http:'].includes(url.protocol))
      throw new Error('Only HTTP or HTTPS source links are allowed.');
    if (url.username || url.password)
      throw new Error('Source URLs cannot contain embedded credentials.');
    result.url = url.href;
  }
  if (a.src !== undefined && !result.blobKey) {
    const src = text(a.src, 'embedded visual', 2 * 1024 * 1024);
    if (!src.startsWith('data:image/svg+xml;charset=utf-8,'))
      throw new Error('Untrusted external media in archive. Import the source file directly.');
    result.src = src;
  }
  if (['image', 'video', 'audio', 'pdf'].includes(result.kind) && !result.src && !result.blobKey)
    throw new Error(`Missing media reference: ${result.name}`);
  if (result.kind === 'webpage' && !result.url)
    throw new Error('A live webpage needs a source URL.');
  return result;
}
function camera(value: unknown): CameraConfig {
  const c = object(value, 'presenter');
  return {
    ...(c.background !== undefined
      ? { background: choice(c.background, ['original', 'remove'] as const, 'camera background') }
      : {}),
    enabled: boolean(c.enabled, 'camera state'),
    shape: choice(c.shape, ['circle', 'rounded', 'square', 'wide'], 'presenter shape'),
    x: number(c.x, 'camera X', -3, 3),
    y: number(c.y, 'camera Y', -3, 3),
    size: number(c.size, 'camera size', 0.01, 3),
    mirror: boolean(c.mirror, 'camera mirror'),
    border: color(c.border, 'camera border'),
    blur: number(c.blur, 'camera blur', 0, 40),
  };
}
function layer(value: unknown, assets: Map<string, Asset>): Layer {
  const l = object(value, 'layer');
  const assetId = id(l.assetId, 'layer source');
  const source = assets.get(assetId);
  if (!source) throw new Error('A scene references a missing asset.');
  return {
    id: id(l.id, 'layer ID'),
    assetId,
    x: number(l.x, 'layer X', -1e4, 1e4),
    y: number(l.y, 'layer Y', -1e4, 1e4),
    w: number(l.w, 'layer width', 0.001, 100),
    h: number(l.h, 'layer height', 0.001, 100),
    zoom: number(l.zoom, 'focus zoom', 0.01, 100),
    panX: number(l.panX, 'horizontal pan', -1e4, 1e4),
    panY: number(l.panY, 'vertical pan', -1e4, 1e4),
    fit: choice(l.fit, ['contain', 'cover'], 'layer fit'),
    page: number(l.page, 'document page', 1, source.pages || 1, true),
    opacity: number(l.opacity, 'layer opacity', 0, 1),
  };
}
function annotation(value: unknown, budget: { points: number }): Annotation {
  const a = object(value, 'annotation');
  const points: Point[] = list(a.points, 'stroke points', 20000, 1).map((value) => {
    const p = object(value, 'stroke point');
    const result: Point = { x: number(p.x, 'point X', 0, 1), y: number(p.y, 'point Y', 0, 1) };
    if (p.pressure !== undefined) result.pressure = number(p.pressure, 'pen pressure', 0, 1);
    return result;
  });
  budget.points += points.length;
  if (budget.points > 200000)
    throw new Error(
      'This project contains too many annotation points. Clear old marks and export again.',
    );
  return {
    id: id(a.id, 'annotation ID'),
    tool: choice(a.tool, tools, 'annotation tool'),
    color: color(a.color, 'annotation color'),
    width: number(a.width, 'stroke width', 0.0001, 0.1),
    points,
    createdAt: number(a.createdAt, 'annotation timestamp', 0, 1e16),
  };
}
function scene(value: unknown, assets: Map<string, Asset>, budget: { points: number }): Scene {
  const s = object(value, 'scene');
  const c = object(s.composition, 'composition');
  const composition: Composition = {
    layers: unique(
      list(c.layers, 'scene layers', 50).map((l) => layer(l, assets)),
      'layer IDs',
    ),
    background: color(c.background, 'frame background'),
    camera: camera(c.camera),
    annotations: unique(
      list(c.annotations, 'annotations', 2000).map((a) => annotation(a, budget)),
      'annotation IDs',
    ),
    branding: boolean(c.branding, 'branding state'),
  };
  return {
    id: id(s.id, 'scene ID'),
    name: text(s.name, 'scene name'),
    script: text(s.script, 'scene script', 100000),
    transition: choice(s.transition, ['cut', 'fade'], 'scene transition'),
    composition,
  };
}
/** Decode into a bounded, whitelisted model before reading or writing any imported media. */
export function validateProject(value: unknown): Project {
  const p = object(value, 'project');
  if (p.version !== 1) throw new Error('This project version is not supported.');
  const assets = unique(list(p.assets, 'assets', 500).map(asset), 'asset IDs');
  const index = new Map(assets.map((a) => [a.id, a]));
  const budget = { points: 0 };
  const scenes = unique(
    list(p.scenes, 'scenes', 100, 1).map((s) => scene(s, index, budget)),
    'scene IDs',
  );
  const canvas = object(p.canvas, 'canvas');
  const requested = id(p.activeSceneId, 'active scene');
  return {
    version: 1,
    id: id(p.id, 'project ID'),
    name: text(p.name, 'project name', 80),
    assets,
    scenes,
    ...(p.presenter !== undefined ? { presenter: camera(p.presenter) } : {}),
    activeSceneId: scenes.some((s) => s.id === requested) ? requested : scenes[0].id,
    canvas: {
      x: number(canvas.x, 'workspace X', -1e6, 1e6),
      y: number(canvas.y, 'workspace Y', -1e6, 1e6),
      zoom: number(canvas.zoom, 'workspace zoom', 0.2, 2),
    },
    updatedAt: number(p.updatedAt, 'save timestamp', 0, 1e16),
  };
}
