import type { TemplateRuntime, VisualizerTemplate } from "../contracts/schema";
import type { AudioFeatures, MidiState, MotionState } from "../contracts/types";
import { CameraController } from "./CameraController";
import { SceneManager } from "./SceneManager";
import { Timebase, type TimebaseConfig } from "./Timebase";

export type RuntimeSource = {
  getAudio: () => AudioFeatures;
  getMidi: () => MidiState;
  getMotion: () => MotionState;
  getBaseParams: () => Record<string, unknown>;
  resolveParams?: (
    runtime: Omit<TemplateRuntime, "params">,
    baseParams: Record<string, unknown>
  ) => Record<string, unknown>;
};

export type RendererCoreConfig = {
  timebase: TimebaseConfig;
  runtime: RuntimeSource;
  onFrame?: (runtime: TemplateRuntime, fps: number) => void;
};

export class RendererCore {
  private readonly runtimeSource: RuntimeSource;
  private readonly timebase: Timebase;
  private readonly onFrame?: (runtime: TemplateRuntime, fps: number) => void;

  private sceneManager?: SceneManager;
  private cameraController?: CameraController;
  private rafId?: number;
  private template?: VisualizerTemplate;
  private seed = 1337;
  private activeParams: Record<string, unknown> = {};
  private lastFpsSample = performance.now();
  private framesSinceFpsSample = 0;
  private fps = 0;

  constructor(config: RendererCoreConfig) {
    this.runtimeSource = config.runtime;
    this.timebase = new Timebase(config.timebase);
    this.onFrame = config.onFrame;
  }

  init(canvas: HTMLCanvasElement): void {
    this.sceneManager = new SceneManager(canvas);
    this.cameraController = new CameraController(this.sceneManager.camera);
    this.resize(canvas.clientWidth || 1280, canvas.clientHeight || 720);
  }

  setTemplate(template: VisualizerTemplate, params: Record<string, unknown>): void {
    if (!this.sceneManager) return;

    this.template?.dispose();
    this.template = template;
    this.activeParams = { ...params };

    template.init(
      {
        scene: this.sceneManager.scene,
        renderer: this.sceneManager.renderer,
        camera: this.sceneManager.camera,
        gl: this.sceneManager.renderer.domElement
      },
      this.activeParams
    );
  }

  setSeed(seed: number): void {
    this.seed = seed;
  }

  setLoopDuration(loopDurationSec: number): void {
    this.timebase.setLoopDuration(loopDurationSec);
  }

  setPaused(paused: boolean): void {
    this.timebase.setPaused(paused);
  }

  setFixedTime(fixedTimeSec?: number): void {
    this.timebase.setFixedTime(fixedTimeSec);
  }

  getCameraController(): CameraController | undefined {
    return this.cameraController;
  }

  start(): void {
    if (this.rafId) return;

    const tick = (now: number): void => {
      const frame = this.timebase.step(now);
      const audio = this.runtimeSource.getAudio();
      const midi = this.runtimeSource.getMidi();
      const motion = this.runtimeSource.getMotion();
      const baseParams = this.runtimeSource.getBaseParams();
      const runtimeBase: Omit<TemplateRuntime, "params"> = {
        t: frame.t,
        dt: frame.dt,
        loopT: frame.loopT,
        seed: this.seed,
        audio,
        midi,
        motion
      };

      const params = this.runtimeSource.resolveParams
        ? this.runtimeSource.resolveParams(runtimeBase, baseParams)
        : baseParams;

      const runtime: TemplateRuntime = {
        ...runtimeBase,
        params
      };

      this.activeParams = params;
      this.template?.update(runtime);
      this.sceneManager?.render();

      this.framesSinceFpsSample += 1;
      const elapsed = now - this.lastFpsSample;
      if (elapsed >= 500) {
        this.fps = (this.framesSinceFpsSample * 1000) / elapsed;
        this.lastFpsSample = now;
        this.framesSinceFpsSample = 0;
      }

      this.onFrame?.(runtime, this.fps);
      this.rafId = window.requestAnimationFrame(tick);
    };

    this.rafId = window.requestAnimationFrame(tick);
  }

  renderSingleFrame(timeSec: number): void {
    if (!this.sceneManager) return;

    const frame = this.timebase.sampleAt(timeSec);
    const runtimeBase: Omit<TemplateRuntime, "params"> = {
      t: frame.t,
      dt: frame.dt,
      loopT: frame.loopT,
      seed: this.seed,
      audio: this.runtimeSource.getAudio(),
      midi: this.runtimeSource.getMidi(),
      motion: this.runtimeSource.getMotion()
    };

    const baseParams = this.runtimeSource.getBaseParams();
    const params = this.runtimeSource.resolveParams
      ? this.runtimeSource.resolveParams(runtimeBase, baseParams)
      : baseParams;

    this.template?.update({ ...runtimeBase, params });
    this.sceneManager.render();
    this.onFrame?.({ ...runtimeBase, params }, this.fps);
  }

  stop(): void {
    if (!this.rafId) return;
    window.cancelAnimationFrame(this.rafId);
    this.rafId = undefined;
  }

  resize(width: number, height: number): void {
    this.sceneManager?.resize(width, height);
  }

  dispose(): void {
    this.stop();
    this.template?.dispose();
    this.template = undefined;
    this.sceneManager?.dispose();
  }
}

