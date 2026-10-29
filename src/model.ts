export type AssetKind = 'image' | 'video' | 'audio' | 'pdf' | 'text' | 'article' | 'shape' | 'link';
export type Fit = 'contain' | 'cover';
export type Point = { x: number; y: number; pressure?: number };
export type Tool =
  'select' | 'pen' | 'highlighter' | 'arrow' | 'rectangle' | 'circle' | 'line' | 'laser' | 'eraser';
export interface Annotation {
  id: string;
  tool: Tool;
  color: string;
  width: number;
  points: Point[];
  createdAt: number;
}
export interface Asset {
  id: string;
  kind: AssetKind;
  name: string;
  src?: string;
  blobKey?: string;
  mime?: string;
  volume?: number;
  text?: string;
  color?: string;
  background?: string;
  fontSize?: number;
  shape?: 'rectangle' | 'circle' | 'arrow';
  width: number;
  height: number;
  x: number;
  y: number;
  boardWidth: number;
  pages?: number;
  url?: string;
}
export interface Layer {
  id: string;
  assetId: string;
  x: number;
  y: number;
  w: number;
  h: number;
  zoom: number;
  panX: number;
  panY: number;
  fit: Fit;
  page: number;
  opacity: number;
}
export interface CameraConfig {
  enabled: boolean;
  shape: 'circle' | 'rounded' | 'square' | 'wide';
  x: number;
  y: number;
  size: number;
  mirror: boolean;
  border: string;
  blur: number;
}
export interface Composition {
  layers: Layer[];
  background: string;
  camera: CameraConfig;
  annotations: Annotation[];
  branding: boolean;
}
export interface Scene {
  id: string;
  name: string;
  composition: Composition;
  script: string;
  transition: 'cut' | 'fade';
}
export interface Project {
  version: 1;
  id: string;
  name: string;
  assets: Asset[];
  scenes: Scene[];
  activeSceneId: string;
  canvas: { x: number; y: number; zoom: number };
  updatedAt: number;
}
export type RecordingState = 'idle' | 'starting' | 'recording' | 'paused' | 'stopping';
export interface Take {
  id: string;
  name: string;
  createdAt: number;
  duration: number;
  mime: string;
  blob: Blob;
  recovered?: boolean;
}
export interface Recovery {
  id: string;
  name: string;
  mime: string;
  startedAt: number;
  duration: number;
  chunks: number;
}
export const uid = () => crypto.randomUUID();
export const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
export const clone = <T>(value: T): T => structuredClone(value);
export const DEFAULT_CAMERA: CameraConfig = {
  enabled: false,
  shape: 'rounded',
  x: 0.65,
  y: 0.73,
  size: 0.29,
  mirror: true,
  border: '#d2edb0',
  blur: 0,
};
export function layerFor(asset: Asset): Layer {
  return {
    id: uid(),
    assetId: asset.id,
    x: 0,
    y: 0,
    w: 1,
    h: 1,
    zoom: 1,
    panX: 0,
    panY: 0,
    fit: 'contain',
    page: 1,
    opacity: 1,
  };
}
export function formatTime(seconds: number) {
  return `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0')}:${Math.floor(seconds % 60)
    .toString()
    .padStart(2, '0')}`;
}
export function recordingMime(supported: (type: string) => boolean): string | undefined {
  return [
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
    'video/mp4',
  ].find(supported);
}
