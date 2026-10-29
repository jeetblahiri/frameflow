import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { validateProject } from '../../src/lib/project-validation';
import { checkZipBudget, readArchiveEntry } from '../../src/lib/archive';
import { createSampleProject } from '../../src/lib/sample';

describe('portable project boundaries', () => {
  it('accepts a complete project and strips unknown fields', () => {
    const p = { ...createSampleProject(), unexpected: { execute: 'anything' } };
    const result = validateProject(p);
    expect(result.scenes).toHaveLength(4);
    expect(result).not.toHaveProperty('unexpected');
  });
  it('rejects duplicate asset identities before any media is written', () => {
    const p = createSampleProject();
    p.assets[1].id = p.assets[0].id;
    expect(() => validateProject(p)).toThrow('Duplicate asset');
  });
  it('rejects unknown sources, invalid page indices and camera settings', () => {
    const p = createSampleProject();
    p.scenes[0].composition.layers[0].assetId = 'missing';
    expect(() => validateProject(p)).toThrow('missing asset');
    p.scenes[0].composition.layers[0].assetId = 'cover';
    p.scenes[0].composition.layers[0].page = 2;
    expect(() => validateProject(p)).toThrow('document page');
    p.scenes[0].composition.layers[0].page = 1;
    p.scenes[0].composition.camera.size = -1;
    expect(() => validateProject(p)).toThrow('camera size');
  });
  it('rejects active URL schemes and nonfinite coordinates', () => {
    const p = createSampleProject();
    p.assets[0].url = 'javascript:alert(1)';
    expect(() => validateProject(p)).toThrow('HTTP');
    delete p.assets[0].url;
    p.canvas.x = Infinity;
    expect(() => validateProject(p)).toThrow('workspace X');
  });
  it('rejects non-renderable stroke data', () => {
    const p = createSampleProject();
    p.scenes[0].composition.annotations = [
      {
        id: 'mark',
        tool: 'pen',
        color: '#fff',
        width: 0.007,
        createdAt: 0,
        points: [{ x: NaN, y: 0.2 }],
      },
    ];
    expect(() => validateProject(p)).toThrow('point X');
  });
});
describe('archive expansion limits', () => {
  it('accepts bounded projects and rejects expanded payloads before decoding', async () => {
    const zip = new JSZip();
    zip.file('project.json', 'a'.repeat(10000));
    const bytes = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
    expect(() => checkZipBudget(bytes, 20000)).not.toThrow();
    expect(() => checkZipBudget(bytes, 100)).toThrow('expanded size');
  });
  it('rejects paths outside the archive namespace', async () => {
    const zip = new JSZip();
    zip.file('../escape.txt', 'bad');
    const bytes = await zip.generateAsync({ type: 'uint8array' });
    expect(() => checkZipBudget(bytes)).toThrow('Unsafe');
  });
  it('also limits actual output during entry decompression', async () => {
    const zip = new JSZip();
    zip.file('data.txt', 'a'.repeat(100000));
    const bytes = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
    const opened = await JSZip.loadAsync(bytes);
    await expect(readArchiveEntry(opened.file('data.txt')!, 100)).rejects.toThrow('size limit');
  });
});

describe('live web and shared presenter persistence', () => {
  it('roundtrips free-position cutouts while retaining compatibility with older projects', () => {
    const p = createSampleProject();
    expect(validateProject(p).presenter).toBeUndefined();
    p.presenter = {
      ...p.scenes[0].composition.camera,
      background: 'remove',
      size: 2.5,
      x: -1.4,
      y: -0.4,
      enabled: true,
    };
    p.assets.push({
      id: 'live-page',
      kind: 'webpage',
      name: 'Live',
      url: 'https://example.com/',
      width: 390,
      height: 693,
      x: 0,
      y: 0,
      boardWidth: 240,
    });
    const restored = validateProject(p);
    expect(restored.presenter).toEqual(p.presenter);
    expect(restored.assets.at(-1)?.kind).toBe('webpage');
  });
  it('rejects unsafe or missing live-page URLs and out-of-bounds presenter data', () => {
    const p = createSampleProject();
    p.assets.push({
      id: 'live-page',
      kind: 'webpage',
      name: 'Live',
      width: 390,
      height: 693,
      x: 0,
      y: 0,
      boardWidth: 240,
    });
    expect(() => validateProject(p)).toThrow('source URL');
    p.assets.at(-1)!.url = 'https://user:password@example.com/';
    expect(() => validateProject(p)).toThrow('credentials');
    p.assets.at(-1)!.url = 'https://example.com/';
    p.presenter = { ...p.scenes[0].composition.camera, size: 4 };
    expect(() => validateProject(p)).toThrow('camera size');
  });
});
