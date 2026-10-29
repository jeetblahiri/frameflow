import { useCallback, useEffect, useRef, useState } from 'react';
import type { Asset } from '../model';
interface CroppedTrack extends MediaStreamTrack {
  cropTo?: (target: unknown) => Promise<void>;
}
interface SurfaceController {
  forwardWheel?: (element: HTMLElement | null) => Promise<void>;
  setFocusBehavior?: (behavior: 'no-focus-change') => void;
}
interface CaptureWindow extends Window {
  CropTarget?: { fromElement: (element: Element) => Promise<unknown> };
  CaptureController?: new () => SurfaceController;
}
export function useWebCapture(
  onLost: () => void,
  notify: (message: string, type?: 'error' | 'success') => void,
) {
  const target = useRef<HTMLDivElement>(null);
  const scrollTarget = useRef<HTMLCanvasElement>(null);
  const video = useRef<HTMLVideoElement | undefined>(undefined);
  const stream = useRef<MediaStream | undefined>(undefined);
  const controller = useRef<SurfaceController | undefined>(undefined);
  const [mode, setMode] = useState<'off' | 'embedded' | 'tab'>('off');
  const [view, setView] = useState<'embed' | 'tab'>('tab');
  const [interact, updateInteract] = useState(false);
  const [scrolling, setScrolling] = useState(false);
  const [canScroll, setCanScroll] = useState(false);
  const [scrollBusy, setScrollBusy] = useState(false);
  const [assetId, setAssetId] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [viewportInset, setViewportInset] = useState(0);
  const connecting = useRef(false);
  const scrollRequest = useRef(0);
  const wantsScrolling = useRef(false);
  const captureRequest = useRef(0);
  const alive = useRef(true);
  const callbacks = useRef({ onLost, notify });
  callbacks.current = { onLost, notify };
  const stopScrolling = useCallback(() => {
    scrollRequest.current++;
    wantsScrolling.current = false;
    void controller.current?.forwardWheel?.(null).catch(() => {});
    if (alive.current) {
      setScrolling(false);
      setScrollBusy(false);
    }
  }, []);
  const setInteract = useCallback(
    (value: boolean) => {
      if (!value) stopScrolling();
      updateInteract(value);
    },
    [stopScrolling],
  );
  const stop = useCallback(() => {
    captureRequest.current++;
    stopScrolling();
    controller.current = undefined;
    stream.current?.getTracks().forEach((track) => {
      track.onended = null;
      track.stop();
    });
    stream.current = undefined;
    if (video.current) {
      video.current.pause();
      video.current.srcObject = null;
      video.current.remove();
    }
    video.current = undefined;
    if (alive.current) {
      setMode('off');
      setCanScroll(false);
      setAssetId(undefined);
      updateInteract(false);
    }
  }, [stopScrolling]);
  useEffect(() => {
    alive.current = true;
    const resize = () => {
      if (!connecting.current) setViewportInset(0);
    };
    window.addEventListener('resize', resize);
    return () => {
      alive.current = false;
      window.removeEventListener('resize', resize);
      stop();
    };
  }, [stop]);
  const connect = async (kind: 'embedded' | 'tab', nextAssetId: string) => {
    if (connecting.current) return;
    setView(kind === 'tab' ? 'tab' : 'embed');
    const crop = (window as CaptureWindow).CropTarget;
    if (!navigator.mediaDevices?.getDisplayMedia || (kind === 'embedded' && !crop)) {
      callbacks.current.notify(
        kind === 'embedded'
          ? 'Recording an embedded website needs desktop Chrome or Edge with Region Capture. You can interact and annotate here, or share the website tab.'
          : 'Tab sharing is unavailable in this browser. Use desktop Chrome or Edge.',
        'error',
      );
      return;
    }
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    connecting.current = true;
    setBusy(true);
    const request = ++captureRequest.current;
    let next: MediaStream | undefined;
    let player: HTMLVideoElement | undefined;
    let playTimeout: ReturnType<typeof setTimeout> | undefined;
    try {
      const Controller = (window as CaptureWindow).CaptureController;
      const nextController = kind === 'tab' && Controller ? new Controller() : undefined;
      nextController?.setFocusBehavior?.('no-focus-change');
      // Both the source and its pixels stay local. The browser owns the tab chooser and permission.
      const options = {
        video: { frameRate: 30 },
        audio: false,
        ...(nextController ? { controller: nextController } : {}),
        ...(kind === 'embedded' ? { preferCurrentTab: true } : { selfBrowserSurface: 'exclude' }),
        surfaceSwitching: 'exclude',
        monitorTypeSurfaces: 'exclude',
      };
      next = await navigator.mediaDevices.getDisplayMedia(options);
      if (!alive.current || request !== captureRequest.current)
        throw new Error('Website sharing cancelled.');
      const track = next.getVideoTracks()[0] as CroppedTrack;
      if (!track) throw new Error('The shared tab has no video track.');
      if (kind === 'embedded') {
        if (!target.current || !track.cropTo)
          throw new Error('Select this Frameflow browser tab, not a window or screen.');
        await track.cropTo(await crop!.fromElement(target.current));
      } else if (track.getSettings().displaySurface !== 'browser')
        throw new Error('Choose a browser tab rather than your desktop or a window.');
      player = document.createElement('video');
      player.muted = true;
      player.playsInline = true;
      player.srcObject = next;
      player.className = 'capture-video-sink';
      player.setAttribute('aria-hidden', 'true');
      document.body.append(player);
      await Promise.race([
        player.play(),
        new Promise<never>((_, reject) => {
          playTimeout = setTimeout(
            () =>
              reject(
                new Error(
                  'No video frames arrived. Stop sharing and reconnect in desktop Chrome or Edge.',
                ),
              ),
            12000,
          );
        }),
      ]);
      if (kind === 'embedded') {
        if (!target.current) throw new Error('The recording frame is no longer available.');
        // Do not let initial, uncropped whole-tab pixels enter a recording.
        const bounds = target.current.getBoundingClientRect();
        const expectedAspect = bounds.width / bounds.height;
        const started = performance.now();
        while (
          !player.videoHeight ||
          Math.abs(player.videoWidth / player.videoHeight - expectedAspect) > 0.035
        ) {
          if (!alive.current || request !== captureRequest.current)
            throw new Error('Website sharing cancelled.');
          if (performance.now() - started > 8000)
            throw new Error(
              'This browser did not crop the recording frame. Enable hardware acceleration in desktop Chrome or Edge and reconnect.',
            );
          await new Promise((resolve) => setTimeout(resolve, 80));
        }
      }
      if (!alive.current || request !== captureRequest.current || track.readyState === 'ended')
        throw new Error('Website sharing ended before it was ready.');
      stop();
      // Native sharing UI can reduce the page viewport during the permission transaction.
      // Reclaim preview margins for that loss; a subsequent window resize returns to normal fitting.
      const heightLoss =
        viewport.width === window.innerWidth
          ? Math.max(0, viewport.height - window.innerHeight)
          : 0;
      setViewportInset((previous) => previous + heightLoss);
      video.current = player;
      stream.current = next;
      controller.current = nextController;
      setMode(kind);
      setAssetId(nextAssetId);
      updateInteract(kind === 'embedded');
      setCanScroll(!!nextController?.forwardWheel);
      track.onended = () => {
        stop();
        callbacks.current.onLost();
        callbacks.current.notify(
          'Website sharing stopped. Recording paused; reconnect before resuming.',
          'error',
        );
      };
    } catch (error) {
      next?.getTracks().forEach((track) => track.stop());
      if (player) {
        player.pause();
        player.srcObject = null;
        player.remove();
      }
      if (!alive.current) return;
      callbacks.current.notify(
        error instanceof DOMException && error.name === 'NotAllowedError'
          ? 'Tab sharing was cancelled or denied. Open the website window and share its tab when ready.'
          : error instanceof Error
            ? error.message
            : 'Website capture could not start.',
        'error',
      );
    } finally {
      clearTimeout(playTimeout);
      connecting.current = false;
      if (alive.current) setBusy(false);
    }
  };
  const enableScrolling = async () => {
    const current = controller.current;
    const element = scrollTarget.current;
    if (!current?.forwardWheel || !element) return;
    const request = ++scrollRequest.current;
    wantsScrolling.current = true;
    setScrollBusy(true);
    try {
      // Must run directly from the button click so the browser can ask for permission.
      await current.forwardWheel(element);
      if (!alive.current || request !== scrollRequest.current || current !== controller.current) {
        if (!wantsScrolling.current || current !== controller.current || !alive.current)
          void current.forwardWheel(null).catch(() => {});
        return;
      }
      updateInteract(true);
      setScrolling(true);
    } catch {
      if (alive.current && request === scrollRequest.current) {
        wantsScrolling.current = false;
        updateInteract(false);
        setScrolling(false);
        callbacks.current.notify(
          'Scroll control was not allowed. Sharing continues; scroll in the source window.',
          'error',
        );
      }
    } finally {
      if (alive.current && request === scrollRequest.current) setScrollBusy(false);
    }
  };
  return {
    target,
    scrollTarget,
    viewportInset,
    mode,
    source: video.current,
    view,
    setView,
    interact,
    setInteract,
    scrolling,
    canScroll,
    scrollBusy,
    enableScrolling,
    assetId,
    busy,
    connect,
    openWebsite: (asset: Asset) => {
      if (asset.url)
        window.open(asset.url, '_blank', 'popup,width=430,height=820,noopener,noreferrer');
    },
    stop: useCallback(() => {
      stop();
      callbacks.current.onLost();
    }, [stop]),
  };
}
export type WebCapture = ReturnType<typeof useWebCapture>;
