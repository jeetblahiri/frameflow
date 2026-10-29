import { useEffect, useRef, useState } from 'react';
import {
  UploadCloud,
  Link2,
  ArrowUpRight,
  FileText,
  Image,
  Film,
  Music2,
  Check,
  Download,
  Trash2,
  Play,
  Video,
  Mic,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';
import type { Asset, Composition, Take } from '../model';
import { formatTime } from '../model';
import { importUrl } from '../lib/importers';
import { download } from '../lib/storage';
import { trimRecording } from '../engine/trim';
import type { Engine } from '../hooks/useEngine';
import { Modal, Range } from './ui';
import { CompositionThumb } from './Preview';
import { CameraPreview } from './Settings';
export function ImportDialog({
  onClose,
  onFiles,
  onAssets,
  notify,
}: {
  onClose: () => void;
  onFiles: (files: File[]) => Promise<void>;
  onAssets: (assets: Asset[]) => void;
  notify: (m: string, t?: 'error' | 'success') => void;
}) {
  const [tab, setTab] = useState('files'),
    [url, setUrl] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const files = async (f: File[]) => {
    setBusy(true);
    try {
      await onFiles(f);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      title="Bring your ideas in."
      subtitle="A whole world of content. One creative workspace."
      onClose={onClose}
    >
      <div className="dialog-tabs">
        <button className={tab === 'files' ? 'active' : ''} onClick={() => setTab('files')}>
          <UploadCloud size={15} />
          Upload files
        </button>
        <button className={tab === 'url' ? 'active' : ''} onClick={() => setTab('url')}>
          <Link2 size={15} />
          From a link
        </button>
      </div>
      {tab === 'files' ? (
        <>
          <input
            ref={input}
            data-testid="asset-file-input"
            hidden
            type="file"
            multiple
            accept="image/*,video/*,audio/*,.pdf,.txt,.md,.pptx"
            onChange={(e) => {
              if (e.target.files) void files([...e.target.files]);
            }}
          />
          <button
            className="drop-zone"
            disabled={busy}
            onClick={() => input.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              void files([...e.dataTransfer.files]);
            }}
          >
            <span className="upload-symbol">
              <UploadCloud size={28} />
            </span>
            <strong>{busy ? 'Preparing your content…' : 'Drop your files here'}</strong>
            <span>or click to browse your device</span>
            <small>Up to 300 MB per file · Your files stay on this device</small>
          </button>
          <div className="import-types">
            <span>
              <Image size={14} />
              Images & SVG
            </span>
            <span>
              <FileText size={14} />
              PDFs & text
            </span>
            <span>
              <Film size={14} />
              Videos & GIFs
            </span>
            <span>
              <Music2 size={14} />
              Audio
            </span>
          </div>
          <p className="help-text">
            PPTX imports slide text. Export a deck to PDF to preserve its original design. You can
            also paste screenshots straight into the studio.
          </p>
        </>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setBusy(true);
            setError('');
            void importUrl(url)
              .then((a) => {
                onAssets(a);
                if (a[0]?.kind === 'webpage')
                  notify('Live mobile webpage added. Use Interact to scroll and Annotate to draw.');
                onClose();
              })
              .catch((e) => setError(e.message))
              .finally(() => setBusy(false));
          }}
        >
          <label className="field-label">
            Content URL
            <input
              required
              aria-label="Content URL"
              type="url"
              placeholder="https://…"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </label>
          <div className="info-box">
            <Link2 size={18} />
            <p>
              Websites open live in a 390 px mobile viewport. Some sites block embedding; use a
              separate tab for those. Recording a live page needs tab-sharing permission in desktop
              Chrome or Edge.
            </p>
          </div>
          <button className="primary full" disabled={busy || !url}>
            {busy ? 'Checking link…' : 'Add to library'}
            <ArrowUpRight size={16} />
          </button>
        </form>
      )}
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
      <div className="dialog-footer">
        <ShieldCheck size={13} />
        Local by design. No uploads, no account needed.
      </div>
    </Modal>
  );
}
export function AssetEditor({
  asset,
  onSave,
  onClose,
}: {
  asset: Asset;
  onSave: (asset: Asset) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(asset);
  const isText = asset.kind === 'text' || asset.kind === 'article';
  return (
    <Modal
      title={isText ? 'Give your idea a voice.' : 'Asset details'}
      subtitle="Your content, your way."
      onClose={onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave(draft);
          onClose();
        }}
      >
        <label className="field-label">
          Name
          <input
            aria-label="Asset name"
            required
            maxLength={120}
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
        </label>
        {isText && (
          <>
            <label className="field-label">
              {asset.kind === 'article' ? 'Article or notes' : 'Text'}
              <textarea
                aria-label="Asset text"
                required
                className="content-editor"
                value={draft.text || ''}
                maxLength={30000}
                onChange={(e) => setDraft({ ...draft, text: e.target.value })}
              />
            </label>
            <div className="two-fields">
              <label className="color-field">
                Text color
                <input
                  aria-label="Text color"
                  type="color"
                  value={draft.color || '#35483b'}
                  onChange={(e) => setDraft({ ...draft, color: e.target.value })}
                />
              </label>
              <label className="color-field">
                Background
                <input
                  aria-label="Text background"
                  type="color"
                  value={draft.background || '#e9e9dc'}
                  onChange={(e) => setDraft({ ...draft, background: e.target.value })}
                />
              </label>
            </div>
            <label className="field-label">
              Font size (at 1080 px)
              <input
                aria-label="Asset font size"
                type="number"
                min={18}
                max={240}
                value={draft.fontSize || 64}
                onChange={(e) => setDraft({ ...draft, fontSize: Number(e.target.value) })}
              />
            </label>
            <p className="help-text">
              Use line breaks to separate paragraphs. For equations, paste Unicode math or import a
              rendered SVG.
            </p>
          </>
        )}
        {asset.kind === 'shape' && (
          <label className="color-field">
            Shape color
            <input
              aria-label="Shape color"
              type="color"
              value={draft.color || '#c8ef81'}
              onChange={(e) => setDraft({ ...draft, color: e.target.value })}
            />
          </label>
        )}
        {['video', 'audio'].includes(asset.kind) && (
          <Range
            label="Source volume"
            value={draft.volume ?? 1}
            onChange={(volume) => setDraft({ ...draft, volume })}
          />
        )}
        <div className="two-fields">
          <label className="field-label">
            Canvas width
            <input
              aria-label="Canvas asset width"
              type="number"
              min={80}
              max={1000}
              value={draft.boardWidth}
              onChange={(e) => setDraft({ ...draft, boardWidth: Number(e.target.value) })}
            />
          </label>
          <label className="field-label">
            Asset type
            <input readOnly value={asset.kind} />
          </label>
        </div>
        <button className="primary full" type="submit">
          <Check size={16} />
          Save asset
        </button>
      </form>
    </Modal>
  );
}
export function PreflightDialog({
  onClose,
  engine,
  composition,
  assets,
  width,
  onStart,
}: {
  onClose: () => void;
  engine: Engine;
  composition: Composition;
  assets: Asset[];
  width: number;
  onStart: () => Promise<void>;
}) {
  const [starting, setStarting] = useState(false);
  return (
    <Modal
      title="Ready when you are."
      subtitle="A quick check before your next great take."
      onClose={onClose}
    >
      <div className="preflight-layout">
        <div className="preflight-frame">
          <CompositionThumb composition={composition} assets={assets} media={engine.media} />
        </div>
        <div className="preflight-checks">
          <span className="eyebrow">YOUR OUTPUT</span>
          <strong>
            {width} × {(width * 16) / 9}
          </strong>
          <small>Vertical video · 30 fps</small>
          <div className="check-row">
            <Video size={15} />
            <span>{engine.cameraOn ? 'Camera connected' : 'Camera is off'}</span>
            <button disabled={engine.deviceBusy} onClick={() => void engine.toggleCamera()}>
              {engine.cameraOn ? 'Disable' : 'Enable'}
            </button>
          </div>
          <div className="check-row">
            <Mic size={15} />
            <span>{engine.micOn ? 'Microphone connected' : 'No microphone'}</span>
            <button disabled={engine.deviceBusy} onClick={() => void engine.toggleMic()}>
              {engine.micOn ? 'Disable' : 'Enable'}
            </button>
          </div>
          <div className="mini-meter">
            <div style={{ width: `${Math.min(100, engine.levels.mic * 100)}%` }} />
          </div>
          <small>
            {engine.micOn
              ? 'Say a few words to check your level.'
              : 'Your take will have no microphone narration.'}
          </small>
        </div>
      </div>
      {engine.cameraOn && <CameraPreview stream={engine.cameraStream} />}
      <div className="info-box">
        <ShieldCheck size={18} />
        <p>
          Only your recording frame is captured. Switch scenes and annotate freely. Keep the studio
          open while recording.
        </p>
      </div>
      <button
        className="record-button full"
        disabled={starting || engine.deviceBusy}
        onClick={() => {
          setStarting(true);
          void onStart().finally(() => setStarting(false));
        }}
      >
        <span className="record-dot" />
        {starting ? 'Preparing your take…' : 'Start recording'}
      </button>
    </Modal>
  );
}
export function TakeViewer({
  takes,
  initialId,
  onDelete,
  onClose,
  notify,
}: {
  takes: Take[];
  initialId?: string;
  onDelete: (id: string) => void;
  onClose: () => void;
  notify: (m: string, t?: 'error' | 'success') => void;
}) {
  const [selected, setSelected] = useState(initialId || takes[0]?.id),
    [url, setUrl] = useState('');
  const take = takes.find((t) => t.id === selected) || takes[0];
  const [showTrim, setShowTrim] = useState(false),
    [trimStart, setTrimStart] = useState(0),
    [trimEnd, setTrimEnd] = useState(0),
    [trimming, setTrimming] = useState(false),
    [progress, setProgress] = useState(0);
  const trimController = useRef<AbortController | null>(null);
  useEffect(() => {
    setTrimStart(0);
    setTrimEnd(take?.duration || 0);
    setShowTrim(false);
    return () => trimController.current?.abort();
  }, [take?.id]);
  useEffect(() => {
    if (!take) {
      setUrl('');
      return;
    }
    const u = URL.createObjectURL(take.blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [take]);
  return (
    <Modal
      wide
      title="Your recording room."
      subtitle="All your takes, safely on this device."
      onClose={onClose}
    >
      {take ? (
        <div className="take-layout">
          <div className="take-preview">
            <video
              key={url}
              src={url}
              controls
              playsInline
              aria-label="Recording preview"
              onError={() =>
                notify(
                  'This browser could not play this take. Download it and try a compatible video player.',
                  'error',
                )
              }
            />
          </div>
          <div className="take-details">
            <span className="eyebrow">{take.recovered ? 'RECOVERED TAKE' : 'THAT’S A WRAP'}</span>
            <h3>{take.name}</h3>
            <p>
              {formatTime(take.duration)} · {take.mime.includes('mp4') ? 'MP4' : 'WebM'} ·{' '}
              {(take.blob.size / 1024 / 1024).toFixed(1)} MB
            </p>
            <button
              className="primary full"
              onClick={() =>
                download(
                  take.blob,
                  `${take.name.replace(/[^\w -]/g, '').trim() || 'Frameflow'}-${take.id.slice(0, 6)}.${take.mime.includes('mp4') ? 'mp4' : 'webm'}`,
                )
              }
            >
              <Download size={16} />
              Download video
            </button>
            <p className="help-text">
              Full composition, presenter, annotations, and mixed audio. Downloads use the actual
              browser-encoded format.
            </p>
            <button
              className="secondary full"
              disabled={trimming}
              onClick={() => setShowTrim(!showTrim)}
            >
              Trim this take
            </button>
            {showTrim && (
              <div className="trim-controls">
                <div className="two-fields">
                  <label>
                    Start (seconds)
                    <input
                      aria-label="Trim start"
                      type="number"
                      step="0.1"
                      min="0"
                      max={take.duration}
                      value={trimStart}
                      disabled={trimming}
                      onChange={(e) => setTrimStart(Number(e.target.value))}
                    />
                  </label>
                  <label>
                    End (seconds)
                    <input
                      aria-label="Trim end"
                      type="number"
                      step="0.1"
                      min="0"
                      max={take.duration}
                      value={Number(trimEnd.toFixed(1))}
                      disabled={trimming}
                      onChange={(e) => setTrimEnd(Number(e.target.value))}
                    />
                  </label>
                </div>
                <button
                  className="primary full"
                  disabled={trimming || trimEnd <= trimStart || trimEnd > take.duration + 0.1}
                  onClick={() => {
                    trimController.current = new AbortController();
                    setTrimming(true);
                    void trimRecording(
                      take,
                      trimStart,
                      trimEnd,
                      trimController.current.signal,
                      setProgress,
                    )
                      .then((blob) => {
                        download(
                          blob,
                          `Frameflow-trim.${blob.type.includes('mp4') ? 'mp4' : 'webm'}`,
                        );
                        notify('Trim ready. Your original take is kept.');
                      })
                      .catch((e) => {
                        if (e.name !== 'AbortError') notify(e.message, 'error');
                      })
                      .finally(() => setTrimming(false));
                  }}
                >
                  {trimming ? `Trimming… ${Math.round(progress * 100)}%` : 'Trim & download'}
                </button>
                {trimming && (
                  <button
                    className="text-danger full"
                    onClick={() => trimController.current?.abort()}
                  >
                    Cancel trim
                  </button>
                )}
                <p className="help-text">
                  Trims re-encode in real time. Keep this window open. The original is always kept.
                </p>
              </div>
            )}
            <div className="library-section-title">
              <span>YOUR TAKES</span>
              <span>{takes.length}</span>
            </div>
            <div className="take-list">
              {takes.map((t, i) => (
                <div key={t.id} className={t.id === take.id ? 'active' : ''}>
                  <button onClick={() => setSelected(t.id)}>
                    <Play size={14} />
                    <span>
                      <strong>Take {takes.length - i}</strong>
                      <small>
                        {new Date(t.createdAt).toLocaleString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}{' '}
                        · {formatTime(t.duration)}
                      </small>
                    </span>
                  </button>
                  <button
                    aria-label={`Delete take ${takes.length - i}`}
                    title="Delete this take"
                    onClick={() => onDelete(t.id)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="empty-state large">
          <Video size={36} />
          <h3>Your story starts with a take.</h3>
          <p>Record something in the studio. You’ll find it here.</p>
          <button className="primary" onClick={onClose}>
            Back to studio
          </button>
        </div>
      )}
    </Modal>
  );
}
export function HelpDialog({ onClose }: { onClose: () => void }) {
  return (
    <Modal
      title="Find your flow."
      subtitle="A few small things to make a big difference."
      onClose={onClose}
    >
      <div className="help-steps">
        {[
          [
            '01',
            'Bring your ideas in',
            'Drop images, PDFs, local video, audio, or text into the studio. Your project is saved on this device.',
          ],
          [
            '02',
            'Choose what’s in frame',
            'Double-click an asset or click Focus. Drag inside the vertical frame to pan; open Focus Lens to zoom, crop, layer, or change PDF pages.',
          ],
          [
            '03',
            'Make it a conversation',
            'Enable your camera and microphone. Write a script, save scenes, and use the pen to explain as you go.',
          ],
          [
            '04',
            'One continuous story',
            'Record, switch scenes with the arrow keys, pause when needed, then stop to preview and download. Back up your project from the project menu.',
          ],
        ].map(([n, t, d]) => (
          <div key={n}>
            <span>{n}</span>
            <div>
              <strong>{t}</strong>
              <p>{d}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="keyboard-grid">
        <span>
          Import content<kbd>⌘ / Ctrl I</kbd>
        </span>
        <span>
          Save locally<kbd>⌘ / Ctrl S</kbd>
        </span>
        <span>
          Previous / next scene<kbd>← / →</kbd>
        </span>
        <span>
          Pen / select / hand<kbd>P / V / H</kbd>
        </span>
        <span>
          Pause / resume take<kbd>Space</kbd>
        </span>
        <span>
          Undo annotation<kbd>⌘ / Ctrl Z</kbd>
        </span>
      </div>
      <div className="info-box">
        <AlertCircle size={17} />
        <p>
          Use HTTPS on iPad. Browser recording support varies. Keep this tab in the foreground; a
          backgrounded take pauses. Test a short take before a long session.
        </p>
      </div>
    </Modal>
  );
}
