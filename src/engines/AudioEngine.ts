import type { AudioFeatures } from "../contracts/types";
import { clamp } from "../utils/math";

export type AudioEngineOptions = {
  fftSize?: number;
  mock?: boolean;
};

const createEmptyFeatures = (fftSize: number): AudioFeatures => ({
  rms: 0,
  bass: 0,
  mids: 0,
  highs: 0,
  spectrum: new Float32Array(fftSize / 2),
  waveform: new Float32Array(fftSize)
});

export class AudioEngine {
  private audioContext?: AudioContext;
  private analyser?: AnalyserNode;
  private source?: MediaElementAudioSourceNode;
  private element?: HTMLAudioElement;
  private readonly fftSize: number;
  private mock: boolean;
  private mockPhase = 0;
  private features: AudioFeatures;

  constructor(options: AudioEngineOptions = {}) {
    this.fftSize = options.fftSize ?? 1024;
    this.mock = Boolean(options.mock);
    this.features = createEmptyFeatures(this.fftSize);
  }

  async init(): Promise<void> {
    if (this.mock || this.audioContext) return;

    this.audioContext = new AudioContext();
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = this.fftSize;
    this.analyser.smoothingTimeConstant = 0.8;

    this.element = new Audio();
    this.element.crossOrigin = "anonymous";
    this.source = this.audioContext.createMediaElementSource(this.element);
    this.source.connect(this.analyser);
    this.analyser.connect(this.audioContext.destination);
  }

  setMockEnabled(enabled: boolean): void {
    this.mock = enabled;
  }

  async loadFile(file: File): Promise<void> {
    if (!this.element) {
      await this.init();
    }

    if (!this.element) return;

    const url = URL.createObjectURL(file);
    this.element.src = url;
    this.element.load();
  }

  async play(): Promise<void> {
    if (this.mock) return;
    if (!this.element) return;
    if (this.audioContext?.state === "suspended") {
      await this.audioContext.resume();
    }
    await this.element.play();
  }

  pause(): void {
    if (this.mock) return;
    this.element?.pause();
  }

  seek(seconds: number): void {
    if (this.element) {
      this.element.currentTime = Math.max(seconds, 0);
    }
  }

  setPlaybackRate(rate: number): void {
    if (this.element) {
      this.element.playbackRate = clamp(rate, 0.25, 4);
    }
  }

  update(dt = 1 / 60): void {
    if (this.mock) {
      this.mockPhase += dt;
      const v = (Math.sin(this.mockPhase * 2 * Math.PI) + 1) / 2;
      this.features.rms = v;
      this.features.bass = (Math.sin(this.mockPhase * 3) + 1) / 2;
      this.features.mids = (Math.sin(this.mockPhase * 5) + 1) / 2;
      this.features.highs = (Math.sin(this.mockPhase * 7) + 1) / 2;
      this.features.spectrum.fill(v);
      this.features.waveform.fill(v * 2 - 1);
      return;
    }

    if (!this.analyser) return;

    const freqBytes = new Uint8Array(this.analyser.frequencyBinCount);
    const waveBytes = new Uint8Array(this.analyser.fftSize);

    this.analyser.getByteFrequencyData(freqBytes);
    this.analyser.getByteTimeDomainData(waveBytes);

    for (let i = 0; i < freqBytes.length; i += 1) {
      this.features.spectrum[i] = freqBytes[i] / 255;
    }

    for (let i = 0; i < waveBytes.length; i += 1) {
      this.features.waveform[i] = waveBytes[i] / 127.5 - 1;
    }

    const third = Math.floor(freqBytes.length / 3);
    const avg = (start: number, end: number): number => {
      let sum = 0;
      const count = Math.max(end - start, 1);
      for (let i = start; i < end; i += 1) {
        sum += freqBytes[i];
      }
      return sum / count / 255;
    };

    this.features.bass = avg(0, third);
    this.features.mids = avg(third, third * 2);
    this.features.highs = avg(third * 2, freqBytes.length);

    let rms = 0;
    for (let i = 0; i < this.features.waveform.length; i += 1) {
      const sample = this.features.waveform[i];
      rms += sample * sample;
    }
    this.features.rms = Math.sqrt(rms / this.features.waveform.length);
  }

  getFeatures(): AudioFeatures {
    return this.features;
  }

  dispose(): void {
    this.element?.pause();
    this.element = undefined;
    this.source?.disconnect();
    this.analyser?.disconnect();
    this.audioContext?.close();
  }
}
