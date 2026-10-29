import { describe, expect, it } from 'vitest';
import { createSampleProject } from '../../src/lib/sample';
import { clone, layerFor } from '../../src/model';
import { removeProjectAsset, removeProjectScene } from '../../src/lib/project-updates';

describe('asset and scene synchronisation', () => {
  it('removes every view emptied by a deleted source and selects the next surviving view', () => {
    const original = createSampleProject();
    original.scenes.splice(1, 0, { ...clone(original.scenes[0]), id: 'second-cover-view' });
    const result = removeProjectAsset(original, 'cover');
    expect(result.scenes.map((scene) => scene.id)).toEqual(['scene-2', 'scene-3', 'scene-4']);
    expect(result.activeSceneId).toBe('scene-2');
    expect(result.assets.some((asset) => asset.id === 'cover')).toBe(false);
    expect(
      result.scenes.every((scene) =>
        scene.composition.layers.every((layer) => layer.assetId !== 'cover'),
      ),
    ).toBe(true);
    expect(original.scenes).toHaveLength(5);
  });

  it('preserves other layers, scripts and annotations in a composition that still has content', () => {
    const original = createSampleProject();
    original.scenes[0].composition.layers.push(layerFor(original.assets[1]));
    original.scenes[0].composition.annotations.push({
      id: 'mark',
      tool: 'pen',
      color: '#123456',
      width: 0.01,
      points: [{ x: 0.2, y: 0.3 }],
      createdAt: 1,
    });
    const result = removeProjectAsset(original, 'cover');
    expect(result.scenes).toHaveLength(4);
    expect(result.activeSceneId).toBe('scene-1');
    expect(result.scenes[0].composition.layers.map((layer) => layer.assetId)).toEqual(['earth']);
    expect(result.scenes[0].script).toBe(original.scenes[0].script);
    expect(result.scenes[0].composition.annotations).toEqual(
      original.scenes[0].composition.annotations,
    );
  });

  it('keeps deliberately empty or camera-only scenes when deleting another source', () => {
    const original = createSampleProject();
    original.scenes[1].composition.layers = [];
    original.scenes[1].composition.camera.enabled = true;
    const result = removeProjectAsset(original, 'cover');
    expect(result.scenes.find((scene) => scene.id === 'scene-2')?.composition.camera.enabled).toBe(
      true,
    );
    expect(result.scenes).toHaveLength(3);
  });

  it('clears the final view without leaving dangling layers or losing the presenter', () => {
    const original = createSampleProject();
    original.presenter = {
      ...original.scenes[0].composition.camera,
      enabled: true,
      size: 1.4,
      x: -0.1,
    };
    original.scenes = [original.scenes[0]];
    const result = removeProjectAsset(original, 'cover');
    expect(result.scenes).toHaveLength(1);
    expect(result.scenes[0].name).toBe('Empty scene');
    expect(result.scenes[0].composition.layers).toEqual([]);
    expect(result.scenes[0].script).toBe('');
    expect(result.scenes[0].composition.camera).toEqual(original.presenter);
    expect(result.scenes[0].id).toBe(result.activeSceneId);
  });

  it('leaves the active view alone when another scene is deleted and retains source assets', () => {
    const original = createSampleProject();
    original.activeSceneId = 'scene-3';
    const result = removeProjectScene(original, 'scene-1');
    expect(result.activeSceneId).toBe('scene-3');
    expect(result.assets).toEqual(original.assets);
    expect(result.scenes.map((scene) => scene.id)).toEqual(['scene-2', 'scene-3', 'scene-4']);
  });

  it('selects a neighbouring scene when the active one is deleted and supports clearing the last scene', () => {
    let result = createSampleProject();
    result.activeSceneId = 'scene-3';
    result = removeProjectScene(result, 'scene-3');
    expect(result.activeSceneId).toBe('scene-4');
    result = removeProjectScene(result, 'scene-4');
    expect(result.activeSceneId).toBe('scene-2');
    result = removeProjectScene(result, 'scene-1');
    result = removeProjectScene(result, 'scene-2');
    expect(result.scenes).toHaveLength(1);
    expect(result.scenes[0].composition.layers).toEqual([]);
    expect(result.scenes[0].composition.annotations).toEqual([]);
    expect(result.scenes[0].id).toBe(result.activeSceneId);
  });
});
