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
import { clamp } from "./math";
import { MicAnalyzer, type MicStatus } from "./MicAnalyzer";

const PARTICLE_COUNT = 20_000;
const MODE_NAMES = ["SPHERICAL", "MOBIUS", "TOROIDAL", "LISSAJOUS", "FRACTAL"] as const;

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

const DEFAULT_HAND_DEBUG: HandDebugInfo = {
  palmCount: 0,
  palms: [],
  centerX: 0.5,
  centerY: 0.5,
  inCenter: false,
  calibrationTimerMs: 0,
  mappedOffset: { x: 0, y: 0, z: 0 },
  mappedScale: 0,
  staleMs: 0
};

const DEFAULT_HAND_UI_STATE: HandWizardUiState = {
  webcamVisible: true,
  overlayOpacity: 0.35,
  wizardActive: false,
  statusText: "Align both palms in center to calibrate wizard.",
  statusColor: "#00ffff",
  handMode: "none",
  handTrackingState: "loading",
  debug: DEFAULT_HAND_DEBUG
};

export type WizardHudState = {
  particleCount: number;
  fps: number;
  modeName: string;
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
  handMode: HandMode;
  handTrackingState: HandTrackingState;
  handDebug: HandDebugInfo;
  visualTuning: VisualTuning;
  palette: PaletteConfig;
};

type ParticleUniforms = {
  time: { value: number };
  currentMode: { value: number };
  targetMode: { value: number };
  morph: { value: number };
  handOffset: { value: THREE.Vector3 };
  handScale: { value: number };
  bassPump: { value: number };
  colorPrimary: { value: THREE.Vector3 };
  colorSecondary: { value: THREE.Vector3 };
  colorAccent: { value: THREE.Vector3 };
  particleGain: { value: number };
};

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
  particleCount: PARTICLE_COUNT,
  fps: 60,
  modeName: MODE_NAMES[0],
  title: `${MODE_NAMES[0]} WIZARD`,
  trailsText: "ACTIVE",
  trailsActive: true,
  flowActive: true,
  wizardActive: false,
  statusText: DEFAULT_HAND_UI_STATE.statusText,
  statusColor: DEFAULT_HAND_UI_STATE.statusColor,
  webcamVisible: true,
  calibrationOpacity: 0.35,
  micButtonText: "MIC ON",
  micButtonColor: "#00ffff",
  micStatus: "idle",
  handMode: "none",
  handTrackingState: "loading",
  handDebug: { ...DEFAULT_HAND_DEBUG },
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
  private particles?: THREE.Points;
  private stars?: THREE.Points;
  private particleGeometry?: THREE.BufferGeometry;
  private starGeometry?: THREE.BufferGeometry;
  private particleMaterial?: THREE.ShaderMaterial;

  private uniforms?: ParticleUniforms;
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
  private fps = 60;
  private fpsFrameCount = 0;
  private fpsSampleStart = performance.now();

  private curAz = 0.6;
  private curPol = 1.28;
  private curDist = 42;
  private targetAz = 0.6;
  private targetPol = 1.28;
  private targetDist = 42;
  private isDragging = false;
  private lastPointerX = 0;
  private lastPointerY = 0;

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
    if (!this.uniforms) {
      return;
    }
    this.morphProgress = 0;
    this.currentMode = this.targetMode;
    this.targetMode = (this.targetMode + 1) % MODE_NAMES.length;
    this.uniforms.currentMode.value = this.currentMode;
    this.uniforms.targetMode.value = this.targetMode;
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

  setVisualTuning(next: Partial<VisualTuning>): void {
    this.visualTuning = {
      bloomStrength: clamp(next.bloomStrength ?? this.visualTuning.bloomStrength, 0, 1.5),
      bloomRadius: clamp(next.bloomRadius ?? this.visualTuning.bloomRadius, 0, 1),
      bloomThreshold: clamp(next.bloomThreshold ?? this.visualTuning.bloomThreshold, 0, 1),
      particleGain: clamp(next.particleGain ?? this.visualTuning.particleGain, 0.4, 1.4)
    };

    if (this.bloomPass) {
      this.bloomPass.strength = this.visualTuning.bloomStrength;
      this.bloomPass.radius = this.visualTuning.bloomRadius;
      this.bloomPass.threshold = this.visualTuning.bloomThreshold;
    }

    if (this.uniforms) {
      this.uniforms.particleGain.value = this.visualTuning.particleGain;
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

    if (this.uniforms) {
      this.uniforms.colorPrimary.value.copy(toColorVector(this.palette.primary));
      this.uniforms.colorSecondary.value.copy(toColorVector(this.palette.secondary));
      this.uniforms.colorAccent.value.copy(toColorVector(this.palette.accent));
    }

    this.emitHud(true);
  }

  resetHandCalibration(): void {
    this.handController.resetCalibration();
    this.emitHud(true);
  }

  async requestMic(): Promise<MicStatus> {
    const status = await this.mic.start();

    if (status === "active") {
      this.statusOverride = {
        text: "MIC LINK ACTIVE - Bass pump engaged.",
        color: "#0f8",
        until: performance.now() + 2200
      };
    } else if (status === "denied") {
      this.statusOverride = {
        text: "Mic access denied.",
        color: "#ff8c7a",
        until: performance.now() + 2600
      };
    } else if (status === "unsupported") {
      this.statusOverride = {
        text: "Microphone unavailable in this browser.",
        color: "#ffaa66",
        until: performance.now() + 2600
      };
    }

    this.emitHud(true);
    return status;
  }

  dispose(): void {
    this.running = false;
    if (this.frameRequestId) {
      window.cancelAnimationFrame(this.frameRequestId);
      this.frameRequestId = undefined;
    }

    this.detachPointerControls();
    this.handController.dispose();
    this.mic.dispose();

    if (this.scene && this.particles) {
      this.scene.remove(this.particles);
    }
    if (this.scene && this.stars) {
      this.scene.remove(this.stars);
    }

    this.particleGeometry?.dispose();
    this.starGeometry?.dispose();
    this.particleMaterial?.dispose();
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
    this.particles = undefined;
    this.stars = undefined;
    this.particleGeometry = undefined;
    this.starGeometry = undefined;
    this.particleMaterial = undefined;
    this.uniforms = undefined;
    this.initialized = false;
  }

  private init(): void {
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x02050f, 0.008);

    const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 300);
    camera.position.set(0, 15, 42);

    const renderer = new THREE.WebGLRenderer({
      canvas: this.config.canvas,
      antialias: true
    });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
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

    const initialWidth = this.config.width ?? this.config.canvas.clientWidth ?? window.innerWidth;
    const initialHeight = this.config.height ?? this.config.canvas.clientHeight ?? window.innerHeight;
    this.resize(initialWidth, initialHeight);

    this.initialized = true;
    this.emitHud(true);
  }

  private buildParticles(): void {
    if (!this.scene) {
      return;
    }

    const rng = mulberry32(this.config.seed);
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const colors = new Float32Array(PARTICLE_COUNT * 3);
    const p1Attr = new Float32Array(PARTICLE_COUNT);
    const p2Attr = new Float32Array(PARTICLE_COUNT);

    for (let i = 0; i < PARTICLE_COUNT; i += 1) {
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
    }

    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute("p1", new THREE.BufferAttribute(p1Attr, 1));
    geometry.setAttribute("p2", new THREE.BufferAttribute(p2Attr, 1));

    const vertexShader = `
      attribute float p1;
      attribute float p2;
      attribute vec3 color;
      uniform float time;
      uniform int currentMode;
      uniform int targetMode;
      uniform float morph;
      uniform vec3 handOffset;
      uniform float handScale;
      uniform float bassPump;
      uniform vec3 colorPrimary;
      uniform vec3 colorSecondary;
      uniform vec3 colorAccent;
      uniform float particleGain;
      varying vec3 vColor;

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
        pos = pos * (1.0 + handScale * 0.45) + handOffset * 3.5;
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
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        float d = length(c);
        if (d > 0.5) {
          discard;
        }
        float alpha = pow(max(0.0, 1.0 - d * 2.2), 3.2);
        gl_FragColor = vec4(vColor, alpha * (0.85 + bassPump * 0.4));
      }
    `;

    const uniforms: ParticleUniforms = {
      time: { value: 0 },
      currentMode: { value: 0 },
      targetMode: { value: 0 },
      morph: { value: 1 },
      handOffset: { value: new THREE.Vector3(0, 0, 0) },
      handScale: { value: 0 },
      bassPump: { value: 0 },
      colorPrimary: { value: toColorVector(this.palette.primary) },
      colorSecondary: { value: toColorVector(this.palette.secondary) },
      colorAccent: { value: toColorVector(this.palette.accent) },
      particleGain: { value: this.visualTuning.particleGain }
    };

    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader,
      fragmentShader,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false
    });

    const points = new THREE.Points(geometry, material);
    this.uniforms = uniforms;
    this.particleGeometry = geometry;
    this.particleMaterial = material;
    this.particles = points;
    this.scene.add(points);
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

  private readonly tick = (now: number): void => {
    if (!this.running || !this.camera || !this.composer || !this.uniforms) {
      return;
    }

    const dt = this.config.fixedTimeSec === undefined ? this.clock.getDelta() : 1 / 60;

    if (this.config.fixedTimeSec !== undefined) {
      this.globalTime = this.config.fixedTimeSec;
    } else {
      this.globalTime += dt * (this.flowActive ? 1.4 : 0.7);
    }

    if (this.morphProgress < 1) {
      this.morphProgress = Math.min(1, this.morphProgress + dt * 2.9);
    }
    this.uniforms.morph.value = this.morphProgress;
    this.uniforms.time.value = this.globalTime;

    this.curAz = this.curAz * 0.85 + this.targetAz * 0.15;
    this.curPol = this.curPol * 0.85 + this.targetPol * 0.15;
    this.curDist = this.curDist * 0.85 + this.targetDist * 0.15;

    this.camera.position.x = this.curDist * Math.sin(this.curPol) * Math.cos(this.curAz);
    this.camera.position.y = this.curDist * Math.cos(this.curPol) * 0.75;
    this.camera.position.z = this.curDist * Math.sin(this.curPol) * Math.sin(this.curAz);
    this.camera.lookAt(0, 3, 0);

    const bassPump = this.mic.update(dt, this.globalTime);
    this.uniforms.bassPump.value = bassPump;

    this.handController.update(dt, this.globalTime);
    const handOffset = this.handController.getOffset();
    this.uniforms.handOffset.value.set(handOffset.x, handOffset.y, handOffset.z);
    this.uniforms.handScale.value = this.handController.getScale();

    this.composer.render();

    this.fpsFrameCount += 1;
    if (this.config.fixedTimeSec !== undefined) {
      this.fps = 60;
    } else if (now - this.fpsSampleStart > 950) {
      this.fps = Math.min(60, Math.round((this.fpsFrameCount * 1000) / (now - this.fpsSampleStart)));
      this.fpsFrameCount = 0;
      this.fpsSampleStart = now;
    }

    this.emitHud();

    if (this.config.fixedTimeSec !== undefined) {
      this.running = false;
      this.frameRequestId = undefined;
      return;
    }

    this.frameRequestId = window.requestAnimationFrame(this.tick);
  };

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
    const modeName = MODE_NAMES[this.targetMode];

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
      particleCount: PARTICLE_COUNT,
      fps: this.fps,
      modeName,
      title: `${modeName} WIZARD`,
      trailsText: this.trailsActive ? "ACTIVE" : "OFF",
      trailsActive: this.trailsActive,
      flowActive: this.flowActive,
      wizardActive: this.handUiState.wizardActive,
      statusText,
      statusColor,
      webcamVisible: this.handUiState.webcamVisible,
      calibrationOpacity: this.handUiState.overlayOpacity,
      micButtonText: micStatus === "denied" ? "MIC DENIED" : "MIC ON",
      micButtonColor: micStatus === "active" ? "#0f8" : "#00ffff",
      micStatus,
      handMode: this.handUiState.handMode,
      handTrackingState: this.handUiState.handTrackingState,
      handDebug: this.handUiState.debug,
      visualTuning: { ...this.visualTuning },
      palette: { ...this.palette }
    });
  }
}
