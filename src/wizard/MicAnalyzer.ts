import { clamp, smoothBass } from "./math";

export type MicStatus = "idle" | "active" | "denied" | "unsupported" | "error";

export class MicAnalyzer {
  private readonly testMode: boolean;
  private context?: AudioContext;
  private analyser?: AnalyserNode;
  private frequencyBuffer?: Uint8Array<ArrayBuffer>;
  private stream?: MediaStream;
  private bass = 0;
  private enabled = false;
  private status: MicStatus = "idle";
  private sensitivity = 1.6;

  constructor(testMode: boolean) {
    this.testMode = testMode;
  }

  async start(): Promise<MicStatus> {
    if (this.enabled) {
      return this.status;
    }

    if (this.testMode) {
      this.enabled = true;
      this.status = "active";
      return this.status;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      this.status = "unsupported";
      return this.status;
    }

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false
        }
      });

      const ContextCtor =
        window.AudioContext ||
        (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!ContextCtor) {
        this.stream?.getTracks().forEach((track) => track.stop());
        this.stream = undefined;
        this.status = "unsupported";
        return this.status;
      }
      this.context = new ContextCtor();
      const source = this.context.createMediaStreamSource(this.stream);
      this.analyser = this.context.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.75;
      this.frequencyBuffer = new Uint8Array(new ArrayBuffer(this.analyser.frequencyBinCount));
      source.connect(this.analyser);

      this.enabled = true;
      this.status = "active";
      return this.status;
    } catch {
      this.stop();
      this.enabled = false;
      this.status = "denied";
      return this.status;
    }
  }

  stop(): void {
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = undefined;
    this.analyser?.disconnect();
    this.analyser = undefined;
    this.frequencyBuffer = undefined;
    void this.context?.close();
    this.context = undefined;
    this.enabled = false;
    this.status = "idle";
    this.bass = 0;
  }

  getStatus(): MicStatus {
    return this.status;
  }

  isActive(): boolean {
    return this.enabled;
  }

  setSensitivity(value: number): void {
    this.sensitivity = clamp(value, 0, 3);
  }

  getSensitivity(): number {
    return this.sensitivity;
  }

  update(dt: number, time: number): number {
    if (this.testMode) {
      if (!this.enabled) {
        this.bass *= 0.94;
        return this.bass * this.sensitivity;
      }
      const raw = (Math.sin((time + dt) * 2.3) + 1) / 2;
      this.bass = smoothBass(this.bass, raw);
      return this.bass * this.sensitivity;
    }

    if (!this.enabled || !this.analyser) {
      this.bass *= 0.94;
      return this.bass * this.sensitivity;
    }

    let buffer = this.frequencyBuffer;
    if (!buffer || buffer.length !== this.analyser.frequencyBinCount) {
      buffer = new Uint8Array(new ArrayBuffer(this.analyser.frequencyBinCount));
      this.frequencyBuffer = buffer;
    }
    this.analyser.getByteFrequencyData(buffer);
    const lowBandCount = Math.min(12, buffer.length);

    let lowSum = 0;
    for (let i = 0; i < lowBandCount; i += 1) {
      lowSum += buffer[i];
    }
    const rawBass = lowBandCount === 0 ? 0 : lowSum / lowBandCount / 255;
    this.bass = smoothBass(this.bass, rawBass);
    return this.bass * this.sensitivity;
  }

  dispose(): void {
    this.stop();
  }
}
