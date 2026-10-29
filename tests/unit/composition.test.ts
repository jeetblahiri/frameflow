import { describe, expect, it } from 'vitest';
import { imageRect } from '../../src/engine/composition';
import { createSampleProject } from '../../src/lib/sample';
import { clone, formatTime, recordingMime } from '../../src/model';
describe('independent presentation coordinates', () => {
  it('contains a landscape source within vertical output without cropping', () => {
    expect(imageRect(1600, 900, 1080, 1920, 'contain')).toEqual({
      x: 0,
      y: 656.25,
      w: 1080,
      h: 607.5,
    });
  });
  it('fills portrait output and crops the sides symmetrically', () => {
    const r = imageRect(1600, 900, 1080, 1920, 'cover');
    expect(r.h).toBe(1920);
    expect(r.w).toBeCloseTo(3413.333);
    expect(r.x).toBeCloseTo(-1166.667);
    expect(r.y).toBe(0);
  });
  it('applies zoom and pan in layer coordinates without moving source assets', () => {
    const p = createSampleProject(),
      original = clone(p.assets[0]);
    const layer = p.scenes[0].composition.layers[0];
    layer.zoom = 2;
    layer.panX = 0.2;
    const r = imageRect(
      original.width,
      original.height,
      1080,
      1920,
      layer.fit,
      layer.zoom,
      layer.panX,
      layer.panY,
    );
    expect(r.x).toBe(-324);
    expect(p.assets[0]).toEqual(original);
    expect(p.scenes[1].composition.layers[0].zoom).toBe(1);
  });
  it('keeps saved scene snapshots independent', () => {
    const p = createSampleProject();
    const copy = clone(p.scenes[0]);
    copy.composition.camera.x = 0.1;
    copy.composition.layers[0].page = 2;
    expect(p.scenes[0].composition.camera.x).toBe(0.65);
    expect(p.scenes[0].composition.layers[0].page).toBe(1);
  });
});
describe('recording capabilities', () => {
  it('falls back to a supported encoder without pretending WebM is MP4', () => {
    expect(recordingMime((t) => t === 'video/webm;codecs=vp8,opus')).toBe(
      'video/webm;codecs=vp8,opus',
    );
  });
  it('leaves the native browser default when no advertised codec matches', () => {
    expect(recordingMime(() => false)).toBeUndefined();
  });
  it('shows elapsed minutes and seconds', () => {
    expect(formatTime(125.9)).toBe('02:05');
  });
});
