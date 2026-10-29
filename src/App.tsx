import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  Camera,
  CameraOff,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  CircleHelp,
  Download,
  Eraser,
  FilePlus2,
  FolderOpen,
  Highlighter,
  Keyboard,
  Layers2,
  LayoutPanelLeft,
  LoaderCircle,
  Mic,
  MicOff,
  MoreHorizontal,
  MousePointer2,
  MoveUpRight,
  Pause,
  PenLine,
  Play,
  Plus,
  RectangleHorizontal,
  Scan,
  Slash,
  Square,
  Trash2,
  Undo2,
  Video,
  X,
} from 'lucide-react';
import type { Asset, Composition, Project, Recovery, Take, Tool } from './model';
import { clone, DEFAULT_CAMERA, formatTime, layerFor, uid } from './model';
import { createSampleProject } from './lib/sample';
import { removeProjectAsset, removeProjectScene } from './lib/project-updates';
import {
  assembleChunks,
  clearRecovery,
  deleteTake,
  download,
  getRecovery,
  listTakes,
  loadProject,
  saveProject,
  saveTake,
} from './lib/storage';
import { exportProject, importFile, importProject } from './lib/importers';
import { useEngine } from './hooks/useEngine';
import { useWebCapture } from './hooks/useWebCapture';
import { Library } from './components/Library';
import { SpatialCanvas } from './components/SpatialCanvas';
import { Presentation } from './components/Presentation';
import { WebsiteControls } from './components/WebsiteControls';
import { Teleprompter } from './components/Teleprompter';
import { DeviceSettings, FocusSettings } from './components/Settings';
import { CompositionThumb } from './components/Preview';
import {
  AssetEditor,
  HelpDialog,
  ImportDialog,
  PreflightDialog,
  TakeViewer,
} from './components/Dialogs';
import { IconButton, Modal } from './components/ui';

const DRAW_TOOLS = [
  { id: 'select', label: 'Reframe content (V)', icon: MousePointer2 },
  { id: 'pen', label: 'Pen (P)', icon: PenLine },
  { id: 'highlighter', label: 'Highlighter', icon: Highlighter },
  { id: 'arrow', label: 'Arrow', icon: MoveUpRight },
  { id: 'circle', label: 'Circle', icon: Circle },
  { id: 'rectangle', label: 'Rectangle', icon: RectangleHorizontal },
  { id: 'line', label: 'Straight line', icon: Slash },
  { id: 'laser', label: 'Laser pointer', icon: Scan },
  { id: 'eraser', label: 'Eraser', icon: Eraser },
] as const;
type Dialog = 'import' | 'record' | 'takes' | 'help' | 'new' | 'scene' | null;
export default function App() {
  const [project, setProject] = useState<Project | null>(null),
    [saved, setSaved] = useState<'saving' | 'saved' | 'error'>('saved');
  const [selected, setSelected] = useState<string | null>('cover'),
    [leftOpen, setLeftOpen] = useState(false),
    [rightOpen, setRightOpen] = useState(false),
    [rightTab, setRightTab] = useState('script'),
    [dialog, setDialog] = useState<Dialog>(null),
    [editingAsset, setEditingAsset] = useState<Asset | null>(null),
    [isNewAsset, setIsNewAsset] = useState(false),
    [menu, setMenu] = useState(false),
    [focusMode, setFocusMode] = useState(false),
    [showCanvas, setShowCanvas] = useState(false),
    [moreTools, setMoreTools] = useState(false),
    [hand, setHand] = useState(false),
    [tool, setTool] = useState<Tool>('select'),
    [color, setColor] = useState('#6554cb'),
    [strokeWidth, setStrokeWidth] = useState(0.007),
    [outputWidth, setOutputWidth] = useState(1080),
    [busy, setBusy] = useState(false),
    [dragging, setDragging] = useState(false),
    [toast, setToast] = useState<{ message: string; type: string } | null>(null),
    [takes, setTakes] = useState<Take[]>([]),
    [takeId, setTakeId] = useState<string>(),
    [recovery, setRecovery] = useState<Recovery>(),
    [sceneName, setSceneName] = useState(''),
    [newScene, setNewScene] = useState(false),
    [sceneTransition, setSceneTransition] = useState<'cut' | 'fade'>('cut');
  const canvasRef = useRef<HTMLCanvasElement>(null),
    projectInput = useRef<HTMLInputElement>(null),
    toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const dragDepth = useRef(0);
  const notify = useCallback((message: string, type: 'error' | 'success' = 'success') => {
    setToast({ message, type });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), type === 'error' ? 12000 : 5000);
  }, []);
  const onTake = useCallback(
    (take: Take) => {
      setTakes((p) => [take, ...p.filter((t) => t.id !== take.id)]);
      setTakeId(take.id);
      setDialog('takes');
      notify(
        take.recovered
          ? 'The captured portion is saved. Preview it before downloading.'
          : 'Your take is saved. Nice work.',
        take.recovered ? 'error' : 'success',
      );
    },
    [notify],
  );
  const engine = useEngine(notify, onTake);
  const web = useWebCapture(() => {
    if (engine.recorder.state === 'recording') engine.recorder.pause();
  }, notify);
  useEffect(() => {
    if (
      web.mode === 'embedded' &&
      dialog &&
      dialog !== 'record' &&
      engine.recorder.state === 'recording'
    )
      engine.recorder.pause();
  }, [dialog, web.mode, engine.recorder]);
  const active = project?.scenes.find((s) => s.id === project.activeSceneId) || project?.scenes[0];
  const composition = active
    ? { ...active.composition, camera: project?.presenter || active.composition.camera }
    : undefined;
  const stateRef = useRef({ project, engine, active, web });
  stateRef.current = { project, engine, active, web };
  const sourceIds = JSON.stringify(active?.composition.layers.map((layer) => layer.assetId) || []);
  useEffect(() => {
    engine.media.pauseVideosExcept(
      stateRef.current.active?.composition.layers.map((layer) => layer.assetId) || [],
    );
  }, [sourceIds, engine.media]);
  useEffect(() => {
    // A tab may stay connected across local scenes, but never outlive its source or project.
    if (
      web.assetId &&
      (!project?.assets.some((asset) => asset.id === web.assetId) ||
        !project.scenes.some((scene) =>
          scene.composition.layers.some((layer) => layer.assetId === web.assetId),
        ))
    )
      web.stop();
  }, [project?.id, project?.assets, project?.scenes, web.assetId, web.stop]);

  const update = useCallback(
    (fn: (p: Project) => Project) =>
      setProject((p) => (p ? { ...fn(p), updatedAt: Date.now() } : p)),
    [],
  );
  const updateComposition = useCallback(
    (fn: (c: Composition) => Composition) =>
      update((p) => {
        const current = p.scenes.find((s) => s.id === p.activeSceneId)!;
        const changed = fn({
          ...current.composition,
          camera: p.presenter || current.composition.camera,
        });
        return {
          ...p,
          presenter: changed.camera,
          scenes: p.scenes.map((s) => ({
            ...s,
            composition:
              s.id === p.activeSceneId ? changed : { ...s.composition, camera: changed.camera },
          })),
        };
      }),
    [update],
  );
  useEffect(() => {
    let live = true;
    void Promise.all([loadProject(), listTakes(), getRecovery()])
      .then(([p, t, r]) => {
        if (!live) return;
        setProject(p || createSampleProject());
        setTakes(t);
        setRecovery(r);
        if (p) setSelected(p.assets[0]?.id || null);
      })
      .catch(() => {
        if (live) {
          setProject(createSampleProject());
          notify(
            'Local storage could not be opened. Check browser storage permissions and back up your project regularly.',
            'error',
          );
        }
      });
    return () => {
      live = false;
    };
  }, [notify]);
  useEffect(() => {
    if (engine.state === 'idle')
      void getRecovery()
        .then(setRecovery)
        .catch(() => {});
  }, [engine.state]);
  useEffect(() => {
    if (!project) return;
    setSaved('saving');
    let live = true;
    const timer = setTimeout(() => {
      void saveProject(project)
        .then(() => {
          if (live) setSaved('saved');
        })
        .catch(() => {
          if (live) {
            setSaved('error');
            notify(
              'Your project could not be saved locally. Free storage and download a project backup from the project menu.',
              'error',
            );
          }
        });
    }, 650);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [project, notify]);
  useEffect(() => {
    if (engine.cameraOn)
      updateComposition((c) => ({ ...c, camera: { ...c.camera, enabled: true } }));
  }, [engine.cameraOn, updateComposition]);
  const switchScene = useCallback(
    (id: string) => {
      const p = stateRef.current.project;
      const scene = p?.scenes.find((s) => s.id === id);
      if (!scene) return;
      if (
        engine.recorder.state !== 'idle' &&
        web.mode === 'off' &&
        scene.composition.layers.some(
          (l) => p!.assets.find((a) => a.id === l.assetId)?.kind === 'webpage',
        )
      ) {
        notify(
          'Connect website capture before switching to a live webpage during a take.',
          'error',
        );
        return;
      }
      for (const l of scene.composition.layers) {
        const a = p!.assets.find((a) => a.id === l.assetId);
        if (a) engine.media.ensure(a, l.page);
      }
      engine.media.pauseVideosExcept(scene.composition.layers.map((l) => l.assetId));
      update((p) => ({ ...p, activeSceneId: id }));
    },
    [engine.media, engine.recorder, web.mode, update, notify],
  );
  const navigate = useCallback(
    (delta: number) => {
      const p = stateRef.current.project;
      if (!p) return;
      const i = p.scenes.findIndex((s) => s.id === p.activeSceneId);
      const scene = p.scenes[i + delta];
      if (scene) switchScene(scene.id);
    },
    [switchScene],
  );
  const addAssets = useCallback(
    (assets: Asset[]) => {
      update((p) => ({ ...p, assets: [...p.assets, ...assets] }));
      setSelected(assets.at(-1)?.id || null);
      const webpage = assets.find((a) => a.kind === 'webpage');
      if (webpage) updateComposition((c) => ({ ...c, layers: [layerFor(webpage)] }));
      else {
        setLeftOpen(true);
        setRightOpen(false);
      }
      notify(
        `Added ${assets.length === 1 ? assets[0].name : `${assets.length} assets`} to your workspace.`,
      );
    },
    [update, updateComposition, notify],
  );
  const processFiles = useCallback(
    async (files: File[]) => {
      if (!files.length) return;
      setBusy(true);
      let count = 0;
      try {
        for (const file of files) {
          try {
            const assets = await importFile(file);
            addAssets(assets);
            count += assets.length;
            if (/\.pptx$/i.test(file.name))
              notify('Imported slide text. Use PDF to preserve a presentation’s full design.');
          } catch (e) {
            notify(e instanceof Error ? e.message : 'That file could not be imported.', 'error');
          }
        }
        if (!count)
          throw new Error(
            'No files could be imported. Check the message above and try a supported file.',
          );
      } finally {
        setBusy(false);
      }
    },
    [addAssets, notify],
  );
  const focusAsset = (asset: Asset, add = false) => {
    setSelected(asset.id);
    updateComposition((c) => ({
      ...c,
      layers: add
        ? [...c.layers, { ...layerFor(asset), x: 0.1, y: 0.6, w: 0.8, h: 0.3 }]
        : [layerFor(asset)],
    }));
    setRightTab('focus');
    setRightOpen(true);
    setLeftOpen(false);
    engine.media.pauseVideosExcept([asset.id]);
    notify(add ? 'Added a layer to your frame.' : 'In frame. Adjust the view with Focus Lens.');
  };
  const editAsset = (asset: Asset) => {
    setIsNewAsset(false);
    setEditingAsset(asset);
  };
  const createAsset = (
    kind: 'text' | 'article' | 'shape',
    shape?: Asset['shape'],
    template?: number,
  ) => {
    const names = ['The storyteller', 'The visual essay', 'The bold statement'];
    const texts = ['A story\nworth telling.', 'A different\npoint of view.', 'MAKE\nIT MATTER.'];
    const a: Asset = {
      id: uid(),
      kind,
      name:
        template !== undefined
          ? names[template]
          : kind === 'text'
            ? 'Untitled text'
            : kind === 'article'
              ? 'My notes'
              : `${shape} shape`,
      text:
        template !== undefined
          ? texts[template]
          : kind === 'article'
            ? 'Paste your article, notes, or a readable webpage snapshot here.'
            : 'Something worth sharing.',
      width: 1080,
      height: 1920,
      x: 100 + Math.random() * 500,
      y: 100 + Math.random() * 300,
      boardWidth: 235,
      color: template === 2 ? '#c8ef81' : '#35483b',
      background: template === 2 ? '#24352d' : template === 1 ? '#dfdacd' : '#e9e9dc',
      fontSize: template === 2 ? 140 : template !== undefined ? 114 : kind === 'article' ? 48 : 84,
      shape,
    };
    if (kind === 'shape') {
      a.width = 1080;
      a.height = 1080;
      addAssets([a]);
      return;
    }
    setIsNewAsset(true);
    setEditingAsset(a);
  };
  const saveAsset = (asset: Asset) => {
    if (asset.kind === 'video' || asset.kind === 'audio') engine.media.ensure(asset);
    if (isNewAsset) addAssets([asset]);
    else update((p) => ({ ...p, assets: p.assets.map((a) => (a.id === asset.id ? asset : a)) }));
  };
  const saveNow = async () => {
    const p = stateRef.current.project;
    if (!p) return;
    try {
      await saveProject(p);
      setSaved('saved');
      notify('Project saved on this device.');
    } catch {
      notify('Local save failed. Download a project backup.', 'error');
    }
  };
  const backup = async () => {
    if (!project) return;
    setBusy(true);
    setMenu(false);
    try {
      download(await exportProject(project), `${project.name || 'Untitled'}.frameflow`);
      notify('Project backup ready, including imported media.');
    } catch (error) {
      notify(
        error instanceof Error
          ? error.message
          : 'Project backup failed. Check that enough device storage is available.',
        'error',
      );
    } finally {
      setBusy(false);
    }
  };
  const openProject = async (file: File) => {
    setBusy(true);
    try {
      const p = await importProject(file);
      await saveProject(p);
      web.stop();
      engine.media.dispose();
      stateRef.current.project?.assets.forEach((a) => {
        if (a.src?.startsWith('blob:')) URL.revokeObjectURL(a.src);
      });
      setProject(p);
      setSelected(p.assets[0]?.id || null);
      notify('Project opened. Welcome back.');
    } catch (e) {
      notify(e instanceof Error ? e.message : 'This project could not be opened.', 'error');
    } finally {
      setBusy(false);
      if (projectInput.current) projectInput.current.value = '';
    }
  };
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (document.querySelector('[role=dialog]')) return;
      const target = e.target as HTMLElement;
      const editable =
        target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
      if (editable) return;
      if ((e.metaKey || e.ctrlKey) && e.key === 'i') {
        e.preventDefault();
        setDialog('import');
      } else if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        void saveNow();
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault();
        updateComposition((c) => ({ ...c, annotations: c.annotations.slice(0, -1) }));
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        navigate(1);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        navigate(-1);
      } else if (e.key.toLowerCase() === 'p') {
        setTool('pen');
        setHand(false);
      } else if (e.key.toLowerCase() === 'v') {
        setTool('select');
        setHand(false);
      } else if (e.key.toLowerCase() === 'h') setHand(true);
      else if (e.code === 'Space') {
        if (engine.recorder.state === 'recording') {
          e.preventDefault();
          engine.recorder.pause();
        } else if (engine.recorder.state === 'paused') {
          e.preventDefault();
          const latest = stateRef.current;
          if (
            latest.web.mode === 'off' &&
            latest.active?.composition.layers.some(
              (l) => latest.project?.assets.find((a) => a.id === l.assetId)?.kind === 'webpage',
            )
          )
            notify('Reconnect website sharing before resuming.', 'error');
          else engine.recorder.resume();
        }
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [navigate, updateComposition, engine.recorder, notify]);
  useEffect(() => {
    const paste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.isContentEditable || ['INPUT', 'TEXTAREA'].includes(target.tagName)) return;
      const files = [...(e.clipboardData?.files || [])];
      if (files.length) {
        e.preventDefault();
        void processFiles(files).catch(() => {});
      }
    };
    window.addEventListener('paste', paste);
    return () => window.removeEventListener('paste', paste);
  }, [processFiles]);
  const recover = async () => {
    if (!recovery) return;
    try {
      const blob = await assembleChunks(recovery.id, recovery.mime);
      if (!blob.size) throw new Error('No recoverable chunks were found.');
      const take: Take = {
        id: recovery.id,
        name: `${recovery.name} (recovered)`,
        createdAt: recovery.startedAt,
        duration: recovery.duration,
        mime: recovery.mime,
        blob,
        recovered: true,
      };
      await saveTake(take);
      await clearRecovery(recovery.id);
      setRecovery(undefined);
      onTake(take);
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Recovery failed.', 'error');
    }
  };
  if (!project || !active || !composition)
    return (
      <div className="app-loading">
        <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" />
        <span>Finding your flow…</span>
        <LoaderCircle className="spin" size={20} />
      </div>
    );
  const activeIndex = project.scenes.findIndex((s) => s.id === active.id);
  const websiteAsset = project.assets.find(
    (asset) =>
      asset.id ===
      [...composition.layers]
        .reverse()
        .find((layer) => project.assets.find((a) => a.id === layer.assetId)?.kind === 'webpage')
        ?.assetId,
  );
  const recording = engine.state === 'recording' || engine.state === 'paused';
  const locked = engine.state !== 'idle';
  return (
    <div
      className={`app-shell studio-v3 studio-v4 ${!leftOpen || focusMode ? 'left-collapsed' : ''} ${!rightOpen || focusMode ? 'right-collapsed' : ''} ${focusMode ? 'distraction-free' : ''}`}
      onDragEnter={(e) => {
        if (e.dataTransfer.types.includes('Files')) {
          e.preventDefault();
          dragDepth.current++;
          setDragging(true);
        }
      }}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('Files')) e.preventDefault();
      }}
      onDragLeave={() => {
        dragDepth.current--;
        if (dragDepth.current <= 0) setDragging(false);
      }}
      onDrop={(e) => {
        if (!e.dataTransfer.files.length) return;
        const handled = e.defaultPrevented;
        e.preventDefault();
        dragDepth.current = 0;
        setDragging(false);
        if (handled) return;
        if ([...e.dataTransfer.files].some((f) => /\.frameflow$/i.test(f.name))) {
          if (locked) {
            notify('Finish your recording before opening another project.', 'error');
            return;
          }
          void openProject([...e.dataTransfer.files].find((f) => /\.frameflow$/i.test(f.name))!);
        } else void processFiles([...e.dataTransfer.files]).catch(() => {});
      }}
    >
      <header className="app-header">
        <a
          className="brand"
          href="./"
          aria-label="Frameflow studio"
          onClick={(e) => {
            e.preventDefault();
            setDialog('help');
          }}
        >
          <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" />
          <span>
            frameflow<span className="brand-dot">.</span>
          </span>
        </a>
        <span className="header-divider" />
        <div className="project-name-wrap">
          <input
            aria-label="Project name"
            value={project.name}
            maxLength={80}
            onChange={(e) => update((p) => ({ ...p, name: e.target.value }))}
          />
          <button aria-label="Project menu" onClick={() => setMenu(!menu)} aria-expanded={menu}>
            <ChevronDown size={14} />
          </button>
          {menu && (
            <>
              <button
                className="menu-dismiss"
                aria-label="Close project menu"
                onClick={() => setMenu(false)}
              />
              <div className="project-menu">
                <button
                  onClick={() => {
                    setMenu(false);
                    void saveNow();
                  }}
                >
                  <CheckCircle2 size={15} />
                  Save on this device
                </button>
                <button disabled={busy} onClick={() => void backup()}>
                  <Download size={15} />
                  Download project backup
                </button>
                <button
                  disabled={locked}
                  onClick={() => {
                    setMenu(false);
                    projectInput.current?.click();
                  }}
                >
                  <FolderOpen size={15} />
                  Open a project
                </button>
                <button
                  disabled={locked}
                  onClick={() => {
                    setMenu(false);
                    setDialog('new');
                  }}
                >
                  <FilePlus2 size={15} />
                  New blank project
                </button>
              </div>
            </>
          )}
        </div>
        <span className={`save-status ${saved === 'error' ? 'error' : ''}`}>
          {saved === 'saved' ? (
            <Check size={12} />
          ) : saved === 'saving' ? (
            <LoaderCircle className="spin" size={12} />
          ) : (
            <Circle size={12} />
          )}
          <span>
            {saved === 'saved' ? 'Saved locally' : saved === 'saving' ? 'Saving…' : 'Save failed'}
          </span>
        </span>
        <div className="header-actions">
          <IconButton label="Help and shortcuts" onClick={() => setDialog('help')}>
            <CircleHelp size={18} />
          </IconButton>
          <button
            disabled={locked}
            className="secondary recordings-button"
            onClick={() => setDialog('takes')}
          >
            <Video size={15} />
            <span>Recordings</span>
            {takes.length > 0 && <span className="count">{takes.length}</span>}
          </button>
          <button className="primary backup-button" disabled={busy} onClick={() => void backup()}>
            {busy ? <LoaderCircle className="spin" size={15} /> : <Download size={15} />}
            <span>Save project</span>
          </button>
        </div>
      </header>
      <nav className="studio-nav" aria-label="Studio tools">
        <h1 className="sr-only">Your ideas, in frame</h1>
        <button
          className={leftOpen ? 'active' : ''}
          aria-label="Toggle content library"
          aria-expanded={leftOpen}
          onClick={() => {
            setLeftOpen(!leftOpen);
            setRightOpen(false);
            setFocusMode(false);
          }}
        >
          <LayoutPanelLeft size={16} />
          Content
        </button>
        <button
          className={rightOpen && rightTab === 'script' ? 'active' : ''}
          onClick={() => {
            setRightTab('script');
            setRightOpen(!(rightOpen && rightTab === 'script'));
            setLeftOpen(false);
            setFocusMode(false);
          }}
        >
          <PenLine size={16} />
          Script
        </button>
        <button
          className={rightOpen && rightTab === 'settings' ? 'active' : ''}
          onClick={() => {
            setRightTab('settings');
            setRightOpen(!(rightOpen && rightTab === 'settings'));
            setLeftOpen(false);
            setFocusMode(false);
          }}
        >
          <Camera size={16} />
          Presenter
        </button>
        <button
          className={showCanvas ? 'active' : ''}
          aria-pressed={showCanvas}
          onClick={() => setShowCanvas(!showCanvas)}
        >
          <Layers2 size={16} />
          Canvas
        </button>
        <button className="primary" aria-label="Import content" onClick={() => setDialog('import')}>
          <Plus size={16} />
          Add content
        </button>
      </nav>
      <main className="studio-layout">
        {leftOpen && !focusMode && (
          <Library
            assets={project.assets}
            selected={selected}
            media={engine.media}
            onSelect={setSelected}
            onPlay={engine.play}
            onFocus={focusAsset}
            onImport={() => setDialog('import')}
            onCreate={createAsset}
            onDelete={(id) => {
              if (web.assetId === id) web.stop();
              engine.media.releaseAsset(id);
              update((p) => removeProjectAsset(p, id));
              setSelected(null);
            }}
            onEdit={editAsset}
            onClose={() => setLeftOpen(false)}
            onOpenProject={() => {
              if (locked) notify('Finish your recording before opening another project.', 'error');
              else projectInput.current?.click();
            }}
          />
        )}
        <section className="center-stage" aria-label="Canvas and recording frame">
          <div className={`stage-top ${websiteAsset ? 'has-website' : ''}`}>
            <div className="stage-scene-label">
              <span className="stage-status-dot" />
              {showCanvas ? 'Canvas' : 'Preview'}
              <span className="stage-slash">/</span>
              <strong>{active.name}</strong>
            </div>
            {websiteAsset && <WebsiteControls asset={websiteAsset} web={web} />}
            <div className="stage-scene-settings">
              <button
                onClick={() => {
                  setSceneName(active.name);
                  setNewScene(false);
                  setSceneTransition(active.transition);
                  setDialog('scene');
                }}
              >
                <MoreHorizontal size={18} />
                <span className="sr-only">Scene settings</span>
              </button>
            </div>
          </div>
          <SpatialCanvas
            project={project}
            update={update}
            selected={selected}
            onSelect={setSelected}
            onFocus={focusAsset}
            media={engine.media}
            hand={hand}
            setHand={setHand}
            focusMode={!showCanvas || focusMode}
            setFocusMode={(v) => setShowCanvas(!v)}
          >
            <Presentation
              canvasRef={canvasRef}
              web={web}
              presenter={engine.presenter}
              composition={{
                ...composition,
                camera: {
                  ...composition.camera,
                  enabled: composition.camera.enabled && engine.cameraOn,
                },
              }}
              assets={project.assets}
              media={engine.media}
              camera={engine.cameraVideo || null}
              tool={tool}
              color={color}
              strokeWidth={strokeWidth}
              update={updateComposition}
              sceneId={active.id}
              fade={active.transition === 'fade'}
              width={outputWidth}
              state={engine.state}
              onExpand={() => setFocusMode(!focusMode)}
            />
          </SpatialCanvas>
          <div className="annotation-bar">
            <div className="annotation-tools">
              {DRAW_TOOLS.filter(
                (t) =>
                  moreTools ||
                  ['select', 'pen', 'highlighter', 'eraser'].includes(t.id) ||
                  tool === t.id,
              ).map(({ id, label, icon: Icon }) => (
                <IconButton
                  key={id}
                  label={label}
                  active={tool === id}
                  onClick={() => {
                    setTool(id);
                    setHand(false);
                  }}
                >
                  <Icon size={16} />
                </IconButton>
              ))}
              <IconButton
                label="More annotation tools"
                active={moreTools}
                onClick={() => setMoreTools(!moreTools)}
              >
                <MoreHorizontal size={16} />
              </IconButton>
            </div>
            <span className="divider" />
            <label className="annotation-color" title="Annotation color">
              <span style={{ background: color }} />
              <input
                aria-label="Annotation color"
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
              />
            </label>
            <select
              className="stroke-select"
              aria-label="Annotation stroke width"
              value={strokeWidth}
              onChange={(e) => setStrokeWidth(Number(e.target.value))}
            >
              <option value={0.003}>Thin</option>
              <option value={0.007}>Medium</option>
              <option value={0.014}>Thick</option>
            </select>
            <div className="annotation-actions">
              <IconButton
                label="Undo last annotation"
                disabled={!composition.annotations.length}
                onClick={() =>
                  updateComposition((c) => ({ ...c, annotations: c.annotations.slice(0, -1) }))
                }
              >
                <Undo2 size={15} />
              </IconButton>
              <IconButton
                label="Clear annotations"
                disabled={!composition.annotations.length}
                onClick={() => updateComposition((c) => ({ ...c, annotations: [] }))}
              >
                <Trash2 size={15} />
              </IconButton>
            </div>
          </div>
        </section>
        {rightOpen && !focusMode && (
          <aside className="controls-panel panel">
            <div className="panel-title">
              <span>
                <PenLine size={16} /> Make it a great take.
              </span>
              <IconButton label="Collapse controls" onClick={() => setRightOpen(false)}>
                <X size={15} />
              </IconButton>
            </div>
            <div className="panel-tabs" role="tablist" aria-label="Studio controls">
              {['script', 'focus', 'settings'].map((t) => (
                <button
                  key={t}
                  role="tab"
                  aria-selected={rightTab === t}
                  onClick={() => setRightTab(t)}
                >
                  {t === 'script' ? 'Script' : t === 'focus' ? 'Focus Lens' : 'Settings'}
                </button>
              ))}
            </div>
            <div className="right-content">
              {rightTab === 'script' ? (
                <Teleprompter
                  sceneId={active.id}
                  sceneName={active.name}
                  script={active.script}
                  onChange={(script) =>
                    update((p) => ({
                      ...p,
                      scenes: p.scenes.map((s) => (s.id === active.id ? { ...s, script } : s)),
                    }))
                  }
                />
              ) : rightTab === 'settings' ? (
                <DeviceSettings
                  engine={engine}
                  composition={composition}
                  update={updateComposition}
                  width={outputWidth}
                  setWidth={setOutputWidth}
                />
              ) : (
                <FocusSettings
                  composition={composition}
                  assets={project.assets}
                  update={updateComposition}
                  engine={engine}
                  onEdit={editAsset}
                />
              )}
            </div>
            <div className="ready-strip">
              <span className={recording ? 'recording-status' : ''}>
                <i />
                {engine.state === 'recording'
                  ? 'You’re live. Keep going.'
                  : engine.state === 'paused'
                    ? 'Take a breath. You’re paused.'
                    : 'A little preparation. A great take.'}
              </span>
            </div>
          </aside>
        )}
      </main>
      <section className="scene-strip" aria-label="Saved scenes">
        <div className="scenes-label">
          <Layers2 size={16} />
          <div>
            <strong>Your story</strong>
            <span>
              {project.scenes.length} {project.scenes.length === 1 ? 'scene' : 'scenes'}
            </span>
          </div>
          <button
            className="text-link"
            onClick={() => {
              setSceneName(`Scene ${project.scenes.length + 1}`);
              setNewScene(true);
              setSceneTransition(active.transition);
              setDialog('scene');
            }}
          >
            <Plus size={14} />
            <span>Save view</span>
          </button>
        </div>
        <div className="scene-cards">
          {project.scenes.map((scene, i) => (
            <div className="scene-card-wrap" key={scene.id}>
              <button
                className={`scene-card ${scene.id === active.id ? 'active' : ''}`}
                aria-label={`Scene ${i + 1}: ${scene.name}`}
                aria-current={scene.id === active.id ? 'true' : undefined}
                onClick={() => switchScene(scene.id)}
              >
                <div className="scene-thumb">
                  <CompositionThumb
                    composition={scene.composition}
                    assets={project.assets}
                    media={engine.media}
                  />
                  <span>{String(i + 1).padStart(2, '0')}</span>
                </div>
                <div>
                  <span>{scene.name}</span>
                  <small>{scene.transition === 'fade' ? 'Crossfade' : 'Instant cut'}</small>
                </div>
                {scene.id === active.id && <span className="scene-active-dot" />}
              </button>
              <button
                className="scene-remove"
                aria-label={`Delete scene ${scene.name}`}
                title={project.scenes.length === 1 ? 'Clear the last scene' : 'Delete scene'}
                onClick={() => update((p) => removeProjectScene(p, scene.id))}
              >
                <X size={13} />
              </button>
            </div>
          ))}
          <button
            className="add-scene"
            aria-label="Save current view as a new scene"
            onClick={() => {
              setSceneName(`Scene ${project.scenes.length + 1}`);
              setNewScene(true);
              setSceneTransition(active.transition);
              setDialog('scene');
            }}
          >
            <Plus size={20} />
          </button>
        </div>
        <div className="scene-navigation">
          <IconButton
            label="Previous scene"
            disabled={activeIndex <= 0}
            onClick={() => navigate(-1)}
          >
            <ChevronLeft size={19} />
          </IconButton>
          <span>
            {activeIndex + 1}
            <small> / {project.scenes.length}</small>
          </span>
          <IconButton
            label="Next scene"
            disabled={activeIndex >= project.scenes.length - 1}
            onClick={() => navigate(1)}
          >
            <ChevronRight size={19} />
          </IconButton>
        </div>
      </section>
      <footer className="recording-dock">
        <div className="dock-devices">
          <button
            className={`device-toggle ${engine.cameraOn ? 'on' : ''}`}
            disabled={engine.deviceBusy}
            aria-label={engine.cameraOn ? 'Disable camera' : 'Enable camera'}
            onClick={() => void engine.toggleCamera()}
          >
            {engine.cameraOn ? <Camera size={17} /> : <CameraOff size={17} />}
            <span>Camera</span>
            <i />
          </button>
          <button
            className={`device-toggle ${engine.micOn ? 'on' : ''}`}
            disabled={engine.deviceBusy}
            aria-label={engine.micOn ? 'Disable microphone' : 'Enable microphone'}
            onClick={() => void engine.toggleMic()}
          >
            {engine.micOn ? <Mic size={17} /> : <MicOff size={17} />}
            <span>Mic</span>
            <i />
          </button>
          <div
            className="dock-meter"
            title={engine.micOn ? 'Microphone input level' : 'Microphone is off'}
            aria-label={`Microphone level ${Math.round(engine.levels.mic * 100)} percent`}
          >
            {Array.from({ length: 16 }, (_, i) => (
              <i
                key={i}
                className={engine.levels.mic > i / 16 ? (i > 12 ? 'clipping' : 'lit') : ''}
              />
            ))}
          </div>
          <IconButton
            label="Audio and device settings"
            onClick={() => {
              setRightTab('settings');
              setLeftOpen(false);
              setRightOpen(true);
              setFocusMode(false);
            }}
          >
            <ChevronDown size={14} />
          </IconButton>
        </div>
        <div className="record-center">
          <span className={`record-timer ${recording ? 'live' : ''}`}>
            {recording && <i />}
            {formatTime(engine.duration)}
          </span>
          {recording ? (
            <>
              <button
                className="pause-button"
                aria-label={engine.state === 'paused' ? 'Resume recording' : 'Pause recording'}
                onClick={() =>
                  engine.state === 'paused'
                    ? composition.layers.some(
                        (l) => project.assets.find((a) => a.id === l.assetId)?.kind === 'webpage',
                      ) && web.mode === 'off'
                      ? notify('Reconnect website sharing before resuming.', 'error')
                      : engine.recorder.resume()
                    : engine.recorder.pause()
                }
              >
                {engine.state === 'paused' ? <Play size={18} /> : <Pause size={18} />}
              </button>
              <button className="record-button stop" onClick={() => engine.recorder.stop()}>
                <Square size={13} fill="currentColor" />
                Finish recording
              </button>
            </>
          ) : (
            <button
              className="record-button"
              disabled={locked || busy}
              onClick={() =>
                recovery
                  ? notify(
                      'Recover or discard the interrupted take before recording again.',
                      'error',
                    )
                  : composition.layers.some(
                        (l) => project.assets.find((a) => a.id === l.assetId)?.kind === 'webpage',
                      ) && web.mode === 'off'
                    ? notify('Share the website tab before recording.', 'error')
                    : composition.camera.enabled &&
                        engine.cameraOn &&
                        composition.camera.background === 'remove' &&
                        engine.presenterStatus !== 'ready'
                      ? notify(
                          'Wait for background removal to be ready, or choose Original in Presenter settings.',
                          'error',
                        )
                      : setDialog('record')
              }
            >
              {locked ? (
                <LoaderCircle size={16} className="spin" />
              ) : (
                <span className="record-dot" />
              )}
              {engine.state === 'stopping'
                ? 'Saving your take…'
                : engine.state === 'starting'
                  ? 'Preparing…'
                  : 'Start recording'}
            </button>
          )}
          <span className="record-shortcut">
            {recording ? 'SPACE TO PAUSE' : 'YOUR NEXT GREAT TAKE'}
          </span>
        </div>
        <div className="dock-right">
          <span>
            <span className="resolution-dot" />
            {outputWidth === 1080 ? '1080p' : '720p'}
            <small>9:16</small>
          </span>
          <IconButton label="Keyboard shortcuts" onClick={() => setDialog('help')}>
            <Keyboard size={17} />
          </IconButton>
          <span className="local-tag">
            <i />
            Local-first
          </span>
        </div>
      </footer>
      <input
        hidden
        ref={projectInput}
        type="file"
        accept=".frameflow"
        data-testid="project-file-input"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void openProject(f);
        }}
      />
      {dialog === 'import' && (
        <ImportDialog
          onClose={() => setDialog(null)}
          onFiles={processFiles}
          onAssets={addAssets}
          notify={notify}
        />
      )}
      {editingAsset && (
        <AssetEditor
          asset={editingAsset}
          onClose={() => setEditingAsset(null)}
          onSave={saveAsset}
        />
      )}
      {dialog === 'record' && (
        <PreflightDialog
          onClose={() => setDialog(null)}
          engine={engine}
          composition={composition}
          assets={project.assets}
          width={outputWidth}
          onStart={async () => {
            if (
              composition.layers.some(
                (l) => project.assets.find((a) => a.id === l.assetId)?.kind === 'webpage',
              ) &&
              web.mode === 'off'
            ) {
              notify('Reconnect website sharing before recording.', 'error');
              return;
            }
            if (canvasRef.current) {
              if (web.mode === 'embedded') {
                setDialog(null);
                await new Promise<void>((resolve) =>
                  requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
                );
                await new Promise((resolve) => setTimeout(resolve, 150));
              }
              const started = await engine.start(
                canvasRef.current,
                composition,
                project.assets,
                project.name,
              );
              if (started) setDialog(null);
              else setDialog('record');
            }
          }}
        />
      )}
      {dialog === 'takes' && (
        <TakeViewer
          takes={takes}
          initialId={takeId}
          onClose={() => setDialog(null)}
          notify={notify}
          onDelete={(id) => {
            void deleteTake(id)
              .then(() => setTakes((t) => t.filter((v) => v.id !== id)))
              .catch(() => notify('The take could not be deleted.', 'error'));
          }}
        />
      )}
      {dialog === 'help' && <HelpDialog onClose={() => setDialog(null)} />}
      {dialog === 'scene' && (
        <Modal
          title={newScene ? 'A moment worth saving.' : 'Set the scene.'}
          subtitle={
            newScene
              ? 'Capture this exact view, ready for your next take.'
              : 'Give this part of your story a little direction.'
          }
          onClose={() => setDialog(null)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (newScene) {
                const id = uid();
                update((p) => ({
                  ...p,
                  scenes: [
                    ...p.scenes,
                    {
                      id,
                      name: sceneName,
                      composition: clone(composition),
                      script: active.script,
                      transition: sceneTransition,
                    },
                  ],
                  activeSceneId: id,
                }));
              } else
                update((p) => ({
                  ...p,
                  scenes: p.scenes.map((s) =>
                    s.id === active.id ? { ...s, name: sceneName, transition: sceneTransition } : s,
                  ),
                }));
              setDialog(null);
              notify(newScene ? 'Scene saved. Your story is taking shape.' : 'Scene updated.');
            }}
          >
            <label className="field-label">
              Scene name
              <input
                aria-label="Scene name"
                required
                value={sceneName}
                maxLength={60}
                onChange={(e) => setSceneName(e.target.value)}
              />
            </label>
            <label className="field-label">
              Transition
              <select
                aria-label="Scene transition"
                value={sceneTransition}
                onChange={(e) => setSceneTransition(e.target.value as 'cut' | 'fade')}
              >
                <option value="cut">Instant cut</option>
                <option value="fade">Short crossfade · 320 ms</option>
              </select>
            </label>
            <button className="primary full">
              <Check size={15} />
              {newScene ? 'Save current view' : 'Update scene'}
            </button>
            {!newScene && (
              <button
                type="button"
                className="text-danger full"
                onClick={() => {
                  update((p) => removeProjectScene(p, active.id));
                  setDialog(null);
                }}
              >
                <Trash2 size={14} />
                Delete this scene
              </button>
            )}
          </form>
        </Modal>
      )}
      {dialog === 'new' && (
        <Modal
          title="A fresh canvas."
          subtitle="Start a new story, with room for everything."
          onClose={() => setDialog(null)}
        >
          <p className="help-text">
            Your current project will be replaced on this device. Download a backup to keep its
            assets, scenes, and script.
          </p>
          <button className="secondary full" onClick={() => void backup()}>
            <Download size={15} />
            Back up current project
          </button>
          <button
            className="primary full"
            onClick={() => {
              const id = uid();
              const p: Project = {
                version: 1,
                id: uid(),
                name: 'Untitled story',
                assets: [],
                scenes: [
                  {
                    id,
                    name: 'The beginning',
                    composition: {
                      layers: [],
                      background: '#e9e9dc',
                      camera: { ...DEFAULT_CAMERA },
                      annotations: [],
                      branding: false,
                    },
                    script: '',
                    transition: 'cut',
                  },
                ],
                activeSceneId: id,
                canvas: { x: 0, y: 0, zoom: 0.72 },
                updatedAt: Date.now(),
              };
              web.stop();
              setProject(p);
              setSelected(null);
              setDialog(null);
              engine.media.dispose();
            }}
          >
            Start a blank project
            <ArrowUpRight size={15} />
          </button>
        </Modal>
      )}
      {recovery && (
        <div className="recovery-banner" role="status">
          <span>
            <Video size={17} />
            <strong>Your last take was interrupted.</strong>
            <small>
              {recovery.chunks} saved chunks · {formatTime(recovery.duration)}
            </small>
          </span>
          <button
            disabled={!recovery.chunks}
            title={
              recovery.chunks
                ? undefined
                : 'No checkpoint was saved before the interruption. Discard this empty session to record again.'
            }
            onClick={() => void recover()}
          >
            Recover take
            <ArrowRight size={14} />
          </button>
          <button
            aria-label="Discard interrupted take"
            onClick={() => {
              void clearRecovery(recovery.id)
                .then(() => setRecovery(undefined))
                .catch(() => notify('Recovery data could not be cleared.', 'error'));
            }}
          >
            <X size={16} />
          </button>
        </div>
      )}
      {dragging && (
        <div className="global-drop">
          <UploadSymbol />
          <strong>A little more inspiration.</strong>
          <p>Drop your files to add them to the workspace.</p>
        </div>
      )}
      {toast && (
        <div className={`toast ${toast.type}`} role={toast.type === 'error' ? 'alert' : 'status'}>
          {toast.type === 'error' ? <CircleHelp size={18} /> : <CheckCircle2 size={18} />}
          <span>{toast.message}</span>
          <button aria-label="Dismiss notification" onClick={() => setToast(null)}>
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
function UploadSymbol() {
  return (
    <div className="global-drop-icon">
      <Plus size={32} />
    </div>
  );
}
