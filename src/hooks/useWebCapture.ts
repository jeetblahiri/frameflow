import { useEffect, useRef, useState } from 'react';
interface CroppedTrack extends MediaStreamTrack {
  cropTo?: (target: unknown) => Promise<void>;
}
interface CaptureWindow extends Window {
  CropTarget?: { fromElement: (element: Element) => Promise<unknown> };
}
export function useWebCapture(
  onLost: () => void,
  notify: (message: string, type?: 'error' | 'success') => void,
) {
  const target = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement | undefined>(undefined);
  const stream = useRef<MediaStream | undefined>(undefined);
  const [mode, setMode] = useState<'off' | 'embedded' | 'tab'>('off');
  const [busy, setBusy] = useState(false);
  const alive = useRef(true);
  const callbacks = useRef({ onLost, notify });
  callbacks.current = { onLost, notify };
  const stop = () => {
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
    setMode('off');
  };
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      stream.current?.getTracks().forEach((track) => track.stop());
      video.current?.remove();
    };
  }, []);
  const connect = async (kind: 'embedded' | 'tab') => {
    const crop = (window as CaptureWindow).CropTarget;
    if (!navigator.mediaDevices?.getDisplayMedia || (kind === 'embedded' && !crop)) {
      callbacks.current.notify(
        kind === 'embedded'
          ? 'Recording an embedded website needs desktop Chrome or Edge with Region Capture. You can interact and annotate here, or use Share another tab in a browser with screen sharing.'
          : 'Tab sharing is unavailable in this browser. Use desktop Chrome or Edge.',
        'error',
      );
      return;
    }
    setBusy(true);
    let next: MediaStream | undefined;
    let player: HTMLVideoElement | undefined;
    try {
      // Capture starts only on this explicit click. No microphone, website audio or desktop audio is requested.
      const options = {
        video: { frameRate: 30 },
        audio: false,
        ...(kind === 'embedded' ? { preferCurrentTab: true } : { selfBrowserSurface: 'exclude' }),
        surfaceSwitching: 'exclude',
        monitorTypeSurfaces: 'exclude',
      };
      next = await navigator.mediaDevices.getDisplayMedia(options);
      if (!alive.current) throw new Error('Studio closed.');
      const track = next.getVideoTracks()[0] as CroppedTrack;
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
      const play = player.play();
      await Promise.race([
        play,
        new Promise<never>((_, reject) =>
          setTimeout(
            () =>
              reject(
                new Error(
                  'No video frames arrived from this tab. Stop sharing and reconnect in desktop Chrome or Edge.',
                ),
              ),
            12000,
          ),
        ),
      ]);
      if (kind === 'embedded') {
        if (!target.current) throw new Error('The recording frame is no longer available.');
        // The first decoded frame must be cropped before it reaches the recording compositor.
        const bounds = target.current.getBoundingClientRect();
        const expectedAspect = bounds.width / bounds.height;
        const started = performance.now();
        while (
          Math.abs(player.videoWidth / player.videoHeight - expectedAspect) > 0.035 ||
          !player.videoHeight
        ) {
          if (performance.now() - started > 8000)
            throw new Error(
              'This browser did not crop the recording frame. Enable hardware acceleration in desktop Chrome or Edge and reconnect.',
            );
          await new Promise((resolve) => setTimeout(resolve, 80));
        }
      }
      if (!alive.current || track.readyState === 'ended')
        throw new Error('Website sharing ended before it was ready.');
      stop();
      video.current = player;
      stream.current = next;
      setMode(kind);
      track.onended = () => {
        stop();
        callbacks.current.onLost();
        callbacks.current.notify(
          'Website sharing stopped. Recording paused; reconnect the page before resuming.',
          'error',
        );
      };
    } catch (error) {
      next?.getTracks().forEach((track) => track.stop());
      player?.remove();
      if (!alive.current) return;
      callbacks.current.notify(
        error instanceof DOMException && error.name === 'NotAllowedError'
          ? 'Tab sharing was cancelled or denied. The live page is still available; reconnect when ready to record it.'
          : error instanceof Error
            ? error.message
            : 'Website capture could not start.',
        'error',
      );
    } finally {
      if (alive.current) setBusy(false);
    }
  };
  return {
    target,
    video: video.current,
    mode,
    busy,
    connect,
    stop: () => {
      stop();
      callbacks.current.onLost();
    },
  };
}
export type WebCapture = ReturnType<typeof useWebCapture>;
