import type { Project, Scene } from '../model';

function retainScenes(project: Project, scenes: Scene[]): Project {
  if (!scenes.length) {
    const current =
      project.scenes.find((scene) => scene.id === project.activeSceneId) || project.scenes[0];
    // The last view becomes an empty working scene; the shared presenter stays available.
    const empty: Scene = {
      ...current,
      name: 'Empty scene',
      script: '',
      transition: 'cut',
      composition: {
        ...current.composition,
        layers: [],
        annotations: [],
        camera: { ...(project.presenter || current.composition.camera) },
      },
    };
    return { ...project, scenes: [empty], activeSceneId: empty.id };
  }
  if (scenes.some((scene) => scene.id === project.activeSceneId)) return { ...project, scenes };
  const activeIndex = project.scenes.findIndex((scene) => scene.id === project.activeSceneId);
  const remaining = new Set(scenes.map((scene) => scene.id));
  const next =
    project.scenes.slice(activeIndex + 1).find((scene) => remaining.has(scene.id)) ||
    scenes.at(-1)!;
  return { ...project, scenes, activeSceneId: next.id };
}

export function removeProjectAsset(project: Project, assetId: string): Project {
  if (!project.assets.some((asset) => asset.id === assetId)) return project;
  const scenes = project.scenes.flatMap((scene) => {
    if (!scene.composition.layers.some((layer) => layer.assetId === assetId)) return [scene];
    const layers = scene.composition.layers.filter((layer) => layer.assetId !== assetId);
    // Only prune views emptied by this deletion. Deliberate camera-only/blank views stay intact.
    return layers.length ? [{ ...scene, composition: { ...scene.composition, layers } }] : [];
  });
  return retainScenes(
    { ...project, assets: project.assets.filter((asset) => asset.id !== assetId) },
    scenes,
  );
}

export function removeProjectScene(project: Project, sceneId: string): Project {
  if (!project.scenes.some((scene) => scene.id === sceneId)) return project;
  return retainScenes(
    project,
    project.scenes.filter((scene) => scene.id !== sceneId),
  );
}
