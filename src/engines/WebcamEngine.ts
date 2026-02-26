import type { MotionState } from "../contracts/types";
import { clamp } from "../utils/math";

export class WebcamEngine {
  private state: MotionState = { enabled: false, intensity: 0 };
  private video?: HTMLVideoElement;
  private canvas?: HTMLCanvasElement;
  private ctx?: CanvasRenderingContext2D;
  private previous?: Uint8ClampedArray;
  private stream?: MediaStream;
  private mock = false;
  private mockPhase = 0;

  setMockEnabled(enabled: boolean): void {
    this.mock = enabled;
    this.state.enabled = enabled;
  }

  async init(): Promise<void> {
    if (this.mock) {
      this.state.enabled = true;
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      this.state.enabled = false;
      return;
    }

    this.stream = await navigator.mediaDevices.getUserMedia({ video: true });
    this.video = document.createElement("video");
    this.video.playsInline = true;
    this.video.autoplay = true;
    this.video.srcObject = this.stream;
    await this.video.play();

    this.canvas = document.createElement("canvas");
    this.canvas.width = 160;
    this.canvas.height = 120;
    this.ctx = this.canvas.getContext("2d") ?? undefined;

    this.state.enabled = true;
  }

  injectMockIntensity(intensity: number): void {
    this.state.enabled = true;
    this.state.intensity = clamp(intensity, 0, 1);
  }

  update(dt = 1 / 60): void {
    if (this.mock) {
      this.mockPhase += dt;
      this.state.enabled = true;
      this.state.intensity = (Math.sin(this.mockPhase * 5) + 1) / 2;
      return;
    }

    if (!this.state.enabled || !this.video || !this.ctx || !this.canvas) {
      return;
    }

    this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
    const frame = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height).data;

    if (!this.previous) {
      this.previous = new Uint8ClampedArray(frame);
      this.state.intensity = 0;
      return;
    }

    let diff = 0;
    for (let i = 0; i < frame.length; i += 4) {
      diff += Math.abs(frame[i] - this.previous[i]);
    }

    const pixels = frame.length / 4;
    const normalized = clamp(diff / (pixels * 255), 0, 1);

    this.state.intensity = normalized;
    this.previous.set(frame);
  }

  getState(): MotionState {
    return { ...this.state };
  }

  dispose(): void {
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = undefined;
    this.video = undefined;
    this.ctx = undefined;
    this.canvas = undefined;
    this.previous = undefined;
    this.state.enabled = false;
    this.state.intensity = 0;
  }
}
