import * as THREE from "three";
import { AfterimagePass } from "three/examples/jsm/postprocessing/AfterimagePass.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { mulberry32 } from "../utils/rng";
import {
  HandWizardController,
  type CameraState,
  type HandControlProfile,
  type HandDebugInfo,
  type HandMode,
  type HandTrackingState,
  type TrackingStateDetail,
  type HandWizardUiState
} from "./HandWizardController";
import { clamp, computeSharedRatio, createZeroFingerCurls, type FingerCurls } from "./math";
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
  "WAVE KNOT",
  "PARTICLE HANDS"
] as const;
const MODE_NAMES = WIZARD_MODE_NAMES;
const PARTICLE_HANDS_MODE_INDEX = MODE_NAMES.length - 1;
const PARTICLE_HANDS_PALM_SHARE = 0.46;
const PARTICLE_HANDS_THUMB_START = PARTICLE_HANDS_PALM_SHARE;
const PARTICLE_HANDS_THUMB_END = 0.56;
const PARTICLE_HANDS_INDEX_END = 0.67;
const PARTICLE_HANDS_MIDDLE_END = 0.78;
const PARTICLE_HANDS_RING_END = 0.89;
// Tune these constants for the high-level look of mode 10.
const PARTICLE_HANDS_PALM_JITTER = 0.06;
const PARTICLE_HANDS_PALM_RINGS = 0.48;
const PARTICLE_HANDS_FINGER_TWIST = 0.6;
const PARTICLE_HANDS_FINGER_NOISE = 0.06;
const PARTICLE_HANDS_FLOAT_LIFT = 0.16;
const PARTICLE_HANDS_FLOAT_ORBIT = 0.24;
const PARTICLE_HANDS_FLOAT_NOISE = 0.06;
const PARTICLE_HANDS_FLOAT_RADIAL = 0.22;
const PARTICLE_HANDS_BASE_ROT_X = -0.22;
const PARTICLE_HANDS_BASE_ROT_Y = 0.0;
const PARTICLE_HANDS_BASE_ROT_Z = 0.0;

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
  leftGestureReady: false,
  rightGestureReady: false,
  leftCalibrationReady: false,
  rightCalibrationReady: false,
  calibrationTimerMs: 0,
  mappedOffset: { x: 0, y: 0, z: 0 },
  mappedScale: 0,
  mappedOffsetLeft: { x: 0, y: 0, z: 0 },
  mappedScaleLeft: 0,
  mappedOffsetRight: { x: 0, y: 0, z: 0 },
  mappedScaleRight: 0,
  mappedFingerLeft: 0,
  mappedFingerRight: 0,
  mappedFingerCurlsLeft: createZeroFingerCurls(),
  mappedFingerCurlsRight: createZeroFingerCurls(),
  mappedRotation: { x: 0, y: 0, z: 0 },
  mappedRotationLeft: { x: 0, y: 0, z: 0 },
  mappedRotationRight: { x: 0, y: 0, z: 0 },
  dualStickyActive: false,
  stickyMissingRole: undefined,
  singleRole: undefined,
  staleMs: 0
};

const DEFAULT_HAND_UI_STATE: HandWizardUiState = {
  webcamVisible: true,
  overlayOpacity: 0.35,
  wizardActive: false,
  statusText: "Align two fists (palms facing you) with the outlines to calibrate wizard.",
  statusColor: "#00ffff",
  cameraState: "active",
  trackingStateDetail: undefined,
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
  backgroundStarsEnabled: boolean;
  backgroundColor: string;
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
  cameraState: CameraState;
  trackingStateDetail?: TrackingStateDetail;
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
  handRotation: { value: THREE.Vector3 };
  handScale: { value: number };
  handFingerSignal: { value: number };
  handFingerCurlsA: { value: THREE.Vector4 };
  handFingerCurlB: { value: number };
  handPresence: { value: number };
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
  trackerMode: "default" | "off" | "mockfail" | "remote" | "local";
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

const setFingerVectorA = (target: THREE.Vector4, curls: FingerCurls): void => {
  target.set(curls.thumb, curls.index, curls.middle, curls.ring);
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
  backgroundStarsEnabled: true,
  backgroundColor: "#000000",
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
  cameraState: "active",
  trackingStateDetail: undefined,
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
  private backgroundStarsEnabled = true;
  private backgroundColor = "#000000";
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
  private leftPresence = 1;
  private rightPresence = 1;
  private readonly leftCenter = new THREE.Vector3();
  private readonly rightCenter = new THREE.Vector3();

  private statusOverride?: StatusOverride;
  private lastHudEmitTime = 0;

  constructor(config: ParticleWizardRuntimeConfig) {
    this.config = config;
    this.mic = new MicAnalyzer(config.testMode);
    this.handController = new HandWizardController({
      testMode: config.testMode,
      trackerMode: config.trackerMode,
      video: config.video,
      onStateChange: (state) => {
        this.handUiState = state;
        this.emitHud(true);
      }
    });
    this.handUiState = this.handController.getUiState();
  }

  private resolveHandControlProfile(): HandControlProfile {
    const transitioning = this.morphProgress < 0.999;
    const handsModeActive = transitioning
      ? this.currentMode === PARTICLE_HANDS_MODE_INDEX || this.targetMode === PARTICLE_HANDS_MODE_INDEX
      : this.targetMode === PARTICLE_HANDS_MODE_INDEX;
    return handsModeActive ? "instant_dual" : "calibrated";
  }

  private syncHandControlProfile(): void {
    this.handController.setControlProfile(this.resolveHandControlProfile());
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
    this.syncHandControlProfile();
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
    this.syncHandControlProfile();
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
    this.syncHandControlProfile();
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

  toggleBackgroundStars(): void {
    this.backgroundStarsEnabled = !this.backgroundStarsEnabled;
    this.applyBackgroundState();
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

  setBackgroundColor(next: string): void {
    const normalized = next.trim().toLowerCase();
    if (!/^#[0-9a-f]{6}$/.test(normalized) || normalized === this.backgroundColor) {
      return;
    }

    this.backgroundColor = normalized;
    this.applyBackgroundState();
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
    this.leftPresence = 1;
    this.rightPresence = 1;

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
    this.applyBackgroundState();
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
      handRotation: { value: previous?.handRotation.value ? previous.handRotation.value.clone() : new THREE.Vector3(0, 0, 0) },
      handScale: { value: previous?.handScale.value ?? 0 },
      handFingerSignal: { value: previous?.handFingerSignal.value ?? 0 },
      handFingerCurlsA: {
        value: previous?.handFingerCurlsA.value ? previous.handFingerCurlsA.value.clone() : new THREE.Vector4(0, 0, 0, 0)
      },
      handFingerCurlB: { value: previous?.handFingerCurlB.value ?? 0 },
      handPresence: { value: previous?.handPresence.value ?? 1 },
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
      uniform vec3 handRotation;
      uniform float handScale;
      uniform float handFingerSignal;
      uniform vec4 handFingerCurlsA;
      uniform float handFingerCurlB;
      uniform float handPresence;
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
      varying float vAlphaGain;

      float superFormula(float angle, float m, float n1, float n2, float n3, float a, float b) {
        float c = pow(abs(cos(m * angle * 0.25) / a), n2);
        float s = pow(abs(sin(m * angle * 0.25) / b), n3);
        float value = pow(c + s, -1.0 / n1);
        return clamp(value, 0.0, 3.0);
      }

      vec3 rotateX3(vec3 v, float angle) {
        float c = cos(angle);
        float s = sin(angle);
        return vec3(v.x, v.y * c - v.z * s, v.y * s + v.z * c);
      }

      vec3 rotateY3(vec3 v, float angle) {
        float c = cos(angle);
        float s = sin(angle);
        return vec3(v.x * c + v.z * s, v.y, -v.x * s + v.z * c);
      }

      vec3 rotateZ3(vec3 v, float angle) {
        float c = cos(angle);
        float s = sin(angle);
        return vec3(v.x * c - v.y * s, v.x * s + v.y * c, v.z);
      }

      vec3 rotateXYZ(vec3 v, vec3 euler) {
        vec3 xRot = rotateX3(v, euler.x);
        vec3 yRot = rotateY3(xRot, euler.y);
        return rotateZ3(yRot, euler.z);
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
        } else if (mode == ${PARTICLE_HANDS_MODE_INDEX}) {
          float palmShare = ${PARTICLE_HANDS_PALM_SHARE};
          if (a < palmShare) {
            float localPalm = clamp(a / palmShare, 0.0, 1.0);
            float thetaPalm = b * 6.28318 + t * 0.38;
            float palmWidth = mix(2.9, 4.15, pow(localPalm, 0.8));
            float wristTaper = pow(1.0 - localPalm, 1.75);
            float palmSignal = clamp(handFingerSignal, 0.0, 1.0);
            float handLift = mix(-1.2, 1.35, localPalm);

            p.x = cos(thetaPalm) * palmWidth;
            p.y = sin(thetaPalm) * 1.05 * (0.78 + 0.22 * localPalm) + handLift;
            p.z = (0.62 - localPalm) * 3.5 + cos(thetaPalm * 1.6 + t * 0.8) * ${PARTICLE_HANDS_PALM_RINGS};
            p.x *= 0.75 + wristTaper * 0.25;
            p.y *= 1.12 - 0.12 * wristTaper;
            p.z *= 0.7 + 0.25 * (1.0 - localPalm);
            p.x += sin(thetaPalm * 2.0 + t * 0.9 + localPalm * 4.0) * (0.07 + palmSignal * 0.06);
            p.y += cos(thetaPalm * 2.1 + t * 1.1) * (0.05 + palmSignal * 0.04);
            p.z += sin(t * 1.2 + localPalm * 9.0) * 0.06;
          } else {
            float fingerIndex = 0.0;
            float segStart = ${PARTICLE_HANDS_THUMB_START};
            float segEnd = ${PARTICLE_HANDS_THUMB_END};

            if (a >= ${PARTICLE_HANDS_THUMB_END} && a < ${PARTICLE_HANDS_INDEX_END}) {
              fingerIndex = 1.0;
              segStart = ${PARTICLE_HANDS_THUMB_END};
              segEnd = ${PARTICLE_HANDS_INDEX_END};
            } else if (a >= ${PARTICLE_HANDS_INDEX_END} && a < ${PARTICLE_HANDS_MIDDLE_END}) {
              fingerIndex = 2.0;
              segStart = ${PARTICLE_HANDS_INDEX_END};
              segEnd = ${PARTICLE_HANDS_MIDDLE_END};
            } else if (a >= ${PARTICLE_HANDS_MIDDLE_END} && a < ${PARTICLE_HANDS_RING_END}) {
              fingerIndex = 3.0;
              segStart = ${PARTICLE_HANDS_MIDDLE_END};
              segEnd = ${PARTICLE_HANDS_RING_END};
            } else if (a >= ${PARTICLE_HANDS_RING_END}) {
              fingerIndex = 4.0;
              segStart = ${PARTICLE_HANDS_RING_END};
              segEnd = 1.0;
            }

            float localFinger = clamp((a - segStart) / max(0.0001, segEnd - segStart), 0.0, 1.0);
            float fingerCurl = handFingerCurlsA.x;
            if (fingerIndex > 0.5 && fingerIndex < 1.5) {
              fingerCurl = handFingerCurlsA.y;
            } else if (fingerIndex > 1.5 && fingerIndex < 2.5) {
              fingerCurl = handFingerCurlsA.z;
            } else if (fingerIndex > 2.5 && fingerIndex < 3.5) {
              fingerCurl = handFingerCurlsA.w;
            } else if (fingerIndex > 3.5) {
              fingerCurl = handFingerCurlB;
            }

            float baseX = -3.15;
            float baseY = -0.38;
            float baseZ = 0.72;
            float phalanx1 = 2.05;
            float phalanx2 = 1.85;
            float phalanx3 = 1.35;
            float radiusBase = 0.88;
            if (fingerIndex > 0.5 && fingerIndex < 1.5) {
              baseX = -1.25;
              baseY = 0.84;
              baseZ = 1.15;
              phalanx1 = 2.45;
              phalanx2 = 2.0;
              phalanx3 = 1.45;
              radiusBase = 0.76;
            } else if (fingerIndex > 1.5 && fingerIndex < 2.5) {
              baseX = 0.42;
              baseY = 1.02;
              baseZ = 1.35;
              phalanx1 = 2.65;
              phalanx2 = 2.15;
              phalanx3 = 1.65;
              radiusBase = 0.79;
            } else if (fingerIndex > 2.5 && fingerIndex < 3.5) {
              baseX = 1.68;
              baseY = 1.0;
              baseZ = 1.08;
              phalanx1 = 2.52;
              phalanx2 = 2.05;
              phalanx3 = 1.58;
              radiusBase = 0.74;
            } else if (fingerIndex > 3.5) {
              baseX = 3.0;
              baseY = 0.64;
              baseZ = 0.85;
              phalanx1 = 2.25;
              phalanx2 = 1.85;
              phalanx3 = 1.4;
              radiusBase = 0.68;
            }

            float segment1 = clamp(localFinger * 3.0, 0.0, 1.0);
            float segment2 = clamp((localFinger - 0.333) * 1.8, 0.0, 1.0);
            float segment3 = clamp((localFinger - 0.666) * 3.0, 0.0, 1.0);
            float curl = clamp(fingerCurl, 0.0, 1.0);
            float curlEase = sqrt(curl);
            float fingerYaw = fingerIndex < 0.5 ? -0.74 : 0.0;
            float phalanxPitchBase = (fingerIndex < 0.5) ? 0.42 : 0.55;
            float phalanxPitchMid = phalanxPitchBase + curlEase * 1.05;
            float phalanxPitchTip = phalanxPitchBase + 1.08 + curlEase * 1.45;

            vec3 bone1 = vec3(
              cos(fingerYaw) * cos(phalanxPitchBase),
              sin(phalanxPitchBase),
              sin(fingerYaw) * cos(phalanxPitchBase)
            );
            vec3 bone2 = vec3(
              cos(fingerYaw) * cos(phalanxPitchMid),
              sin(phalanxPitchMid),
              sin(fingerYaw) * cos(phalanxPitchMid)
            );
            vec3 bone3 = vec3(
              cos(fingerYaw) * cos(phalanxPitchTip),
              sin(phalanxPitchTip),
              sin(fingerYaw) * cos(phalanxPitchTip)
            );
            vec3 fingerCore = bone1 * (phalanx1 * segment1) + bone2 * (phalanx2 * segment2) + bone3 * (phalanx3 * segment3);

            float ring = b * 6.28318 + localFinger * 7.0 + curl * ${PARTICLE_HANDS_FINGER_TWIST};
            float radius = radiusBase * (1.0 - 0.58 * localFinger);
            float phalanxTaper = 0.58 + 0.42 * (1.0 - localFinger);
            p.x = baseX + fingerCore.x + cos(ring) * radius * 0.75;
            p.y = baseY + fingerCore.y + sin(ring) * radius * 1.35 * phalanxTaper;
            p.z = baseZ + fingerCore.z + cos(ring + localFinger * 2.0) * radius * 0.9 * phalanxTaper;

            float detailNoise = ${PARTICLE_HANDS_FINGER_NOISE} * sin(t * 6.0 + a * 74.0 + b * 45.0);
            p += vec3(
              detailNoise * cos(ring),
              detailNoise * sin(ring * 1.8),
              detailNoise * cos(ring * 0.8)
            );
          }
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

        float handsModeMix = (currentMode == ${PARTICLE_HANDS_MODE_INDEX} || targetMode == ${PARTICLE_HANDS_MODE_INDEX})
          ? 1.0
          : 0.0;
        float presence = clamp(handPresence, 0.0, 1.0);
        float motionPresence = mix(1.0, presence, handsModeMix);
        vAlphaGain = mix(1.0, 0.22 + 0.78 * presence, handsModeMix);

        pos.x *= mix(1.0, -1.0, rightSide);
        vec3 handsBaseRotation = vec3(${PARTICLE_HANDS_BASE_ROT_X}, ${PARTICLE_HANDS_BASE_ROT_Y}, ${PARTICLE_HANDS_BASE_ROT_Z});
        pos = rotateXYZ(pos, handRotation + handsBaseRotation * handsModeMix);
        pos.x += mix(-modelSeparation, modelSeparation, rightSide);

        float normalizedFingerSignal = clamp(handFingerSignal, 0.0, 1.0);
        float sideScale = handScale * (1.0 + normalizedFingerSignal * 0.35);
        float shapeScale = mix(1.0 + sideScale * 0.45 * motionPresence, 1.0 + sideScale * 0.24 * motionPresence, handsModeMix);
        pos = pos * shapeScale;
        pos += handOffset * mix(3.5, 2.9, handsModeMix) * motionPresence;

        float floatPhase = time * 0.9 + p1 * 12.0 + p2 * 6.0 + rightSide * 0.45;
        float floatLift = sin(floatPhase) * (${PARTICLE_HANDS_FLOAT_LIFT} + 0.12 * clamp(handScale, -1.0, 1.0) + ${PARTICLE_HANDS_PALM_JITTER} * normalizedFingerSignal);
        float floatOrbit = cos(floatPhase * 0.8) * (${PARTICLE_HANDS_FLOAT_ORBIT} + 0.08 * normalizedFingerSignal);
        float floatNoise = ${PARTICLE_HANDS_FLOAT_NOISE} * cos(floatPhase * 1.1 + p2 * 8.0);
        float radialPulse = (normalizedFingerSignal - 0.5) * (${PARTICLE_HANDS_FLOAT_RADIAL} + 0.14 * clamp(handScale, -1.0, 1.0));
        vec2 floatDir = pos.xz + vec2(0.001, 0.001);
        float floatRadius = max(0.0001, length(floatDir));
        pos.x += floatLift * 0.6 * handsModeMix * motionPresence;
        pos.y += floatOrbit * 0.35 * handsModeMix * motionPresence;
        pos.z += floatNoise * 0.42 * handsModeMix * motionPresence;
        pos.x += (floatDir.x / floatRadius) * radialPulse * 0.7 * handsModeMix * motionPresence;
        pos.z += (floatDir.y / floatRadius) * radialPulse * 0.7 * handsModeMix * motionPresence;
        pos += normalize(pos + vec3(0.001)) * bassPump * (1.8 * mix(1.0, 0.4 + 0.6 * presence, handsModeMix));
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
      varying float vAlphaGain;
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
        gl_FragColor = vec4(vColor, alpha * (0.85 + bassPump * 0.4) * vAlphaGain);
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

  private applyBackgroundState(): void {
    if (!this.renderer) {
      return;
    }

    const clearColor = this.backgroundStarsEnabled ? this.backgroundColor : "#000000";
    this.renderer.setClearColor(clearColor, 1);
    if (this.stars) {
      this.stars.visible = this.backgroundStarsEnabled;
    }
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

    this.syncHandControlProfile();
    this.handController.update(dt, this.globalTime);
    this.handUiState = this.handController.getUiState();
    const leftHandOffset = this.handController.getLeftOffset();
    const rightHandOffset = this.handController.getRightOffset();
    const leftHandScale = this.handController.getLeftScale();
    const rightHandScale = this.handController.getRightScale();
    const leftHandRotation = this.handController.getLeftRotation();
    const rightHandRotation = this.handController.getRightRotation();
    const leftFingerSignal = this.handController.getLeftFingerSignal();
    const rightFingerSignal = this.handController.getRightFingerSignal();
    const leftFingerCurls = this.handController.getLeftFingerCurls();
    const rightFingerCurls = this.handController.getRightFingerCurls();
    const singleRole = this.handController.getSingleRole();

    this.leftCenter.set(-MODEL_SEPARATION + leftHandOffset.x, leftHandOffset.y, leftHandOffset.z);
    this.rightCenter.set(MODEL_SEPARATION + rightHandOffset.x, rightHandOffset.y, rightHandOffset.z);
    const sharedRatio = computeSharedRatio(this.leftCenter.distanceTo(this.rightCenter), SHARED_NEAR_DISTANCE, SHARED_FAR_DISTANCE);

    this.leftParticleUniforms.handOffset.value.set(leftHandOffset.x, leftHandOffset.y, leftHandOffset.z);
    this.leftParticleUniforms.handRotation.value.set(leftHandRotation.x, leftHandRotation.y, leftHandRotation.z);
    this.leftParticleUniforms.handScale.value = leftHandScale;
    this.leftParticleUniforms.handFingerSignal.value = leftFingerSignal;
    setFingerVectorA(this.leftParticleUniforms.handFingerCurlsA.value, leftFingerCurls);
    this.leftParticleUniforms.handFingerCurlB.value = leftFingerCurls.pinky;
    this.leftParticleUniforms.sharedRatio.value = sharedRatio;

    this.rightParticleUniforms.handOffset.value.set(rightHandOffset.x, rightHandOffset.y, rightHandOffset.z);
    this.rightParticleUniforms.handRotation.value.set(rightHandRotation.x, rightHandRotation.y, rightHandRotation.z);
    this.rightParticleUniforms.handScale.value = rightHandScale;
    this.rightParticleUniforms.handFingerSignal.value = rightFingerSignal;
    setFingerVectorA(this.rightParticleUniforms.handFingerCurlsA.value, rightFingerCurls);
    this.rightParticleUniforms.handFingerCurlB.value = rightFingerCurls.pinky;
    this.rightParticleUniforms.sharedRatio.value = sharedRatio;

    const handsModeActive =
      this.currentMode === PARTICLE_HANDS_MODE_INDEX || this.targetMode === PARTICLE_HANDS_MODE_INDEX;
    let leftPresenceTarget = 1;
    let rightPresenceTarget = 1;
    if (handsModeActive) {
      const activeHands = this.handUiState.handTrackingState === "active";
      if (activeHands && this.handUiState.handMode === "dual") {
        leftPresenceTarget = 1;
        rightPresenceTarget = 1;
      } else if (activeHands && this.handUiState.handMode === "single") {
        leftPresenceTarget = singleRole === "left" ? 1 : 0;
        rightPresenceTarget = singleRole === "right" ? 1 : 0;
      } else {
        leftPresenceTarget = 0;
        rightPresenceTarget = 0;
      }
      this.leftPresence = this.leftPresence * 0.92 + leftPresenceTarget * 0.08;
      this.rightPresence = this.rightPresence * 0.92 + rightPresenceTarget * 0.08;
    } else {
      this.leftPresence = 1;
      this.rightPresence = 1;
    }

    this.leftParticleUniforms.handPresence.value = this.leftPresence;
    this.rightParticleUniforms.handPresence.value = this.rightPresence;

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
      backgroundStarsEnabled: this.backgroundStarsEnabled,
      backgroundColor: this.backgroundColor,
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
      cameraState: this.handUiState.cameraState,
      trackingStateDetail: this.handUiState.trackingStateDetail,
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
