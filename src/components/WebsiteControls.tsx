import { Globe2, MousePointer2, PenLine, MonitorUp, X } from 'lucide-react';
import type { Asset } from '../model';
import type { WebCapture } from '../hooks/useWebCapture';
export function WebsiteControls({ asset, web }: { asset: Asset; web: WebCapture }) {
  const sharing = web.mode === 'tab';
  return (
    <section
      className={`website-controls ${web.mode === 'off' && web.view !== 'embed' ? 'website-idle' : ''}`}
      aria-label="Website controls"
    >
      <div className="website-address">
        <Globe2 size={16} />
        <span title={asset.url}>{asset.url}</span>
        <small>
          {sharing ? 'Shared tab' : web.view === 'embed' ? 'Embedded · 390 px' : 'Website'}
        </small>
      </div>
      <div className="website-actions">
        {(sharing || web.view === 'embed') && (
          <div className="segmented">
            <button
              className={web.interact ? 'active' : ''}
              disabled={sharing && (!web.canScroll || web.scrollBusy)}
              title={
                sharing && !web.canScroll
                  ? 'Scroll in the source window; in-preview scrolling needs desktop Chrome with captured surface control.'
                  : undefined
              }
              onClick={() => (sharing ? void web.enableScrolling() : web.setInteract(true))}
            >
              <MousePointer2 size={14} />
              {sharing ? (web.scrollBusy ? 'Connecting scroll…' : 'Scroll here') : 'Interact'}
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
            onClick={() => void web.connect('embedded', asset.id)}
          >
            {web.busy ? 'Connecting…' : 'Connect embedded capture'}
          </button>
        )}
        <details className="website-options">
          <summary>More options</summary>
          <div>
            <button onClick={() => web.openWebsite(asset)}>Open website window</button>
            <a href={asset.url} target="_blank" rel="noreferrer">
              Open as a regular tab ↗
            </a>
            <button disabled={web.busy} onClick={() => void web.connect('tab', asset.id)}>
              <MonitorUp size={14} />
              {sharing ? 'Change shared tab' : 'Share website tab'}
            </button>
            <button
              onClick={() => {
                web.stop();
                web.setView(web.view === 'embed' ? 'tab' : 'embed');
              }}
            >
              {web.view === 'embed' ? 'Use tab sharing' : 'Try embedded view'}
            </button>
            <p>
              Use a narrow source window for a responsive layout. Links and typing work in that
              window. Embedded view works only when the website permits it.
            </p>
          </div>
        </details>
      </div>
      {sharing && (
        <p className="website-hint">
          {web.scrollBusy
            ? 'Allow scroll control in the browser prompt to scroll over the frame.'
            : web.scrolling
              ? 'Scroll over the frame. Switch to Annotate to draw or move your presenter.'
              : web.canScroll
                ? 'Choose Scroll here to scroll inside the frame, or Annotate to draw.'
                : 'Scroll in the source window; this browser does not support scrolling from the preview.'}{' '}
          Links and typing use the source window.
        </p>
      )}
      {web.view === 'embed' && (
        <p className="website-hint">
          If the page refuses to connect, use More options → Use tab sharing. Websites control
          whether they allow embedding.
        </p>
      )}
    </section>
  );
}
