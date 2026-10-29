import { useCallback, useEffect, useRef, useState } from 'react';
import type { Asset, Composition, RecordingState, Take } from '../model';
import { AudioMixer } from '../engine/audio';
import { MediaLibrary } from '../engine/media';
import { StudioRecorder } from '../engine/recorder';
export function useEngine(
  notify: (message: string, type?: 'error' | 'success') => void,
  onTake: (take: Take) => void,
) {
  const [mixer] = useState(() => new AudioMixer());
  const [media] = useState(() => new MediaLibrary());
  const [recorder] = useState(() => new StudioRecorder());
  const [state, setState] = useState<RecordingState>('idle'),
    [duration, setDuration] = useState(0),
    [cameraOn, setCameraOn] = useState(false),
    [micOn, setMicOn] = useState(false),
    [deviceBusy, setDeviceBusy] = useState(false),
    [devices, setDevices] = useState<MediaDeviceInfo[]>([]),
    [levels, setLevels] = useState({ mic: 0, master: 0 });
  const [cameraId, setCameraId] = useState(''),
    [micId, setMicId] = useState('');
  const cameraStream = useRef<MediaStream | undefined>(undefined),
    micStream = useRef<MediaStream | undefined>(undefined);
  const cameraVideo = useRef<HTMLVideoElement | undefined>(undefined);
  const handlers = useRef({ notify, onTake });
  handlers.current = { notify, onTake };
  useEffect(() => {
    media.mixer = mixer;
    media.onError = (m) => handlers.current.notify(m, 'error');
    recorder.onState = setState;
    recorder.onTime = setDuration;
    recorder.onError = (m) => handlers.current.notify(m, 'error');
    recorder.onTake = (t) => {
      media.elements().forEach((e) => e.pause());
      handlers.current.onTake(t);
    };
    const timer = setInterval(() => setLevels(mixer.levels()), 100);
    const refresh = () => {
      void navigator.mediaDevices
        ?.enumerateDevices()
        .then(setDevices)
        .catch(() => {});
    };
    refresh();
    navigator.mediaDevices?.addEventListener('devicechange', refresh);
    const visibility = () => {
      if (document.hidden && recorder.state === 'recording') {
        recorder.pause();
        recorder.flush();
        handlers.current.notify(
          'Recording paused because the studio went into the background. Return here and resume your take.',
          'error',
        );
      }
    };
    const leave = (e: BeforeUnloadEvent) => {
      if (recorder.state !== 'idle') {
        recorder.flush();
        e.preventDefault();
      }
    };
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('beforeunload', leave);
    return () => {
      clearInterval(timer);
      navigator.mediaDevices?.removeEventListener('devicechange', refresh);
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('beforeunload', leave);
    };
  }, [media, mixer, recorder]);
  useEffect(
    () => () => {
      recorder.dispose();
      media.dispose();
      cameraStream.current?.getTracks().forEach((t) => t.stop());
      micStream.current?.getTracks().forEach((t) => t.stop());
      void mixer.close();
    },
    [media, mixer, recorder],
  );
  useEffect(() => {
    if (state !== 'recording' || !navigator.wakeLock) return;
    let cancelled = false;
    let lock: WakeLockSentinel | undefined;
    void navigator.wakeLock
      .request('screen')
      .then((value) => {
        if (cancelled) void value.release();
        else lock = value;
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      void lock?.release();
    };
  }, [state]);
  const initAudio = useCallback(async () => {
    await mixer.init();
    media.elements().forEach((el) => mixer.connectMedia(el));
  }, [mixer, media]);
  const connect = async (kind: 'camera' | 'mic', deviceId?: string) => {
    if (!navigator.mediaDevices?.getUserMedia) {
      notify(
        'Camera and microphone need a secure context. Use localhost or an HTTPS deployment.',
        'error',
      );
      return;
    }
    setDeviceBusy(true);
    try {
      if (kind === 'mic') await initAudio();
      const stream = await navigator.mediaDevices.getUserMedia(
        kind === 'camera'
          ? {
              video: {
                ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
                width: { ideal: 1280 },
                height: { ideal: 720 },
              },
              audio: false,
            }
          : {
              audio: {
                ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: false,
              },
              video: false,
            },
      );
      if (kind === 'camera') {
        const old = cameraStream.current;
        const video = document.createElement('video');
        video.muted = true;
        video.playsInline = true;
        video.srcObject = stream;
        try {
          await video.play();
        } catch {
          stream.getTracks().forEach((t) => t.stop());
          throw new Error('Camera preview could not start. Try another camera.');
        }
        cameraStream.current = stream;
        cameraVideo.current = video;
        setCameraOn(true);
        old?.getTracks().forEach((t) => t.stop());
      } else {
        const old = micStream.current;
        mixer.connectMicrophone(stream);
        micStream.current = stream;
        setMicOn(true);
        old?.getTracks().forEach((t) => t.stop());
      }
      stream.getTracks()[0].onended = () => {
        if (kind === 'camera') {
          setCameraOn(false);
          cameraVideo.current = undefined;
        } else {
          setMicOn(false);
          mixer.disconnectMicrophone();
          if (recorder.state === 'recording') recorder.pause();
        }
        notify(
          `${kind === 'camera' ? 'Camera disconnected.' : 'Microphone disconnected. Recording paused to protect your narration.'} Reconnect your device in Settings.`,
          'error',
        );
      };
      setDevices(await navigator.mediaDevices.enumerateDevices());
    } catch (e) {
      const error = e as DOMException;
      notify(
        error.name === 'NotAllowedError'
          ? `${kind === 'camera' ? 'Camera' : 'Microphone'} access was denied. Allow access in your browser’s site permissions, then try again.`
          : error.name === 'NotFoundError'
            ? 'No matching device was found. Connect a camera or microphone and try again.'
            : error.name === 'NotReadableError'
              ? 'This device is busy. Close other apps using it and try again.'
              : error.message || 'The device could not be opened.',
        'error',
      );
    } finally {
      setDeviceBusy(false);
    }
  };
  const toggleCamera = async () => {
    if (deviceBusy) return;
    if (cameraOn) {
      cameraStream.current?.getTracks().forEach((t) => t.stop());
      cameraVideo.current = undefined;
      setCameraOn(false);
    } else await connect('camera', cameraId);
  };
  const toggleMic = async () => {
    if (deviceBusy) return;
    if (micOn) {
      micStream.current?.getTracks().forEach((t) => t.stop());
      mixer.disconnectMicrophone();
      setMicOn(false);
    } else await connect('mic', micId);
  };
  const changeCamera = async (id: string) => {
    setCameraId(id);
    if (cameraOn) await connect('camera', id);
  };
  const changeMic = async (id: string) => {
    setMicId(id);
    if (micOn) await connect('mic', id);
  };
  const play = async (asset: Asset) => {
    try {
      await initAudio();
      const element = media.element(asset);
      if (element && !element.paused) element.pause();
      else await media.play(asset);
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Media playback failed. Tap play again.', 'error');
    }
  };
  const start = async (
    canvas: HTMLCanvasElement,
    composition: Composition,
    assets: Asset[],
    name: string,
  ) => {
    try {
      await initAudio();
      await media.prepare(assets, composition.layers);
      return await recorder.start(canvas, mixer.destination!.stream, name);
    } catch (e) {
      notify(
        e instanceof Error ? e.message : 'The studio could not prepare your recording.',
        'error',
      );
      return false;
    }
  };
  return {
    mixer,
    media,
    recorder,
    state,
    duration,
    cameraOn,
    micOn,
    cameraVideo: cameraVideo.current,
    cameraStream: cameraStream.current,
    deviceBusy,
    devices,
    cameraId,
    micId,
    levels,
    toggleCamera,
    toggleMic,
    changeCamera,
    changeMic,
    play,
    start,
  };
}
export type Engine = ReturnType<typeof useEngine>;
