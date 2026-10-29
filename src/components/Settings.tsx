import { useEffect, useRef, useState } from 'react';
import {
  Camera,
  Mic,
  VideoOff,
  Circle,
  Square,
  RectangleVertical,
  RectangleHorizontal,
  Volume2,
  SlidersHorizontal,
  Layers,
  Trash2,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  Play,
  Pause,
  ExternalLink,
} from 'lucide-react';
import type { Asset, Composition } from '../model';
import type { Engine } from '../hooks/useEngine';
import { IconButton, Range, Toggle } from './ui';
export function CameraPreview({ stream }: { stream?: MediaStream }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current) {
      ref.current.srcObject = stream || null;
      if (stream) void ref.current.play().catch(() => {});
    }
  }, [stream]);
  return (
    <div className="camera-preview">
      {stream ? (
        <video ref={ref} muted playsInline autoPlay />
      ) : (
        <div>
          <VideoOff size={25} />
          <span>Your camera preview</span>
        </div>
      )}
    </div>
  );
}
export function DeviceSettings({
  engine,
  composition,
  update,
  width,
  setWidth,
}: {
  engine: Engine;
  composition: Composition;
  update: (fn: (c: Composition) => Composition) => void;
  width: number;
  setWidth: (n: number) => void;
}) {
  const [mic, setMic] = useState(engine.mixer.settings.mic),
    [media, setMedia] = useState(engine.mixer.settings.media),
    [master, setMaster] = useState(engine.mixer.settings.master),
    [monitor, setMonitor] = useState(engine.mixer.settings.monitor);
  const camera = composition.camera;
  return (
    <div className="settings-scroll">
      <section className="settings-section">
        <div className="section-label">
          <Camera size={15} />
          <h3>Presenter camera</h3>
          <span className={`status-dot ${engine.cameraOn ? 'on' : ''}`} />
        </div>
        {camera.background !== 'remove' && <CameraPreview stream={engine.cameraStream} />}
        <button
          className="secondary full"
          disabled={engine.deviceBusy}
          onClick={() => void engine.toggleCamera()}
        >
          {engine.cameraOn ? <VideoOff size={14} /> : <Camera size={14} />}{' '}
          {engine.cameraOn ? 'Turn camera off' : 'Enable camera'}
        </button>
        <div className="segmented presenter-background" aria-label="Camera background">
          <button
            className={camera.background !== 'remove' ? 'active' : ''}
            onClick={() =>
              update((c) => ({ ...c, camera: { ...c.camera, background: 'original' } }))
            }
          >
            Original
          </button>
          <button
            className={camera.background === 'remove' ? 'active' : ''}
            onClick={() => update((c) => ({ ...c, camera: { ...c.camera, background: 'remove' } }))}
          >
            Remove background
          </button>
        </div>
        {camera.background === 'remove' && (
          <p
            className={engine.presenterStatus === 'error' ? 'inline-error' : 'help-text'}
            role="status"
          >
            {engine.presenterStatus === 'error'
              ? 'Background removal could not start. Choose Original or switch modes to retry.'
              : engine.presenterStatus === 'loading'
                ? 'Preparing background removal on your device…'
                : engine.presenterStatus === 'ready'
                  ? 'Background removal ready · processed on this device.'
                  : 'Enable the camera to prepare background removal.'}
          </p>
        )}
        <p className="help-text">Your presenter stays with you across every scene.</p>
        {camera.background !== 'remove' && (
          <>
            <div className="camera-shapes">
              {(
                [
                  { shape: 'circle', icon: Circle },
                  { shape: 'rounded', icon: RectangleVertical },
                  { shape: 'square', icon: Square },
                  { shape: 'wide', icon: RectangleHorizontal },
                ] as const
              ).map(({ shape, icon: Icon }) => (
                <IconButton
                  key={shape}
                  label={`${shape} camera`}
                  active={camera.shape === shape}
                  onClick={() =>
                    update((c) => ({
                      ...c,
                      camera: {
                        ...c.camera,
                        shape,
                        x: shape === 'wide' ? 0.05 : c.camera.x,
                        size: shape === 'wide' ? 0.9 : c.camera.size > 0.6 ? 0.29 : c.camera.size,
                      },
                    }))
                  }
                >
                  <Icon size={18} />
                </IconButton>
              ))}
            </div>
          </>
        )}
        <Toggle
          label="Show presenter in frame"
          checked={camera.enabled}
          onChange={() =>
            update((c) => ({ ...c, camera: { ...c.camera, enabled: !c.camera.enabled } }))
          }
        />
        <Toggle
          label="Mirror camera"
          checked={camera.mirror}
          onChange={() =>
            update((c) => ({ ...c, camera: { ...c.camera, mirror: !c.camera.mirror } }))
          }
        />
        <Range
          label="Camera size"
          value={camera.size}
          min={0.1}
          max={3}
          onChange={(size) =>
            update((c) => ({
              ...c,
              camera: { ...c.camera, size },
            }))
          }
        />
        <Range
          label="Presenter horizontal position"
          value={camera.x}
          min={-2}
          max={1}
          onChange={(x) => update((c) => ({ ...c, camera: { ...c.camera, x } }))}
        />
        <Range
          label="Presenter vertical position"
          value={camera.y}
          min={-2}
          max={1}
          onChange={(y) => update((c) => ({ ...c, camera: { ...c.camera, y } }))}
        />
        <div className="segmented">
          <button
            onClick={() =>
              update((c) => ({ ...c, camera: { ...c.camera, x: 0.65, y: 0.73, size: 0.29 } }))
            }
          >
            Corner
          </button>
          <button
            onClick={() =>
              update((c) => ({ ...c, camera: { ...c.camera, x: 0, y: 0.35, size: 1 } }))
            }
          >
            Full width
          </button>
          <button
            onClick={() =>
              update((c) => ({ ...c, camera: { ...c.camera, x: -0.5, y: 0.25, size: 2 } }))
            }
          >
            Close-up
          </button>
        </div>
        {camera.background !== 'remove' && (
          <label className="color-field">
            Border color
            <input
              aria-label="Camera border color"
              type="color"
              value={camera.border || '#ffffff'}
              onChange={(e) =>
                update((c) => ({ ...c, camera: { ...c.camera, border: e.target.value } }))
              }
            />
          </label>
        )}
        <small className="muted">
          Use the select tool to drag or resize your presenter. Size can extend beyond the frame.
        </small>
        <details className="advanced-settings">
          <summary>Camera device</summary>{' '}
          <label className="field-label">
            Camera
            <select
              aria-label="Camera device"
              disabled={engine.deviceBusy}
              value={engine.cameraId}
              onChange={(e) => void engine.changeCamera(e.target.value)}
            >
              <option value="">Default camera</option>
              {engine.devices
                .filter((d) => d.kind === 'videoinput')
                .map((d, i) => (
                  <option value={d.deviceId} key={d.deviceId || i}>
                    {d.label || `Camera ${i + 1}`}
                  </option>
                ))}
            </select>
          </label>
        </details>
      </section>
      <details className="settings-section advanced-settings">
        <summary>Audio mixer</summary>
        <div className="section-label">
          <Mic size={15} />
          <h3>Audio mixer</h3>
          <span className={`status-dot ${engine.micOn ? 'on' : ''}`} />
        </div>
        <button
          className="secondary full"
          disabled={engine.deviceBusy}
          onClick={() => void engine.toggleMic()}
        >
          <Mic size={14} />
          {engine.micOn ? 'Disable microphone' : 'Enable microphone'}
        </button>
        <label className="field-label">
          Microphone
          <select
            aria-label="Microphone device"
            disabled={engine.deviceBusy}
            value={engine.micId}
            onChange={(e) => void engine.changeMic(e.target.value)}
          >
            <option value="">Default microphone</option>
            {engine.devices
              .filter((d) => d.kind === 'audioinput')
              .map((d, i) => (
                <option value={d.deviceId} key={d.deviceId || i}>
                  {d.label || `Microphone ${i + 1}`}
                </option>
              ))}
          </select>
        </label>
        <Range
          label="Microphone gain"
          value={mic}
          max={2}
          onChange={(v) => {
            setMic(v);
            engine.mixer.setMic(v);
          }}
        />
        <Range
          label="Media audio"
          value={media}
          onChange={(v) => {
            setMedia(v);
            engine.mixer.setMedia(v);
          }}
        />
        <Range
          label="Master output"
          value={master}
          onChange={(v) => {
            setMaster(v);
            engine.mixer.setMaster(v);
          }}
        />
        <Range
          label="Media monitoring"
          value={monitor}
          onChange={(v) => {
            setMonitor(v);
            engine.mixer.setMonitor(v);
          }}
        />
        <div className={`audio-notice ${engine.levels.master > 0.97 ? 'clipping' : ''}`}>
          <Volume2 size={14} />
          {engine.levels.master > 0.97
            ? 'Clipping detected. Lower your input gain.'
            : 'Microphone monitoring is off to avoid feedback.'}
        </div>
      </details>
      <details className="settings-section advanced-settings">
        <summary>Recording output</summary>
        <div className="section-label">
          <SlidersHorizontal size={15} />
          <h3>Recording output</h3>
        </div>
        <label className="field-label">
          Resolution
          <select
            aria-label="Recording resolution"
            disabled={engine.state !== 'idle'}
            value={width}
            onChange={(e) => setWidth(Number(e.target.value))}
          >
            <option value={1080}>1080 × 1920 · Full HD</option>
            <option value={720}>720 × 1280 · Balanced</option>
          </select>
        </label>
        <Toggle
          label="Frameflow watermark"
          checked={composition.branding}
          onChange={() => update((c) => ({ ...c, branding: !c.branding }))}
        />
        <p className="help-text">
          30 fps. MP4 when the browser supports it; WebM otherwise. Your download always keeps its
          original format.
        </p>
      </details>
    </div>
  );
}
export function FocusSettings({
  composition,
  assets,
  update,
  engine,
  onEdit,
}: {
  composition: Composition;
  assets: Asset[];
  update: (fn: (c: Composition) => Composition) => void;
  engine: Engine;
  onEdit: (asset: Asset) => void;
}) {
  const [selected, setSelected] = useState<string>();
  const layer = composition.layers.find((l) => l.id === selected) || composition.layers.at(-1);
  const asset = assets.find((a) => a.id === layer?.assetId);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    const id = setInterval(() => {
      if (asset && (asset.kind === 'video' || asset.kind === 'audio'))
        setPlaying(!engine.media.element(asset)?.paused);
      else setPlaying(false);
    }, 200);
    return () => clearInterval(id);
  }, [asset, engine.media]);
  const patch = (value: Partial<NonNullable<typeof layer>>) =>
    update((c) => ({
      ...c,
      layers: c.layers.map((l) => (l.id === layer?.id ? { ...l, ...value } : l)),
    }));
  return (
    <div className="settings-scroll">
      <section className="settings-section">
        <span className="eyebrow">YOUR FOCUS LENS</span>
        <h3 className="focus-title">A new way to see it.</h3>
        <p className="help-text">
          Adjust your presentation independently. Your original canvas content stays exactly where
          you put it.
        </p>
        <div className="section-label">
          <Layers size={14} />
          <h3>Frame layers</h3>
          <span>{composition.layers.length}</span>
        </div>
        <div className="layer-list">
          {[...composition.layers].reverse().map((l) => (
            <button
              key={l.id}
              onClick={() => setSelected(l.id)}
              className={l.id === layer?.id ? 'active' : ''}
            >
              <span>{assets.find((a) => a.id === l.assetId)?.name || 'Missing asset'}</span>
              <span>{l.id === layer?.id ? '●' : '○'}</span>
            </button>
          ))}
        </div>
        {layer && asset ? (
          <>
            <div className="focus-asset-title">
              <strong>{asset.name}</strong>
              <IconButton label="Edit asset content" onClick={() => onEdit(asset)}>
                <SlidersHorizontal size={14} />
              </IconButton>
            </div>
            {asset.kind === 'webpage' ? (
              <p className="help-text">
                Live mobile page · 390 px viewport. Use Interact above the frame to scroll or use
                forms. Switch to Annotate / move to draw. Connect capture before recording. Marks
                stay at their frame positions as the page scrolls.
              </p>
            ) : (
              <>
                <div className="segmented">
                  <button
                    className={layer.fit === 'contain' ? 'active' : ''}
                    onClick={() => patch({ fit: 'contain', zoom: 1, panX: 0, panY: 0 })}
                  >
                    Fit
                  </button>
                  <button
                    className={layer.fit === 'cover' ? 'active' : ''}
                    onClick={() => patch({ fit: 'cover', zoom: 1, panX: 0, panY: 0 })}
                  >
                    Fill / crop
                  </button>
                  <IconButton
                    label="Reset focus view"
                    onClick={() => patch({ zoom: 1, panX: 0, panY: 0, x: 0, y: 0, w: 1, h: 1 })}
                  >
                    <RotateCcw size={14} />
                  </IconButton>
                </div>
                <Range
                  label="Focus zoom"
                  value={layer.zoom}
                  min={0.25}
                  max={4}
                  step={0.05}
                  onChange={(zoom) => patch({ zoom })}
                />
                <Range
                  label="Horizontal pan"
                  value={layer.panX}
                  min={-1}
                  max={1}
                  onChange={(panX) => patch({ panX })}
                />
                <Range
                  label="Vertical pan"
                  value={layer.panY}
                  min={-1}
                  max={1}
                  onChange={(panY) => patch({ panY })}
                />
                <div className="two-fields">
                  <label>
                    Position X
                    <input
                      aria-label="Layer X"
                      type="number"
                      min={-100}
                      max={100}
                      value={Math.round(layer.x * 100)}
                      onChange={(e) => patch({ x: Number(e.target.value) / 100 })}
                    />
                  </label>
                  <label>
                    Position Y
                    <input
                      aria-label="Layer Y"
                      type="number"
                      min={-100}
                      max={100}
                      value={Math.round(layer.y * 100)}
                      onChange={(e) => patch({ y: Number(e.target.value) / 100 })}
                    />
                  </label>
                </div>
                <Range
                  label="Layer width"
                  value={layer.w}
                  min={0.1}
                  max={1.5}
                  onChange={(w) => patch({ w })}
                />
                <Range
                  label="Layer height"
                  value={layer.h}
                  min={0.1}
                  max={1.5}
                  onChange={(h) => patch({ h })}
                />
                <Range
                  label="Opacity"
                  value={layer.opacity}
                  onChange={(opacity) => patch({ opacity })}
                />
              </>
            )}
            {asset.kind === 'pdf' && (
              <label className="field-label">
                Document page
                <select
                  aria-label="PDF page"
                  value={layer.page}
                  onChange={(e) => patch({ page: Number(e.target.value) })}
                >
                  {Array.from({ length: asset.pages || 1 }, (_, i) => (
                    <option key={i} value={i + 1}>
                      Page {i + 1} of {asset.pages}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {['video', 'audio'].includes(asset.kind) && (
              <button className="secondary full" onClick={() => void engine.play(asset)}>
                {playing ? <Pause size={15} /> : <Play size={15} />}{' '}
                {playing ? 'Pause media' : 'Play media with audio'}
              </button>
            )}
            {asset.kind === 'link' && (
              <>
                <p className="help-text">
                  External pages are recorded as reference cards. Import a screenshot, PDF, or
                  pasted article text for a visual snapshot.
                </p>
                <a className="secondary full" href={asset.url} target="_blank" rel="noreferrer">
                  Open source
                  <ExternalLink size={13} />
                </a>
              </>
            )}
            <div className="layer-order">
              <IconButton
                label="Move layer forward"
                onClick={() =>
                  update((c) => {
                    const layers = [...c.layers];
                    const i = layers.findIndex((l) => l.id === layer.id);
                    if (i < layers.length - 1)
                      [layers[i], layers[i + 1]] = [layers[i + 1], layers[i]];
                    return { ...c, layers };
                  })
                }
              >
                <ArrowUp size={15} />
              </IconButton>
              <IconButton
                label="Move layer backward"
                onClick={() =>
                  update((c) => {
                    const layers = [...c.layers];
                    const i = layers.findIndex((l) => l.id === layer.id);
                    if (i > 0) [layers[i], layers[i - 1]] = [layers[i - 1], layers[i]];
                    return { ...c, layers };
                  })
                }
              >
                <ArrowDown size={15} />
              </IconButton>
              <button
                className="text-danger"
                onClick={() =>
                  update((c) => ({ ...c, layers: c.layers.filter((l) => l.id !== layer.id) }))
                }
              >
                <Trash2 size={13} />
                Remove layer
              </button>
            </div>
          </>
        ) : (
          <div className="empty-state">
            <Layers size={25} />
            <p>Your frame is a blank canvas.</p>
            <span>Focus an asset from the library to begin.</span>
          </div>
        )}
      </section>
      <section className="settings-section">
        <label className="color-field">
          Frame background
          <input
            aria-label="Frame background"
            type="color"
            value={composition.background}
            onChange={(e) => update((c) => ({ ...c, background: e.target.value }))}
          />
        </label>
      </section>
    </div>
  );
}
