/** One audio graph, one recording track. The microphone never routes to speakers. */
export class AudioMixer {
  context?: AudioContext;
  destination?: MediaStreamAudioDestinationNode;
  private master?: GainNode;
  private mediaGain?: GainNode;
  private micGain?: GainNode;
  private monitor?: GainNode;
  private analyser?: AnalyserNode;
  private micAnalyser?: AnalyserNode;
  private micSource?: MediaStreamAudioSourceNode;
  private sources = new WeakMap<
    HTMLMediaElement,
    { source: MediaElementAudioSourceNode; gain: GainNode }
  >();
  private masterValue = 0.85;
  private mediaValue = 0.8;
  private micValue = 1;
  private monitorValue = 0.6;
  get settings() {
    return {
      mic: this.micValue,
      media: this.mediaValue,
      master: this.masterValue,
      monitor: this.monitorValue,
    };
  }
  async init() {
    if (!this.context) {
      this.context = new AudioContext();
      const c = this.context;
      this.destination = c.createMediaStreamDestination();
      this.master = c.createGain();
      this.master.gain.value = this.masterValue;
      this.mediaGain = c.createGain();
      this.mediaGain.gain.value = this.mediaValue;
      this.micGain = c.createGain();
      this.micGain.gain.value = this.micValue;
      this.monitor = c.createGain();
      this.monitor.gain.value = this.monitorValue;
      this.analyser = c.createAnalyser();
      this.analyser.fftSize = 512;
      this.micAnalyser = c.createAnalyser();
      this.micAnalyser.fftSize = 512;
      const limiter = c.createDynamicsCompressor();
      limiter.threshold.value = -3;
      limiter.knee.value = 0;
      limiter.ratio.value = 20;
      limiter.attack.value = 0.003;
      limiter.release.value = 0.15;
      this.mediaGain.connect(this.master);
      this.mediaGain.connect(this.monitor);
      this.monitor.connect(c.destination);
      this.micGain.connect(this.master);
      this.micGain.connect(this.micAnalyser);
      this.master.connect(this.analyser);
      this.master.connect(limiter);
      limiter.connect(this.destination);
    }
    if (this.context.state === 'suspended') await this.context.resume();
  }
  connectMicrophone(stream: MediaStream) {
    this.micSource?.disconnect();
    this.micSource = this.context!.createMediaStreamSource(stream);
    this.micSource.connect(this.micGain!);
  }
  disconnectMicrophone() {
    this.micSource?.disconnect();
    this.micSource = undefined;
  }
  connectMedia(element: HTMLMediaElement) {
    if (!this.context || this.sources.has(element)) return;
    const node = this.context.createMediaElementSource(element);
    const gain = this.context.createGain();
    gain.gain.value = Number(element.dataset.frameflowVolume ?? 1);
    node.connect(gain);
    gain.connect(this.mediaGain!);
    this.sources.set(element, { source: node, gain });
    element.muted = false;
    element.volume = 1;
  }
  disconnectMedia(element: HTMLMediaElement) {
    const nodes = this.sources.get(element);
    nodes?.source.disconnect();
    nodes?.gain.disconnect();
    this.sources.delete(element);
  }
  setSourceVolume(element: HTMLMediaElement, value: number) {
    const v = Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 1;
    element.dataset.frameflowVolume = String(v);
    const nodes = this.sources.get(element);
    if (nodes) nodes.gain.gain.value = v;
  }
  setMic(value: number) {
    this.micValue = value;
    if (this.micGain) this.micGain.gain.value = value;
  }
  setMedia(value: number) {
    this.mediaValue = value;
    if (this.mediaGain) this.mediaGain.gain.value = value;
  }
  setMaster(value: number) {
    this.masterValue = value;
    if (this.master) this.master.gain.value = value;
  }
  setMonitor(value: number) {
    this.monitorValue = value;
    if (this.monitor) this.monitor.gain.value = value;
  }
  levels() {
    const level = (a?: AnalyserNode) => {
      if (!a) return 0;
      const data = new Float32Array(a.fftSize);
      a.getFloatTimeDomainData(data);
      return Math.max(...data.map(Math.abs));
    };
    return { mic: level(this.micAnalyser), master: level(this.analyser) };
  }
  async close() {
    this.micSource?.disconnect();
    await this.context?.close();
  }
}
