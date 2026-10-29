import { useState } from 'react';
import {
  Search,
  Plus,
  Upload,
  Link2,
  ArrowUpRight,
  Layers2,
  Type,
  Shapes,
  FolderOpen,
  X,
  Trash2,
  Music2,
  FileText,
  Video,
  Image,
  Sparkles,
  Play,
  Pause,
} from 'lucide-react';
import type { Asset } from '../model';
import type { MediaLibrary } from '../engine/media';
import { AssetPreview } from './Preview';
import { IconButton } from './ui';
interface Props {
  assets: Asset[];
  selected: string | null;
  media: MediaLibrary;
  onSelect: (id: string) => void;
  onPlay: (asset: Asset) => void;
  onFocus: (asset: Asset, add?: boolean) => void;
  onImport: () => void;
  onCreate: (kind: 'text' | 'article' | 'shape', shape?: Asset['shape'], template?: number) => void;
  onDelete: (id: string) => void;
  onEdit: (asset: Asset) => void;
  onClose: () => void;
  onOpenProject: () => void;
}
const icons = {
  image: Image,
  video: Video,
  audio: Music2,
  pdf: FileText,
  text: Type,
  article: FileText,
  shape: Shapes,
  link: Link2,
  webpage: Link2,
};
export function Library({
  assets,
  selected,
  media,
  onSelect,
  onPlay,
  onFocus,
  onImport,
  onCreate,
  onDelete,
  onEdit,
  onClose,
  onOpenProject,
}: Props) {
  const [tab, setTab] = useState('assets'),
    [query, setQuery] = useState(''),
    [filter, setFilter] = useState('all');
  const filtered = assets.filter(
    (a) =>
      (filter === 'all' ||
        (filter === 'visuals'
          ? ['image', 'video', 'pdf'].includes(a.kind)
          : ['text', 'article', 'shape', 'link', 'webpage'].includes(a.kind))) &&
      (a.name.toLowerCase().includes(query.toLowerCase()) ||
        a.text?.toLowerCase().includes(query.toLowerCase())),
  );
  return (
    <aside className="library panel">
      <div className="panel-title">
        <span>
          <Layers2 size={17} /> Your library
        </span>
        <IconButton label="Collapse library" onClick={onClose}>
          <X size={15} />
        </IconButton>
      </div>
      <div className="panel-tabs" role="tablist" aria-label="Library sections">
        {['assets', 'create', 'templates'].map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>
            {t === 'assets' ? 'Assets' : t === 'create' ? 'Create' : 'Templates'}
          </button>
        ))}
      </div>
      <div className="library-scroll">
        {tab === 'assets' ? (
          <>
            <button className="import-button" onClick={onImport}>
              <Plus size={17} />
              Import files<span>⌘ I</span>
            </button>
            <label className="search-field">
              <Search size={15} />
              <input
                aria-label="Search assets"
                placeholder="Search your content…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {query && (
                <button aria-label="Clear search" onClick={() => setQuery('')}>
                  <X size={13} />
                </button>
              )}
            </label>
            <div className="filter-tabs">
              {['all', 'visuals', 'other'].map((f) => (
                <button
                  className={filter === f ? 'active' : ''}
                  key={f}
                  onClick={() => setFilter(f)}
                >
                  {f === 'all' ? 'All content' : f === 'visuals' ? 'Visuals' : 'Other'}
                </button>
              ))}
            </div>
            <div className="library-section-title">
              <span>PROJECT ASSETS</span>
              <span>{filtered.length}</span>
            </div>
            <div className="asset-grid">
              {filtered.map((a) => {
                const Icon = icons[a.kind];
                return (
                  <div key={a.id} className={`asset-card ${selected === a.id ? 'selected' : ''}`}>
                    <button
                      className="asset-select"
                      aria-label={`Select ${a.name}`}
                      onClick={() => onSelect(a.id)}
                      onDoubleClick={() => onFocus(a)}
                    >
                      <div className="asset-thumb">
                        <AssetPreview asset={a} media={media} />
                        <span className="asset-type">
                          <Icon size={11} />
                          {a.kind === 'pdf'
                            ? `${a.pages} pages`
                            : a.kind === 'article'
                              ? 'article'
                              : a.kind}
                        </span>
                      </div>
                      <span className="asset-name">{a.name}</span>
                    </button>
                    <div className="asset-actions">
                      <button
                        title="Bring into recording frame"
                        aria-label={`Focus ${a.name}`}
                        onClick={() => onFocus(a)}
                      >
                        <ArrowUpRight size={13} />
                        Focus
                      </button>
                      {['audio', 'video'].includes(a.kind) && (
                        <IconButton
                          label={`${media.isPlaying(a.id) ? 'Pause' : 'Play'} ${a.name}`}
                          onClick={() => onPlay(a)}
                        >
                          {media.isPlaying(a.id) ? <Pause size={12} /> : <Play size={12} />}
                        </IconButton>
                      )}
                      <IconButton
                        label={`Add ${a.name} as overlay`}
                        onClick={() => onFocus(a, true)}
                      >
                        <Layers2 size={12} />
                      </IconButton>
                    </div>
                  </div>
                );
              })}
            </div>
            {!filtered.length && (
              <div className="empty-state">
                <FolderOpen size={28} />
                <p>{query ? 'No matching content' : 'Make room for your ideas'}</p>
                <span>Import a file, paste an image, or create something new.</span>
              </div>
            )}
            <button className="library-add" onClick={onImport}>
              <Upload size={17} />
              <span>
                Drop files anywhere
                <br />
                <small>Images, PDFs, videos & more</small>
              </span>
              <Plus size={15} />
            </button>
          </>
        ) : tab === 'create' ? (
          <>
            <div className="section-intro">
              <span className="eyebrow">START WITH AN IDEA</span>
              <h3>Make it your own.</h3>
              <p>Add something worth sharing.</p>
            </div>
            <button className="create-option" onClick={() => onCreate('text')}>
              <Type />
              <span>
                <strong>Text & headings</strong>
                <small>Give your ideas a voice</small>
              </span>
              <Plus size={16} />
            </button>
            <button className="create-option" onClick={() => onCreate('article')}>
              <FileText />
              <span>
                <strong>Article or notes</strong>
                <small>Paste a readable text snapshot</small>
              </span>
              <Plus size={16} />
            </button>
            <div className="library-section-title">
              <span>SHAPES & DIAGRAMS</span>
            </div>
            <div className="shape-options">
              {(['rectangle', 'circle', 'arrow'] as const).map((shape) => (
                <button key={shape} onClick={() => onCreate('shape', shape)}>
                  <span className={`shape-icon ${shape}`}>{shape === 'arrow' ? '↗' : ''}</span>
                  {shape}
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="section-intro">
              <span className="eyebrow">
                <Sparkles size={12} /> A LITTLE HEAD START
              </span>
              <h3>Find your flow.</h3>
              <p>A starting point for your next story.</p>
            </div>
            {['The storyteller', 'The visual essay', 'The bold statement'].map((t, i) => (
              <button
                key={t}
                className={`template-card template-${i}`}
                onClick={() => onCreate('text', undefined, i)}
              >
                <span>0{i + 1} / FRAMEFLOW ORIGINAL</span>
                <strong>
                  {
                    ['A story\nworth telling.', 'A different\npoint of view.', 'MAKE\nIT MATTER.'][
                      i
                    ]
                  }
                </strong>
                <small>
                  {t}
                  <ArrowUpRight size={15} />
                </small>
              </button>
            ))}
          </>
        )}
      </div>
      {selected && (
        <div className="selected-asset">
          <div>
            <span>SELECTED ASSET</span>
            <strong>{assets.find((a) => a.id === selected)?.name}</strong>
          </div>
          <IconButton
            label="Edit selected asset"
            onClick={() => {
              const a = assets.find((a) => a.id === selected);
              if (a) onEdit(a);
            }}
          >
            <Type size={15} />
          </IconButton>
          <IconButton
            label="Delete selected asset"
            title="Delete asset and scenes containing only this asset"
            onClick={() => onDelete(selected)}
          >
            <Trash2 size={15} />
          </IconButton>
        </div>
      )}
      <button className="library-bottom" onClick={onOpenProject}>
        <FolderOpen size={15} />
        Open a project<span>.frameflow</span>
      </button>
    </aside>
  );
}
