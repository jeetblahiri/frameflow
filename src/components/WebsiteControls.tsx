import {
  ArrowLeft,
  ArrowRight,
  Globe2,
  RefreshCw,
  MousePointer2,
  PenLine,
  MonitorUp,
  X,
} from 'lucide-react';
import type { Asset } from '../model';
import type { WebCapture } from '../hooks/useWebCapture';
export function WebsiteControls({ asset, web }: { asset: Asset; web: WebCapture }) {
  const remote = web.mode === 'remote';
  return (
    <section
      className={`website-controls ${web.mode === 'off' && web.view !== 'embed' ? 'website-idle' : ''}`}
      aria-label="Website controls"
    >
      <div className="website-address">
        <Globe2 size={16} />
        <span title={web.remote.pageInfo.url || asset.url}>
          {remote ? web.remote.pageInfo.url : asset.url}
        </span>
        <small>
          {web.mode === 'tab'
            ? 'Shared tab'
            : web.view === 'embed'
              ? 'Embedded · 390 px'
              : web.remote.available
                ? 'Mobile · 390 px'
                : 'Website'}
        </small>
      </div>
      <div className="website-actions">
        {remote && (
          <div className="browser-navigation">
            <button
              aria-label="Go back on website"
              onClick={() => web.remote.send({ type: 'back' })}
            >
              <ArrowLeft size={16} />
            </button>
            <button
              aria-label="Go forward on website"
              onClick={() => web.remote.send({ type: 'forward' })}
            >
              <ArrowRight size={16} />
            </button>
            <button aria-label="Reload website" onClick={() => web.remote.send({ type: 'reload' })}>
              <RefreshCw size={15} />
            </button>
          </div>
        )}
        {(remote || web.view === 'embed') && (
          <div className="segmented">
            <button className={web.interact ? 'active' : ''} onClick={() => web.setInteract(true)}>
              <MousePointer2 size={14} />
              Interact
            </button>
            <button
              className={!web.interact ? 'active' : ''}
              onClick={() => web.setInteract(false)}
            >
              <PenLine size={14} />
              Annotate
            </button>
          </div>
        )}
        {web.mode !== 'off' && (
          <button className="secondary" onClick={web.stop}>
            <X size={14} />
            Disconnect
          </button>
        )}
        {web.view === 'embed' && web.mode === 'off' && (
          <button
            className="secondary"
            disabled={web.busy}
            onClick={() => void web.connect('embedded')}
          >
            {web.busy ? 'Connecting…' : 'Connect embedded capture'}
          </button>
        )}
        <details className="website-options">
          <summary>More options</summary>
          <div>
            {remote && (
              <button onClick={() => web.remote.send({ type: 'reader' })}>
                Readable article view
              </button>
            )}
            <button disabled={!web.remote.available} onClick={() => web.connectBrowser(asset.url!)}>
              Open live mobile browser
            </button>
            <a href={asset.url} target="_blank" rel="noreferrer">
              Open original website ↗
            </a>
            <button disabled={web.busy} onClick={() => void web.connect('tab')}>
              <MonitorUp size={14} />
              Share website tab
            </button>
            <button
              onClick={() => {
                web.stop();
                web.setView('embed');
              }}
            >
              Try embedded view
            </button>
            <p>
              Embedded view works only when the site permits it. Live browser sessions last up to 4½
              minutes. Camera and files stay on this device.
            </p>
          </div>
        </details>
      </div>
      {remote && web.interact && (
        <input
          className="mobile-browser-input"
          aria-label="Type into website"
          placeholder="Tap a field on the page, then type here"
          autoComplete="off"
          onChange={(e) => {
            if (e.currentTarget.value)
              web.remote.send({ type: 'text', text: e.currentTarget.value });
            e.currentTarget.value = '';
          }}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (
              ['Backspace', 'Delete', 'Enter', 'Tab', 'ArrowLeft', 'ArrowRight'].includes(e.key)
            ) {
              e.preventDefault();
              web.remote.send({ type: 'key', key: e.key });
            }
          }}
        />
      )}
    </section>
  );
}
