import * as THREE from "three";
import { AfterimagePass } from "three/examples/jsm/postprocessing/AfterimagePass.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { mulberry32 } from "../utils/rng";
import {
  HandWizardController,
  type HandDebugInfo,
  type HandMode,
  type HandTrackingState,
  type HandWizardUiState
} from "./HandWizardController";
import { clamp, computeSharedRatio } from "./math";
import { MicAnalyzer, type MicStatus } from "./MicAnalyzer";

export const FPS_CAP_MIN = 60;
export const FPS_CAP_MAX = 240;
export const FPS_CAP_DEFAULT = 144;
export const PARTICLE_COUNT_MIN = 1_000;
export const PARTICLE_COUNT_MAX = 160_000;
export const PARTICLE_COUNT_DEFAULT = 50_000;

const DPR_CAP = 2;
const LOW_PERFORMANCE_PARTICLE_FLOOR = 15_000;
const MORPH_DURATION_SEC = 1.25;

export const WIZARD_MODE_NAMES = [
  "SPHERICAL",
  "MOBIUS",
  "TOROIDAL",
  "LISSAJOUS",
  "FRACTAL",
  "KLEIN",
  "HELIX",
  "GYROID",
  "SUPERFORMULA",
  "WAVE KNOT"
] as const;
const MODE_NAMES = WIZARD_MODE_NAMES;

export type VisualTuning = {
  bloomStrength: number;
  bloomRadius: number;
  bloomThreshold: number;
  particleGain: number;
};

export type PaletteConfig = {
  primary: string;
  secondary: string;
  accent: string;
  presetId?: string;
};

export const DEFAULT_VISUAL_TUNING: VisualTuning = {
  bloomStrength: 0.55,
  bloomRadius: 0.35,
  bloomThreshold: 0.18,
  particleGain: 0.95
};

export const DEFAULT_PALETTE: PaletteConfig = {
  primary: "#6ee7ff",
  secondary: "#4fb5ff",
  accent: "#9e78ff",
  presetId: "neon-cyan"
};

export type PerformanceMode = "auto" | "high" | "low";

const DEFAULT_HAND_DEBUG: HandDebugInfo = {
  palmCount: 0,
  palms: [],
  centerX: 0.5,
  centerY: 0.5,
  inCenter: false,
  leftTargetReady: false,
  rightTargetReady: false,
  calibrationTimerMs: 0,
  mappedOffset: { x: 0, y: 0, z: 0 },
  mappedScale: 0,
  mappedOffsetLeft: { x: 0, y: 0, z: 0 },
  mappedScaleLeft: 0,
  mappedOffsetRight: { x: 0, y: 0, z: 0 },
  mappedScaleRight: 0,
  mappedFingerLeft: 0,
  mappedFingerRight: 0,
  staleMs: 0
};

const DEFAULT_HAND_UI_STATE: HandWizardUiState = {
  webcamVisible: true,
  overlayOpacity: 0.35,
  wizardActive: false,
  statusText: "Align both palms with the outlines to calibrate wizard.",
  statusColor: "#00ffff",
  handMode: "none",
  handTrackingState: "loading",
  debug: DEFAULT_HAND_DEBUG
};

export type WizardHudState = {
  particleCount: number;
  targetFps: number;
  fps: number;
  modeName: string;
  modeNames: readonly string[];
  title: string;
  trailsText: string;
  trailsActive: boolean;
  flowActive: boolean;
  wizardActive: boolean;
  statusText: string;
  statusColor: string;
  webcamVisible: boolean;
  calibrationOpacity: number;
  micButtonText: string;
  micButtonColor: string;
  micStatus: MicStatus;
  micSensitivity: number;
  micLevel: number;
  handMode: HandMode;
  handTrackingState: HandTrackingState;
  handDebug: HandDebugInfo;
  cameraDebug: {
    azimuth: number;
    polar: number;
    distance: number;
    targetAzimuth: number;
    targetPolar: number;
    targetDistance: number;
    response: number;
  };
  visualTuning: VisualTuning;
  palette: PaletteConfig;
};

type ParticleSideUniforms = {
  time: { value: number };
  currentMode: { value: number };
  targetMode: { value: number };
  morph: { value: number };
  handOffset: { value: THREE.Vector3 };
  handScale: { value: number };
  handFingerSignal: { value: number };
  modelSeparation: { value: number };
  sharedRatio: { value: number };
  isRight: { value: number };
  bassPump: { value: number };
  colorPrimary: { value: THREE.Vector3 };
  colorSecondary: { value: THREE.Vector3 };
  colorAccent: { value: THREE.Vector3 };
  particleGain: { value: number };
};

const MODEL_SEPARATION = 10;
const SHARED_NEAR_DISTANCE = 7;
const SHARED_FAR_DISTANCE = 28;

export type ParticleWizardRuntimeConfig = {
  canvas: HTMLCanvasElement;
  video: HTMLVideoElement;
  testMode: boolean;
  seed: number;
  fixedTimeSec?: number;
  width?: number;
  height?: number;
  onHudUpdate?: (state: WizardHudState) => void;
};

type StatusOverride = {
  text: string;
  color: string;
  until: number;
};

const toColorVector = (hex: string): THREE.Vector3 => {
  const color = new THREE.Color(hex);
  return new THREE.Vector3(color.r, color.g, color.b);
};

export const createInitialHudState = (): WizardHudState => ({
  particleCount: PARTICLE_COUNT_DEFAULT,
  targetFps: FPS_CAP_DEFAULT,
  fps: FPS_CAP_DEFAULT,
  modeName: MODE_NAMES[0],
  modeNames: MODE_NAMES,
  title: "PARTICLE WIZARD",
  trailsText: "ACTIVE",
  trailsActive: true,
  flowActive: true,
  wizardActive: false,
  statusText: DEFAULT_HAND_UI_STATE.statusText,
  statusColor: DEFAULT_HAND_UI_STATE.statusColor,
  webcamVisible: true,
  calibrationOpacity: 0.35,
  micButtonText: "MIC OFF",
  micButtonColor: "#00ffff",
  micStatus: "idle",
  micSensitivity: 1.6,
  micLevel: 0,
  handMode: "none",
  handTrackingState: "loading",
  handDebug: { ...DEFAULT_HAND_DEBUG },
  cameraDebug: {
    azimuth: 0.6,
    polar: 1.28,
    distance: 42,
    targetAzimuth: 0.6,
    targetPolar: 1.28,
    targetDistance: 42,
    response: 0.15
  },
  visualTuning: { ...DEFAULT_VISUAL_TUNING },
  palette: { ...DEFAULT_PALETTE }
});

export class ParticleWizardRuntime {
  private readonly config: ParticleWizardRuntimeConfig;
  private readonly mic: MicAnalyzer;
  private readonly handController: HandWizardController;

  private scene?: THREE.Scene;
  private camera?: THREE.PerspectiveCamera;
  private renderer?: THREE.WebGLRenderer;
  private composer?: EffectComposer;
  private bloomPass?: UnrealBloomPass;
  private afterimagePass?: AfterimagePass;
  private leftParticles?: THREE.Points;
  private rightParticles?: THREE.Points;
  private stars?: THREE.Points;
  private particleGeometry?: THREE.BufferGeometry;
  private starGeometry?: THREE.BufferGeometry;
  private leftParticleMaterial?: THREE.ShaderMaterial;
  private rightParticleMaterial?: THREE.ShaderMaterial;

  private leftParticleUniforms?: ParticleSideUniforms;
  private rightParticleUniforms?: ParticleSideUniforms;
  private frameRequestId?: number;
  private running = false;
  private initialized = false;
  private handUiState: HandWizardUiState = DEFAULT_HAND_UI_STATE;
  private visualTuning: VisualTuning = { ...DEFAULT_VISUAL_TUNING };
  private palette: PaletteConfig = { ...DEFAULT_PALETTE };

  private clock = new THREE.Clock();
  private globalTime = 0;
  private morphProgress = 1;
  private currentMode = 0;
  private targetMode = 0;
  private flowActive = true;
  private trailsActive = true;
  private particleCount = PARTICLE_COUNT_DEFAULT;
  private targetFps = FPS_CAP_DEFAULT;
  private fps = FPS_CAP_DEFAULT;
  private fpsFrameCount = 0;
  private fpsSampleStart = performance.now();
  private lastRenderTime = 0;

  private curAz = 0.6;
  private curPol = 1.28;
  private curDist = 42;
  private targetAz = 0.6;
  private targetPol = 1.28;
  private targetDist = 42;
  private cameraResponse = 0.15;
  private performanceMode: PerformanceMode = "auto";
  private autoPerformancePreset: "low" | "high" = "high";
  private isDragging = false;
  private lastPointerX = 0;
  private lastPointerY = 0;
  private particleRebuildTimer?: number;
  private micLevel = 0;
  private readonly leftCenter = new THREE.Vector3();
  private readonly rightCenter = new THREE.Vector3();

  private statusOverride?: StatusOverride;
  private lastHudEmitTime = 0;

  constructor(config: ParticleWizardRuntimeConfig) {
    this.config = config;
    this.mic = new MicAnalyzer(config.testMode);
    this.handController = new HandWizardController({
      testMode: config.testMode,
      video: config.video,
      onStateChange: (state) => {
        this.handUiState = state;
        this.emitHud(true);
      }
    });
    this.handUiState = this.handController.getUiState();
  }

  async start(): Promise<void> {
    if (this.running) {
      return;
    }

    if (!this.initialized) {
      this.init();
    }

    this.running = true;
    this.clock.start();
    this.fpsFrameCount = 0;
    this.fpsSampleStart = performance.now();
    this.lastRenderTime = 0;
    this.applyPerformancePreset();
    void this.handController.init();
    this.frameRequestId = window.requestAnimationFrame(this.tick);
  }

  resize(width: number, height: number): void {
    if (!this.renderer || !this.camera || !this.composer) {
      return;
    }

    const safeWidth = Math.max(1, Math.floor(width));
    const safeHeight = Math.max(1, Math.floor(height));
    this.camera.aspect = safeWidth / safeHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(safeWidth, safeHeight, false);
    this.composer.setSize(safeWidth, safeHeight);
  }

  cycleTransform(): void {
    if (!this.leftParticleUniforms || !this.rightParticleUniforms) {
      return;
    }
    this.morphProgress = 0;
    this.currentMode = this.targetMode;
    this.targetMode = (this.targetMode + 1) % MODE_NAMES.length;
    this.leftParticleUniforms.currentMode.value = this.currentMode;
    this.leftParticleUniforms.targetMode.value = this.targetMode;
    this.rightParticleUniforms.currentMode.value = this.currentMode;
    this.rightParticleUniforms.targetMode.value = this.targetMode;
    this.emitHud(true);
  }

  setMode(index: number): void {
    if (!this.leftParticleUniforms || !this.rightParticleUniforms) {
      return;
    }
    const safeIndex = ((Math.round(index) % MODE_NAMES.length) + MODE_NAMES.length) % MODE_NAMES.length;
    if (safeIndex === this.targetMode) {
      return;
    }
    this.morphProgress = 0;
    this.currentMode = this.targetMode;
    this.targetMode = safeIndex;
    this.leftParticleUniforms.currentMode.value = this.currentMode;
    this.leftParticleUniforms.targetMode.value = this.targetMode;
    this.rightParticleUniforms.currentMode.value = this.currentMode;
    this.rightParticleUniforms.targetMode.value = this.targetMode;
    this.emitHud(true);
  }

  toggleFlow(): void {
    this.flowActive = !this.flowActive;
    this.emitHud(true);
  }

  toggleTrails(): void {
    this.trailsActive = !this.trailsActive;
    if (this.afterimagePass) {
      this.afterimagePass.enabled = this.trailsActive;
    }
    this.emitHud(true);
  }

  setTargetFps(next: number): void {
    this.targetFps = clamp(Math.round(next), FPS_CAP_MIN, FPS_CAP_MAX);
    this.emitHud(true);
  }

  setParticleCount(next: number): void {
    const floor = this.performanceMode === "low" ? LOW_PERFORMANCE_PARTICLE_FLOOR : PARTICLE_COUNT_MIN;
    const safeCount = clamp(Math.floor(next), floor, PARTICLE_COUNT_MAX);
    if (safeCount === this.particleCount) {
      return;
    }

    this.particleCount = safeCount;
    this.scheduleParticleRebuild();
    this.emitHud(true);
  }

  setPerformanceMode(next: PerformanceMode): void {
    const nextMode = next === "low" ? "low" : next === "high" ? "high" : "auto";
    if (nextMode === this.performanceMode) {
      return;
    }

    this.performanceMode = nextMode;
    if (nextMode !== "auto") {
      this.autoPerformancePreset = nextMode;
    }
    this.applyPerformancePreset();
    if (nextMode !== "auto") {
      this.applyParticleBudget();
    }
    this.emitHud(true);
  }

  setCameraResponse(next: number): void {
    this.cameraResponse = clamp(next, 0.03, 0.4);
    this.emitHud(true);
  }

  private getEffectivePerformanceMode(): "low" | "high" {
    return this.performanceMode === "auto" ? this.autoPerformancePreset : this.performanceMode;
  }

  private applyParticleBudget(): void {
    const effectiveMode = this.getEffectivePerformanceMode();
    if (effectiveMode === "low" && this.performanceMode === "low") {
      const adjustedCount = Math.max(LOW_PERFORMANCE_PARTICLE_FLOOR, this.particleCount);
      if (adjustedCount !== this.particleCount) {
        this.particleCount = adjustedCount;
      }
    }

    this.scheduleParticleRebuild();
    this.emitHud(true);
  }

  private applyPerformancePreset(): void {
    const effectiveMode = this.getEffectivePerformanceMode();
    if (!this.bloomPass || !this.afterimagePass) {
      return;
    }

    if (effectiveMode === "low") {
      this.bloomPass.strength = 0;
      this.bloomPass.radius = 0;
      this.bloomPass.threshold = 1;
      this.afterimagePass.enabled = false;
    } else {
      this.bloomPass.strength = this.visualTuning.bloomStrength;
      this.bloomPass.radius = this.visualTuning.bloomRadius;
      this.bloomPass.threshold = this.visualTuning.bloomThreshold;
      this.afterimagePass.enabled = this.trailsActive;
    }
  }

  setVisualTuning(next: Partial<VisualTuning>): void {
    this.visualTuning = {
      bloomStrength: clamp(next.bloomStrength ?? this.visualTuning.bloomStrength, 0, 1.5),
      bloomRadius: clamp(next.bloomRadius ?? this.visualTuning.bloomRadius, 0, 1),
      bloomThreshold: clamp(next.bloomThreshold ?? this.visualTuning.bloomThreshold, 0, 1),
      particleGain: clamp(next.particleGain ?? this.visualTuning.particleGain, 0.4, 1.4)
    };

    if (this.bloomPass && this.getEffectivePerformanceMode() === "high") {
      this.bloomPass.strength = this.visualTuning.bloomStrength;
      this.bloomPass.radius = this.visualTuning.bloomRadius;
      this.bloomPass.threshold = this.visualTuning.bloomThreshold;
    }

    if (this.leftParticleUniforms && this.rightParticleUniforms) {
      this.leftParticleUniforms.particleGain.value = this.visualTuning.particleGain;
      this.rightParticleUniforms.particleGain.value = this.visualTuning.particleGain;
    }

    this.emitHud(true);
  }

  setPalette(next: PaletteConfig): void {
    this.palette = {
      primary: next.primary,
      secondary: next.secondary,
      accent: next.accent,
      presetId: next.presetId
    };

    if (this.leftParticleUniforms && this.rightParticleUniforms) {
      this.leftParticleUniforms.colorPrimary.value.copy(toColorVector(this.palette.primary));
      this.leftParticleUniforms.colorSecondary.value.copy(toColorVector(this.palette.secondary));
      this.leftParticleUniforms.colorAccent.value.copy(toColorVector(this.palette.accent));
      this.rightParticleUniforms.colorPrimary.value.copy(toColorVector(this.palette.primary));
      this.rightParticleUniforms.colorSecondary.value.copy(toColorVector(this.palette.secondary));
      this.rightParticleUniforms.colorAccent.value.copy(toColorVector(this.palette.accent));
    }

    this.emitHud(true);
  }

  resetHandCalibration(): void {
    this.handController.resetCalibration();
    this.emitHud(true);
  }

  async requestMic(): Promise<MicStatus> {
    if (this.mic.isActive()) {
      return this.mic.getStatus();
    }
    const status = await this.mic.start();
    this.applyMicStatusOverride(status, false);
    this.emitHud(true);
    return status;
  }

  async toggleMic(): Promise<MicStatus> {
    if (this.mic.isActive()) {
      this.mic.stop();
      const status = this.mic.getStatus();
      this.applyMicStatusOverride(status, true);
      this.emitHud(true);
      return status;
    }

    const status = await this.mic.start();
    this.applyMicStatusOverride(status, false);
    this.emitHud(true);
    return status;
  }

  setMicSensitivity(value: number): void {
    this.mic.setSensitivity(value);
    this.emitHud(true);
  }

  dispose(): void {
    this.running = false;
    if (this.frameRequestId) {
      window.cancelAnimationFrame(this.frameRequestId);
      this.frameRequestId = undefined;
    }
    if (this.particleRebuildTimer !== undefined) {
      window.clearTimeout(this.particleRebuildTimer);
      this.particleRebuildTimer = undefined;
    }
    this.fpsFrameCount = 0;
    this.fpsSampleStart = performance.now();
    this.lastRenderTime = 0;
    this.micLevel = 0;

    this.detachPointerControls();
    this.handController.dispose();
    this.mic.dispose();

    if (this.scene) {
      if (this.leftParticles) {
        this.scene.remove(this.leftParticles);
      }
      if (this.rightParticles) {
        this.scene.remove(this.rightParticles);
      }
    }
    if (this.scene && this.stars) {
      this.scene.remove(this.stars);
    }

    this.particleGeometry?.dispose();
    this.starGeometry?.dispose();
    this.leftParticleMaterial?.dispose();
    if (this.rightParticleMaterial && this.rightParticleMaterial !== this.leftParticleMaterial) {
      this.rightParticleMaterial.dispose();
    }
    (this.stars?.material as THREE.Material | undefined)?.dispose();

    this.afterimagePass?.dispose();
    this.composer?.dispose();
    this.renderer?.dispose();

    this.scene = undefined;
    this.camera = undefined;
    this.renderer = undefined;
    this.composer = undefined;
    this.bloomPass = undefined;
    this.afterimagePass = undefined;
    this.leftParticles = undefined;
    this.rightParticles = undefined;
    this.stars = undefined;
    this.particleGeometry = undefined;
    this.starGeometry = undefined;
    this.leftParticleMaterial = undefined;
    this.rightParticleMaterial = undefined;
    this.leftParticleUniforms = undefined;
    this.rightParticleUniforms = undefined;
    this.initialized = false;
  }

  private init(): void {
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x02050f, 0.008);

    const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 300);
    camera.position.set(0, 15, 42);

    const renderer = new THREE.WebGLRenderer({
      canvas: this.config.canvas,
      antialias: true,
      powerPreference: "high-performance"
    });
    renderer.setPixelRatio(Math.min(DPR_CAP, window.devicePixelRatio || 1));
    renderer.setClearColor(0x000000, 1);

    const composer = new EffectComposer(renderer);
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);

    const bloomPass = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.55, 0.35, 0.18);
    composer.addPass(bloomPass);

    const afterimagePass = new AfterimagePass(0.87);
    afterimagePass.enabled = this.trailsActive;
    composer.addPass(afterimagePass);

    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    this.composer = composer;
    this.bloomPass = bloomPass;
    this.afterimagePass = afterimagePass;

    this.buildParticles();
    this.buildStars();
    this.attachPointerControls();

    this.setVisualTuning(this.visualTuning);
    this.setPalette(this.palette);
    this.applyPerformancePreset();

    const initialWidth = this.config.width ?? this.config.canvas.clientWidth ?? window.innerWidth;
    const initialHeight = this.config.height ?? this.config.canvas.clientHeight ?? window.innerHeight;
    this.resize(initialWidth, initialHeight);

    this.initialized = true;
    this.emitHud(true);
  }

  private buildParticleUniforms(isRight: number, previous?: ParticleSideUniforms): ParticleSideUniforms {
    return {
      time: { value: previous?.time.value ?? this.globalTime },
      currentMode: { value: this.currentMode },
      targetMode: { value: this.targetMode },
      morph: { value: previous?.morph.value ?? this.morphProgress },
      handOffset: { value: previous?.handOffset.value ? previous.handOffset.value.clone() : new THREE.Vector3(0, 0, 0) },
      handScale: { value: previous?.handScale.value ?? 0 },
      handFingerSignal: { value: previous?.handFingerSignal.value ?? 0 },
      modelSeparation: { value: MODEL_SEPARATION },
      sharedRatio: { value: previous?.sharedRatio.value ?? 1 },
      isRight: { value: isRight },
      bassPump: { value: previous?.bassPump.value ?? 0 },
      colorPrimary: { value: toColorVector(this.palette.primary) },
      colorSecondary: { value: toColorVector(this.palette.secondary) },
      colorAccent: { value: toColorVector(this.palette.accent) },
      particleGain: { value: previous?.particleGain.value ?? this.visualTuning.particleGain }
    };
  }

  private buildParticles(): void {
    if (!this.scene) {
      return;
    }

    const previousLeftUniforms = this.leftParticleUniforms;
    const previousRightUniforms = this.rightParticleUniforms;

    if (this.leftParticles) {
      this.scene.remove(this.leftParticles);
    }
    if (this.rightParticles) {
      this.scene.remove(this.rightParticles);
    }
    this.leftParticles = undefined;
    this.rightParticles = undefined;
    this.particleGeometry?.dispose();
    this.leftParticleMaterial?.dispose();
    this.rightParticleMaterial?.dispose();

    const count = this.particleCount;
    const rng = mulberry32(this.config.seed);
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const p1Attr = new Float32Array(count);
    const p2Attr = new Float32Array(count);
    const p3Attr = new Float32Array(count);

    for (let i = 0; i < count; i += 1) {
      const index3 = i * 3;
      positions[index3] = 0;
      positions[index3 + 1] = 0;
      positions[index3 + 2] = 0;

      const hue = 0.52 + rng() * 0.18;
      const color = new THREE.Color().setHSL(hue, 0.98, 0.92);
      colors[index3] = color.r;
      colors[index3 + 1] = color.g;
      colors[index3 + 2] = color.b;

      p1Attr[i] = rng();
      p2Attr[i] = rng();
      p3Attr[i] = rng();
    }

    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute("p1", new THREE.BufferAttribute(p1Attr, 1));
    geometry.setAttribute("p2", new THREE.BufferAttribute(p2Attr, 1));
    geometry.setAttribute("p3", new THREE.BufferAttribute(p3Attr, 1));

    const vertexShader = `
      attribute float p1;
      attribute float p2;
      attribute float p3;
      attribute vec3 color;
      uniform float time;
      uniform int currentMode;
      uniform int targetMode;
      uniform float morph;
      uniform vec3 handOffset;
      uniform float handScale;
      uniform float handFingerSignal;
      uniform float modelSeparation;
      uniform float sharedRatio;
      uniform float isRight;
      uniform float bassPump;
      uniform vec3 colorPrimary;
      uniform vec3 colorSecondary;
      uniform vec3 colorAccent;
      uniform float particleGain;
      varying vec3 vColor;
      varying float vVisible;

      float superFormula(float angle, float m, float n1, float n2, float n3, float a, float b) {
        float c = pow(abs(cos(m * angle * 0.25) / a), n2);
        float s = pow(abs(sin(m * angle * 0.25) / b), n3);
        float value = pow(c + s, -1.0 / n1);
        return clamp(value, 0.0, 3.0);
      }

      vec3 getPos(int mode, float t, float a, float b) {
        vec3 p = vec3(0.0);
        if (mode == 0) {
          float theta = a * 3.14159;
          float phi = b * 6.28318;
          float harm = sin(4.0 * theta) * cos(5.0 * phi + t * 1.3) * 2.2;
          float r = 11.0 + harm + sin(t * 2.7 + a * 11.0) * 1.1;
          p.x = r * sin(theta) * cos(phi);
          p.y = r * sin(theta) * sin(phi) + cos(t * 1.4) * 1.5;
          p.z = r * cos(theta);
        } else if (mode == 1) {
          float u = b * 6.28318 + t * 2.4;
          float v = (a - 0.5) * 6.8;
          float h = u * 0.5;
          float r = 10.5;
          p.x = (r + v * cos(h)) * cos(u);
          p.y = (r + v * cos(h)) * sin(u);
          p.z = v * sin(h);
        } else if (mode == 2) {
          float tu = a * 6.28318 + t * 2.1;
          float tv = b * 6.28318 + sin(tu * 3.8) * 1.4;
          float rBig = 10.0;
          float rSmall = 3.4 + sin(t * 3.3 + a * 18.0) * 0.9;
          p.x = (rBig + rSmall * cos(tv)) * cos(tu);
          p.y = (rBig + rSmall * cos(tv)) * sin(tu) + sin(tu * 7.0) * 0.9;
          p.z = rSmall * sin(tv);
        } else if (mode == 3) {
          float ph = t * 2.8 + a * 18.0;
          p.x = 10.2 * sin(2.3 * ph) + 1.4 * sin(8.0 * ph);
          p.y = 10.2 * sin(3.7 * ph);
          p.z = 10.2 * sin(5.9 * ph + b * 12.0);
        } else if (mode == 4) {
          float depth = floor(a * 7.0);
          float ang = b * 6.28318 * 3.2;
          float len = 14.0 * pow(0.61, depth);
          p.x = sin(ang) * len * 0.85;
          p.y = 9.5 - depth * 2.6;
          p.z = cos(ang * 1.55) * len * 0.75;
          for (int k = 0; k < 6; k++) {
            if (float(k) <= depth) {
              p.x += sin(t * 1.8 + float(k) * 2.4) * 0.7;
              p.z += cos(t * 1.5 + float(k)) * 0.6;
            }
          }
        } else if (mode == 5) {
          float u = a * 6.28318;
          float v = b * 6.28318;
          float r = 4.6 * (1.0 - 0.5 * cos(u));
          float shell = 6.0 + r * sin(v) - sin(u * 0.5) * sin(v);
          p.x = shell * cos(u) * 1.35;
          p.y = shell * sin(u) * 1.35 + sin(t * 1.8 + u) * 0.8;
          p.z = (r * cos(v) + cos(u * 0.5) * sin(v) * 3.0) * 1.35;
        } else if (mode == 6) {
          float turns = 8.0;
          float ang = a * 6.28318 * turns + t * 2.4;
          float radius = 6.5 + sin(b * 6.28318 + t * 2.0) * 1.7;
          p.x = cos(ang) * radius;
          p.y = (a - 0.5) * 34.0 + sin(ang * 0.5 + b * 4.0) * 1.2;
          p.z = sin(ang) * radius;
        } else if (mode == 7) {
          float gx = (a * 2.0 - 1.0) * 4.2;
          float gy = (b * 2.0 - 1.0) * 4.2;
          float gz = sin((a + b + t * 0.2) * 6.28318) * 4.2;
          float field = sin(gx) * cos(gy) + sin(gy) * cos(gz) + sin(gz) * cos(gx);
          p.x = gx * 2.5 + sin(t + gy) * 1.2;
          p.y = gy * 2.5 + cos(t * 1.1 + gz) * 1.2;
          p.z = gz * 2.5 + field * 2.6;
        } else if (mode == 8) {
          float ang1 = a * 6.28318;
          float ang2 = b * 3.14159 - 1.57079;
          float r1 = superFormula(ang1 + t * 0.35, 7.0, 0.35, 1.2, 1.2, 1.0, 1.0);
          float r2 = superFormula(ang2, 3.0, 0.55, 1.0, 1.0, 1.0, 1.0);
          float r = 11.0 * r1 * r2;
          p.x = r * cos(ang1) * cos(ang2);
          p.y = r * sin(ang1) * cos(ang2);
          p.z = r * sin(ang2);
          vec3 n = normalize(p + vec3(0.001));
          p += n * sin(t * 2.2 + a * 14.0) * 1.4;
        } else if (mode == 9) {
          float u = a * 6.28318;
          float pK = 3.0;
          float qK = 5.0;
          float core = 9.5 + 2.3 * cos(qK * u + t * 2.0);
          float xk = core * cos(pK * u);
          float yk = core * sin(pK * u);
          float zk = 2.3 * sin(qK * u + t * 2.0);
          float ring = b * 6.28318;
          float tube = 1.4 + sin(u * 4.0 + t * 1.8) * 0.35;
          p.x = xk + tube * cos(ring) * cos(u);
          p.y = yk + tube * cos(ring) * sin(u);
          p.z = zk + tube * sin(ring) * 1.3;
        }
        return p;
      }

      void main() {
        vec3 paletteAB = mix(colorPrimary, colorSecondary, clamp(p1, 0.0, 1.0));
        float accentWeight = smoothstep(0.35, 1.0, clamp(p2, 0.0, 1.0)) * 0.75;
        vec3 paletteColor = mix(paletteAB, colorAccent, accentWeight);
        vColor = paletteColor * (0.75 + color.r * 0.5) * particleGain;

        vec3 base = getPos(currentMode, time, p1, p2);
        vec3 next = getPos(targetMode, time, p1, p2);
        vec3 pos = mix(base, next, morph);

        float split = max(0.0, (1.0 - sharedRatio) * 0.5);
        float shared = 1.0 - step(sharedRatio, p3);
        float splitStart = sharedRatio + split;
        float leftExclusive = step(sharedRatio, p3) * (1.0 - step(splitStart, p3));
        float rightExclusive = step(splitStart, p3);
        float rightSide = step(0.5, isRight);
        float visible = max(shared, mix(leftExclusive, rightExclusive, rightSide));
        vVisible = visible;
        if (visible < 0.5) {
          gl_PointSize = 0.0;
          gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
          return;
        }

        pos.x *= mix(1.0, -1.0, rightSide);
        pos.x += mix(-modelSeparation, modelSeparation, rightSide);

        float normalizedFingerSignal = clamp(handFingerSignal, 0.0, 1.0);
        float sideScale = handScale * (1.0 + normalizedFingerSignal * 0.35);
        pos = pos * (1.0 + sideScale * 0.45) + handOffset * 3.5;
        pos += normalize(pos) * bassPump * 1.8;
        vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
        float sizeRaw = 4.2 * (420.0 / -mvPos.z) * (1.0 + bassPump * 2.5 + 0.4 * sin(time * 6.0 + p1 * 30.0));
        gl_PointSize = clamp(sizeRaw, 1.2, 9.5);
        gl_Position = projectionMatrix * mvPos;
      }
    `;

    const fragmentShader = `
      uniform float bassPump;
      varying vec3 vColor;
      varying float vVisible;
      void main() {
        if (vVisible < 0.5) {
          discard;
        }
        vec2 c = gl_PointCoord - 0.5;
        float d = length(c);
        if (d > 0.5) {
          discard;
        }
        float alpha = pow(max(0.0, 1.0 - d * 2.2), 3.2);
        gl_FragColor = vec4(vColor, alpha * (0.85 + bassPump * 0.4));
      }
    `;

    const leftUniforms = this.buildParticleUniforms(0, previousLeftUniforms);
    const rightUniforms = this.buildParticleUniforms(1, previousRightUniforms);

    const leftMaterial = new THREE.ShaderMaterial({
      uniforms: leftUniforms,
      vertexShader,
      fragmentShader,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false
    });

    const rightMaterial = new THREE.ShaderMaterial({
      uniforms: rightUniforms,
      vertexShader,
      fragmentShader,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false
    });

    this.leftParticleUniforms = leftUniforms;
    this.rightParticleUniforms = rightUniforms;
    this.particleGeometry = geometry;
    this.leftParticleMaterial = leftMaterial;
    this.rightParticleMaterial = rightMaterial;
    this.leftParticles = new THREE.Points(geometry, leftMaterial);
    this.rightParticles = new THREE.Points(geometry, rightMaterial);
    this.scene.add(this.leftParticles);
    this.scene.add(this.rightParticles);
  }

  private buildStars(): void {
    if (!this.scene) {
      return;
    }

    const rng = mulberry32(this.config.seed ^ 0x9e3779b9);
    const count = 5200;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      const index3 = i * 3;
      const r = 85 + rng() * 130;
      const theta = rng() * Math.PI * 2;
      const phi = Math.acos(2 * rng() - 1);
      positions[index3] = r * Math.sin(phi) * Math.cos(theta);
      positions[index3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[index3 + 2] = r * Math.cos(phi);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      color: 0xaaddff,
      size: 0.65,
      transparent: true,
      opacity: 0.8,
      depthWrite: false
    });
    const stars = new THREE.Points(geometry, material);
    this.starGeometry = geometry;
    this.stars = stars;
    this.scene.add(stars);
  }

  private attachPointerControls(): void {
    this.config.canvas.addEventListener("pointerdown", this.onPointerDown);
    window.addEventListener("pointermove", this.onPointerMove);
    window.addEventListener("pointerup", this.onPointerUp);
    this.config.canvas.addEventListener("wheel", this.onWheel, { passive: false });
  }

  private detachPointerControls(): void {
    this.config.canvas.removeEventListener("pointerdown", this.onPointerDown);
    window.removeEventListener("pointermove", this.onPointerMove);
    window.removeEventListener("pointerup", this.onPointerUp);
    this.config.canvas.removeEventListener("wheel", this.onWheel);
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    this.isDragging = true;
    this.lastPointerX = event.clientX;
    this.lastPointerY = event.clientY;
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (!this.isDragging) {
      return;
    }

    this.targetAz -= (event.clientX - this.lastPointerX) * 0.004;
    this.targetPol -= (event.clientY - this.lastPointerY) * 0.004;
    this.targetPol = clamp(this.targetPol, 0.3, 2.8);
    this.lastPointerX = event.clientX;
    this.lastPointerY = event.clientY;
  };

  private readonly onPointerUp = (): void => {
    this.isDragging = false;
  };

  private readonly onWheel = (event: WheelEvent): void => {
    event.preventDefault();
    this.targetDist = clamp(this.targetDist + event.deltaY * 0.04, 14, 88);
  };

  private scheduleParticleRebuild(): void {
    if (this.particleRebuildTimer !== undefined) {
      window.clearTimeout(this.particleRebuildTimer);
    }

    this.particleRebuildTimer = window.setTimeout(() => {
      this.particleRebuildTimer = undefined;
      if (!this.scene || !this.leftParticleUniforms || !this.rightParticleUniforms) {
        return;
      }
      this.buildParticles();
      this.emitHud(true);
    }, 140);
  }

  private readonly tick = (now: number): void => {
    if (
      !this.running ||
      !this.camera ||
      !this.composer ||
      !this.leftParticleUniforms ||
      !this.rightParticleUniforms
    ) {
      return;
    }

    if (this.config.fixedTimeSec === undefined) {
      const frameIntervalMs = 1000 / this.targetFps;
      if (this.lastRenderTime !== 0 && now - this.lastRenderTime < frameIntervalMs) {
        this.frameRequestId = window.requestAnimationFrame(this.tick);
        return;
      }
      this.lastRenderTime = now;
    }

    const dt = this.config.fixedTimeSec === undefined ? this.clock.getDelta() : 1 / FPS_CAP_DEFAULT;

    if (this.config.fixedTimeSec !== undefined) {
      this.globalTime = this.config.fixedTimeSec;
    } else {
      this.globalTime += dt * (this.flowActive ? 1.4 : 0.7);
    }

    if (this.morphProgress < 1) {
      this.morphProgress = Math.min(1, this.morphProgress + dt / MORPH_DURATION_SEC);
    }
    this.leftParticleUniforms.morph.value = this.morphProgress;
    this.rightParticleUniforms.morph.value = this.morphProgress;
    this.leftParticleUniforms.time.value = this.globalTime;
    this.rightParticleUniforms.time.value = this.globalTime;

    this.handController.update(dt, this.globalTime);
    const leftHandOffset = this.handController.getLeftOffset();
    const rightHandOffset = this.handController.getRightOffset();
    const leftHandScale = this.handController.getLeftScale();
    const rightHandScale = this.handController.getRightScale();
    const leftFingerSignal = this.handController.getLeftFingerSignal();
    const rightFingerSignal = this.handController.getRightFingerSignal();

    this.leftCenter.set(-MODEL_SEPARATION + leftHandOffset.x, leftHandOffset.y, leftHandOffset.z);
    this.rightCenter.set(MODEL_SEPARATION + rightHandOffset.x, rightHandOffset.y, rightHandOffset.z);
    const sharedRatio = computeSharedRatio(this.leftCenter.distanceTo(this.rightCenter), SHARED_NEAR_DISTANCE, SHARED_FAR_DISTANCE);

    this.leftParticleUniforms.handOffset.value.set(leftHandOffset.x, leftHandOffset.y, leftHandOffset.z);
    this.leftParticleUniforms.handScale.value = leftHandScale;
    this.leftParticleUniforms.handFingerSignal.value = leftFingerSignal;
    this.leftParticleUniforms.sharedRatio.value = sharedRatio;

    this.rightParticleUniforms.handOffset.value.set(rightHandOffset.x, rightHandOffset.y, rightHandOffset.z);
    this.rightParticleUniforms.handScale.value = rightHandScale;
    this.rightParticleUniforms.handFingerSignal.value = rightFingerSignal;
    this.rightParticleUniforms.sharedRatio.value = sharedRatio;

    const leftHandDebug = this.handUiState.debug;
    leftHandDebug.sharedRatio = sharedRatio;
    leftHandDebug.sharedBudget = Math.round(this.particleCount * sharedRatio);

    const cameraFollow = clamp(this.cameraResponse, 0.03, 0.4);
    const cameraKeep = 1 - cameraFollow;
    this.curAz = this.curAz * cameraKeep + this.targetAz * cameraFollow;
    this.curPol = this.curPol * cameraKeep + this.targetPol * cameraFollow;
    this.curDist = this.curDist * cameraKeep + this.targetDist * cameraFollow;

    this.camera.position.x = this.curDist * Math.sin(this.curPol) * Math.cos(this.curAz);
    this.camera.position.y = this.curDist * Math.cos(this.curPol) * 0.75;
    this.camera.position.z = this.curDist * Math.sin(this.curPol) * Math.sin(this.curAz);
    this.camera.lookAt(0, 3, 0);

    const bassPump = this.mic.update(dt, this.globalTime);
    this.micLevel = bassPump;
    this.leftParticleUniforms.bassPump.value = bassPump;
    this.rightParticleUniforms.bassPump.value = bassPump;

    this.composer.render();

    this.fpsFrameCount += 1;
    if (this.config.fixedTimeSec !== undefined) {
      this.fps = this.targetFps;
    } else if (now - this.fpsSampleStart > 950) {
      this.fps = Math.round((this.fpsFrameCount * 1000) / (now - this.fpsSampleStart));
      this.fpsFrameCount = 0;
      this.fpsSampleStart = now;

      if (this.performanceMode === "auto") {
        const lowFpsThreshold = 48;
        const highFpsThreshold = 68;
        if (this.fps <= lowFpsThreshold && this.autoPerformancePreset === "high") {
          this.autoPerformancePreset = "low";
          this.applyPerformancePreset();
          this.applyParticleBudget();
        } else if (this.fps >= highFpsThreshold && this.autoPerformancePreset === "low") {
          this.autoPerformancePreset = "high";
          this.applyPerformancePreset();
          this.applyParticleBudget();
        }
      }
    }

    this.emitHud();

    if (this.config.fixedTimeSec !== undefined) {
      this.running = false;
      this.frameRequestId = undefined;
      return;
    }

    this.frameRequestId = window.requestAnimationFrame(this.tick);
  };

  private applyMicStatusOverride(status: MicStatus, wasManualStop: boolean): void {
    if (wasManualStop) {
      this.statusOverride = {
        text: "Microphone muted.",
        color: "#7fc4ff",
        until: performance.now() + 2200
      };
      return;
    }

    if (status === "active") {
      this.statusOverride = {
        text: "MIC LINK ACTIVE - Bass pump engaged.",
        color: "#0f8",
        until: performance.now() + 2200
      };
      return;
    }

    if (status === "denied") {
      this.statusOverride = {
        text: "Mic access denied.",
        color: "#ff8c7a",
        until: performance.now() + 2600
      };
      return;
    }

    if (status === "unsupported") {
      this.statusOverride = {
        text: "Microphone unavailable in this browser.",
        color: "#ffaa66",
        until: performance.now() + 2600
      };
      return;
    }

    if (status === "error") {
      this.statusOverride = {
        text: "Microphone error.",
        color: "#ffaa66",
        until: performance.now() + 2600
      };
    }
  }

  private emitHud(force = false): void {
    if (!this.config.onHudUpdate) {
      return;
    }

    const now = performance.now();
    if (!force && now - this.lastHudEmitTime < 120) {
      return;
    }
    this.lastHudEmitTime = now;

    const micStatus = this.mic.getStatus();
    const micActive = this.mic.isActive();
    const modeName = MODE_NAMES[this.targetMode];
    const micButtonText =
      micStatus === "denied"
        ? "MIC DENIED"
        : micStatus === "unsupported"
          ? "MIC UNSUPPORTED"
          : micStatus === "error"
            ? "MIC ERROR"
            : micActive
              ? "MIC ON"
              : "MIC OFF";
    const micButtonColor =
      micStatus === "denied" || micStatus === "error"
        ? "#ff8c7a"
        : micStatus === "unsupported"
          ? "#ffaa66"
          : micActive
            ? "#0f8"
            : "#00ffff";

    let statusText = this.handUiState.statusText;
    let statusColor = this.handUiState.statusColor;
    if (this.statusOverride) {
      if (performance.now() <= this.statusOverride.until) {
        statusText = this.statusOverride.text;
        statusColor = this.statusOverride.color;
      } else {
        this.statusOverride = undefined;
      }
    }

    this.config.onHudUpdate({
      particleCount: this.particleCount,
      targetFps: this.targetFps,
      fps: this.fps,
      modeName,
      modeNames: MODE_NAMES,
      title: "PARTICLE WIZARD",
      trailsText: this.trailsActive ? "ACTIVE" : "OFF",
      trailsActive: this.trailsActive,
      flowActive: this.flowActive,
      wizardActive: this.handUiState.wizardActive,
      statusText,
      statusColor,
      webcamVisible: this.handUiState.webcamVisible,
      calibrationOpacity: this.handUiState.overlayOpacity,
      micButtonText,
      micButtonColor,
      micStatus,
      micSensitivity: this.mic.getSensitivity(),
      micLevel: this.micLevel,
      handMode: this.handUiState.handMode,
      handTrackingState: this.handUiState.handTrackingState,
      handDebug: this.handUiState.debug,
      cameraDebug: {
        azimuth: this.curAz,
        polar: this.curPol,
        distance: this.curDist,
        targetAzimuth: this.targetAz,
        targetPolar: this.targetPol,
        targetDistance: this.targetDist,
        response: this.cameraResponse
      },
      visualTuning: { ...this.visualTuning },
      palette: { ...this.palette }
    });
  }
}
