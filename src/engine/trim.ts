import { recordingMime } from '../model';
import type { Take } from '../model';

/** A deliberate real-time re-encode; original take is always retained. */
export async function trimRecording(
  take: Take,
  start: number,
  end: number,
  signal: AbortSignal,
  onProgress: (value: number) => void,
): Promise<Blob> {
  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    start < 0 ||
    end <= start ||
    end > take.duration + 0.1
  )
    throw new Error('Choose a valid start and end within this take.');
  const context = new AudioContext();
  await context.resume();
  const video = document.createElement('video');
  video.playsInline = true;
  video.preload = 'auto';
  const url = URL.createObjectURL(take.blob);
  video.src = url;
  let stream: MediaStream | undefined;
  let frame = 0;
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error('The take could not be opened for trimming.')),
        10000,
      );
      video.onloadeddata = () => {
        clearTimeout(timer);
        resolve();
      };
      video.onerror = () => {
        clearTimeout(timer);
        reject(new Error('This browser cannot decode this take for trimming.'));
      };
    });
    if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
    if (start > 0.01)
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error('Could not seek to the trim start.')),
          8000,
        );
        video.onseeked = () => {
          clearTimeout(timer);
          resolve();
        };
        video.currentTime = start;
      });
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const destination = context.createMediaStreamDestination();
    context.createMediaElementSource(video).connect(destination);
    stream = canvas.captureStream(30);
    const combined = new MediaStream([
      ...stream.getVideoTracks(),
      ...destination.stream.getAudioTracks(),
    ]);
    const mime = MediaRecorder.isTypeSupported(take.mime)
      ? take.mime
      : recordingMime((t) => MediaRecorder.isTypeSupported(t));
    const recorder = new MediaRecorder(combined, {
      ...(mime ? { mimeType: mime } : {}),
      videoBitsPerSecond: 8_000_000,
      audioBitsPerSecond: 128_000,
    });
    const chunks: Blob[] = [];
    return await new Promise<Blob>((resolve, reject) => {
      let failure: Error | undefined;
      const stop = () => {
        video.pause();
        if (recorder.state !== 'inactive') recorder.stop();
      };
      const abort = () => {
        failure = new DOMException('Cancelled', 'AbortError');
        stop();
      };
      const hidden = () => {
        if (document.hidden) {
          failure = new Error(
            'Trimming was interrupted. Keep the studio in the foreground and try again.',
          );
          stop();
        }
      };
      signal.addEventListener('abort', abort, { once: true });
      document.addEventListener('visibilitychange', hidden);
      recorder.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      recorder.onerror = () => {
        failure = new Error('The browser could not encode this trim. Your original take is safe.');
        stop();
      };
      recorder.onstop = () => {
        cancelAnimationFrame(frame);
        signal.removeEventListener('abort', abort);
        document.removeEventListener('visibilitychange', hidden);
        if (failure) reject(failure);
        else resolve(new Blob(chunks, { type: recorder.mimeType }));
      };
      video.onerror = () => {
        failure = new Error('Playback failed during trimming. Your original take is safe.');
        stop();
      };
      video.onended = stop;
      const draw = () => {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        onProgress(Math.min(1, (video.currentTime - start) / (end - start)));
        if (video.currentTime >= end) {
          stop();
          return;
        }
        frame = requestAnimationFrame(draw);
      };
      recorder.start(1000);
      void video
        .play()
        .then(() => {
          frame = requestAnimationFrame(draw);
        })
        .catch(() => {
          failure = new Error('Tap Trim & download again to allow playback.');
          stop();
        });
    });
  } finally {
    cancelAnimationFrame(frame);
    video.pause();
    video.removeAttribute('src');
    video.load();
    stream?.getTracks().forEach((t) => t.stop());
    await context.close();
    URL.revokeObjectURL(url);
  }
}
