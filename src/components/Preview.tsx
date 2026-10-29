import { useEffect, useMemo, useRef } from 'react';
import { AudioLines, FileText, Link2, Play, Shapes } from 'lucide-react';
import type { Asset, Composition } from '../model';
import { layerFor, DEFAULT_CAMERA } from '../model';
import { drawComposition } from '../engine/composition';
import type { MediaLibrary } from '../engine/media';
export function AssetPreview({ asset, media }: { asset: Asset; media: MediaLibrary }) {
  const thumbComposition = useMemo<Composition>(
    () => ({
      layers: [layerFor(asset)],
      background: '#e8e9dc',
      annotations: [],
      camera: { ...DEFAULT_CAMERA },
      branding: false,
    }),
    [asset],
  );
  if (asset.kind === 'image' && asset.src)
    return <img draggable={false} src={asset.src} alt="" loading="lazy" />;
  if (asset.kind === 'text' || asset.kind === 'article')
    return (
      <div
        className={`text-preview ${asset.kind}`}
        style={{ background: asset.background, color: asset.color }}
      >
        <span>{asset.kind === 'article' && <FileText size={14} />}</span>
        <p>{asset.text?.slice(0, 240)}</p>
      </div>
    );
  if (asset.kind === 'audio')
    return (
      <div className="media-preview audio">
        <AudioLines size={38} />
        <span>AUDIO TRACK</span>
      </div>
    );
  if (asset.kind === 'link' || asset.kind === 'webpage')
    return (
      <div className="media-preview">
        <Link2 size={28} />
        <span>{asset.url ? new URL(asset.url).hostname : 'REFERENCE'}</span>
      </div>
    );
  if (asset.kind === 'shape')
    return (
      <div className="media-preview" style={{ color: asset.color }}>
        <Shapes size={40} />
        <span>{asset.shape}</span>
      </div>
    );
  return (
    <>
      <CompositionThumb composition={thumbComposition} assets={[asset]} media={media} />
      {asset.kind === 'video' && <Play className="play-badge" size={22} />}
    </>
  );
}
export function CompositionThumb({
  composition,
  assets,
  media,
}: {
  composition: Composition;
  assets: Asset[];
  media: MediaLibrary;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const draw = () => {
      const ctx = ref.current?.getContext('2d');
      if (ctx) drawComposition(ctx, composition, assets, media);
    };
    draw();
    const id = setInterval(draw, 450);
    return () => clearInterval(id);
  }, [composition, assets, media]);
  return <canvas width={135} height={240} ref={ref} aria-hidden="true" />;
}
