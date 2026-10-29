import type { RecordingState, Recovery, Take } from '../model';
import { recordingMime, uid } from '../model';
import {
  assembleChunks,
  clearRecovery,
  getRecovery,
  saveRecordingChunk,
  saveTake,
  setRecovery,
} from '../lib/storage';

/** The captured stream is created once per take; scene changes never replace tracks. */
export class StudioRecorder {
  onState: (state: RecordingState) => void = () => {};
  onTime: (seconds: number) => void = () => {};
  onTake: (take: Take) => void = () => {};
  onError: (message: string) => void = () => {};
  private recorder?: MediaRecorder;
  private capture?: MediaStream;
  private recovery?: Recovery;
  private queue: Promise<void> = Promise.resolve();
  private timer?: ReturnType<typeof setInterval>;
  private segmentStart = 0;
  private accumulated = 0;
  private writeError = false;
  private pendingBytes = 0;
  private storageSlow = false;
  state: RecordingState = 'idle';
  get duration() {
    return (
      this.accumulated +
      (this.state === 'recording' ? (performance.now() - this.segmentStart) / 1000 : 0)
    );
  }
  private stateTo(value: RecordingState) {
    this.state = value;
    this.onState(value);
  }
  async start(canvas: HTMLCanvasElement, audio: MediaStream, name: string) {
    if (this.state !== 'idle') return false;
    this.stateTo('starting');
    try {
      if (await getRecovery())
        throw new Error(
          'An interrupted take is waiting for recovery. Reload the studio to recover or discard it before starting another take.',
        );
      if (typeof MediaRecorder === 'undefined' || !canvas.captureStream)
        throw new Error(
          'Recording is unavailable in this browser. Open Frameflow in an up-to-date Safari, Chrome, or Edge browser over HTTPS.',
        );
      canvas.getContext('2d')!.getImageData(0, 0, 1, 1);
      this.capture = canvas.captureStream(30);
      const stream = new MediaStream([...this.capture.getVideoTracks(), ...audio.getAudioTracks()]);
      const mime = recordingMime((t) => MediaRecorder.isTypeSupported(t));
      this.recorder = new MediaRecorder(stream, {
        ...(mime ? { mimeType: mime } : {}),
        videoBitsPerSecond: canvas.width >= 1080 ? 8_000_000 : 4_000_000,
        audioBitsPerSecond: 128_000,
      });
      this.accumulated = 0;
      this.writeError = false;
      this.pendingBytes = 0;
      this.storageSlow = false;
      this.queue = Promise.resolve();
      this.recovery = {
        id: uid(),
        name,
        mime: this.recorder.mimeType || mime || 'video/webm',
        startedAt: Date.now(),
        duration: 0,
        chunks: 0,
      };
      await setRecovery(this.recovery);
      this.recorder.ondataavailable = (e) => {
        if (!e.data.size || !this.recovery) return;
        const index = this.recovery.chunks++;
        this.recovery.duration = this.duration;
        const meta = { ...this.recovery };
        this.pendingBytes += e.data.size;
        this.queue = this.queue
          .then(async () => {
            await saveRecordingChunk(meta, index, e.data);
          })
          .catch(() => {
            this.writeError = true;
            this.onError(
              'Local storage is full or unavailable. Recording has stopped; saved chunks remain available for recovery. Free device storage before recording again.',
            );
            this.stop();
          })
          .finally(() => {
            this.pendingBytes -= e.data.size;
          });
        if (this.pendingBytes > 64 * 1024 * 1024 && !this.storageSlow) {
          this.storageSlow = true;
          this.onError(
            'Device storage cannot keep up with recording. Saving this take now; try 720p for your next take.',
          );
          this.stop();
        }
      };
      this.recorder.onerror = () => {
        this.onError(
          'The browser interrupted the encoder. Frameflow will try to save the captured portion. Check your devices and try a lower resolution.',
        );
        this.stop();
      };
      this.recorder.onstop = () => {
        void this.finish();
      };
      this.recorder.start(1000);
      this.segmentStart = performance.now();
      this.stateTo('recording');
      this.timer = setInterval(() => this.onTime(this.duration), 150);
      return true;
    } catch (e) {
      this.release();
      if (this.recovery && this.recovery.chunks === 0)
        await clearRecovery(this.recovery.id).catch(() => {});
      this.recovery = undefined;
      this.recorder = undefined;
      this.stateTo('idle');
      this.onError(
        e instanceof Error ? e.message : 'Recording could not start. Check browser permissions.',
      );
      return false;
    }
  }
  pause() {
    if (this.recorder?.state === 'recording') {
      this.accumulated = this.duration;
      this.recorder.pause();
      this.stateTo('paused');
      this.onTime(this.duration);
    }
  }
  resume() {
    if (this.recorder?.state === 'paused') {
      this.segmentStart = performance.now();
      this.recorder.resume();
      this.stateTo('recording');
    }
  }
  stop() {
    if (this.recorder && this.recorder.state !== 'inactive') {
      this.accumulated = this.duration;
      this.stateTo('stopping');
      this.recorder.stop();
    }
  }
  flush() {
    if (this.recorder && this.recorder.state !== 'inactive') {
      try {
        this.recorder.requestData();
      } catch {
        /* The native encoder may have just stopped. */
      }
    }
  }
  private async finish() {
    if (!this.recovery) return;
    if (this.state === 'recording' || this.state === 'paused') {
      this.accumulated = this.duration;
      this.stateTo('stopping');
    }
    const meta = this.recovery;
    this.release();
    try {
      await this.queue;
      const blob = await assembleChunks(meta.id, meta.mime);
      if (!blob.size)
        throw new Error(
          'No video data was captured. Try a lower resolution or another supported browser.',
        );
      const take: Take = {
        id: meta.id,
        name: meta.name,
        createdAt: meta.startedAt,
        duration: this.accumulated,
        mime: meta.mime,
        blob,
        recovered: this.writeError || this.storageSlow,
      };
      await saveTake(take);
      if (!this.writeError) await clearRecovery(meta.id);
      this.onTake(take);
    } catch (e) {
      this.onError(
        e instanceof Error
          ? e.message
          : 'The take could not be saved. Captured chunks remain in local recovery.',
      );
    }
    this.recovery = undefined;
    this.stateTo('idle');
  }
  private release() {
    clearInterval(this.timer);
    this.capture?.getTracks().forEach((t) => t.stop());
    this.capture = undefined;
  }
  dispose() {
    this.stop();
    this.release();
  }
}
