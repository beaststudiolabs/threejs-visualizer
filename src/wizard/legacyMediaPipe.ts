const VISION_BUNDLE_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.js";
const VISION_WASM_ROOT = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";
const HAND_LANDMARKER_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

const scriptLoadCache = new Map<string, Promise<void>>();

export type LegacyLandmark = {
  x: number;
  y: number;
  z: number;
};

export type LegacyHandsResults = {
  multiHandLandmarks?: LegacyLandmark[][];
  multiHandedness?: Array<{ label: string }>;
};

type LegacyHandOptions = {
  maxNumHands: number;
  modelComplexity: number;
  minDetectionConfidence: number;
  minTrackingConfidence: number;
};

export interface LegacyHandsInstance {
  setOptions: (options: LegacyHandOptions) => void;
  onResults: (callback: (results: LegacyHandsResults) => void) => void;
  send: (payload: { image: HTMLVideoElement }) => Promise<void>;
}

export interface LegacyCameraInstance {
  start: () => Promise<void> | void;
  stop?: () => void;
}

export type LegacyHandsConstructor = new (config: {
  locateFile: (file: string) => string;
}) => LegacyHandsInstance;

export type LegacyCameraConstructor = new (
  video: HTMLVideoElement,
  config: { onFrame: () => Promise<void>; width: number; height: number }
) => LegacyCameraInstance;

type HandednessCategory = {
  categoryName?: string;
  displayName?: string;
  score?: number;
};

type TasksResult = {
  landmarks?: LegacyLandmark[][];
  handedness?: HandednessCategory[][];
};

type TasksOptions = {
  baseOptions: {
    modelAssetPath: string;
    delegate?: "GPU" | "CPU";
  };
  runningMode: "VIDEO";
  numHands: number;
  minHandDetectionConfidence: number;
  minHandPresenceConfidence: number;
  minTrackingConfidence: number;
};

interface TasksHandLandmarker {
  detectForVideo: (video: HTMLVideoElement, timestampMs: number) => TasksResult;
  setOptions?: (options: Partial<TasksOptions>) => Promise<void> | void;
  close?: () => void;
}

type TasksVisionApi = {
  FilesetResolver: {
    forVisionTasks: (basePath: string) => Promise<unknown>;
  };
  HandLandmarker: {
    createFromOptions: (vision: unknown, options: TasksOptions) => Promise<TasksHandLandmarker>;
  };
};

declare global {
  interface Window {
    vision?: TasksVisionApi;
  }
}

const DEFAULT_HAND_OPTIONS: LegacyHandOptions = {
  maxNumHands: 2,
  modelComplexity: 1,
  minDetectionConfidence: 0.55,
  minTrackingConfidence: 0.5
};

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

const toTasksOptions = (options: LegacyHandOptions, delegate: "GPU" | "CPU"): TasksOptions => ({
  baseOptions: {
    modelAssetPath: HAND_LANDMARKER_MODEL_URL,
    delegate
  },
  runningMode: "VIDEO",
  numHands: clamp(Math.round(options.maxNumHands), 1, 2),
  minHandDetectionConfidence: clamp(options.minDetectionConfidence, 0, 1),
  minHandPresenceConfidence: clamp(options.minDetectionConfidence, 0, 1),
  minTrackingConfidence: clamp(options.minTrackingConfidence, 0, 1)
});

const normalizeLabel = (categories: HandednessCategory[] | undefined): string | undefined => {
  const first = categories?.[0];
  if (!first) {
    return undefined;
  }
  const raw = (first.categoryName ?? first.displayName ?? "").toLowerCase();
  if (raw.includes("left")) {
    return "Left";
  }
  if (raw.includes("right")) {
    return "Right";
  }
  return undefined;
};

const mapTasksResults = (results: TasksResult): LegacyHandsResults => {
  const multiHandLandmarks = results.landmarks?.map((hand) =>
    hand.map((landmark) => ({
      x: landmark.x,
      y: landmark.y,
      z: landmark.z
    }))
  );

  const multiHandedness = results.handedness
    ?.map((categories) => normalizeLabel(categories))
    .filter((label): label is string => Boolean(label))
    .map((label) => ({ label }));

  return {
    multiHandLandmarks,
    multiHandedness
  };
};

const loadScriptOnce = (src: string): Promise<void> => {
  const cached = scriptLoadCache.get(src);
  if (cached) {
    return cached;
  }

  const promise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[data-src="${src}"]`);
    if (existing) {
      if (existing.dataset.loaded === "1") {
        resolve();
      } else {
        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener("error", () => reject(new Error(`Failed loading ${src}`)), { once: true });
      }
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.crossOrigin = "anonymous";
    script.dataset.src = src;
    script.addEventListener(
      "load",
      () => {
        script.dataset.loaded = "1";
        resolve();
      },
      { once: true }
    );
    script.addEventListener("error", () => reject(new Error(`Failed loading ${src}`)), { once: true });
    document.head.appendChild(script);
  });

  scriptLoadCache.set(src, promise);
  return promise;
};

const loadTasksVisionApi = async (): Promise<TasksVisionApi | null> => {
  try {
    await loadScriptOnce(VISION_BUNDLE_URL);
  } catch {
    return null;
  }

  const api = window.vision;
  if (!api?.FilesetResolver || !api.HandLandmarker) {
    return null;
  }

  return api;
};

class TasksHandsAdapter implements LegacyHandsInstance {
  private onResultsCallback?: (results: LegacyHandsResults) => void;
  private options: LegacyHandOptions = { ...DEFAULT_HAND_OPTIONS };
  private landmarker: TasksHandLandmarker | null = null;
  private landmarkerPromise?: Promise<TasksHandLandmarker | null>;

  constructor(_config: { locateFile: (file: string) => string }) {
    void _config;
  }

  setOptions(options: LegacyHandOptions): void {
    this.options = {
      maxNumHands: options.maxNumHands,
      modelComplexity: options.modelComplexity,
      minDetectionConfidence: options.minDetectionConfidence,
      minTrackingConfidence: options.minTrackingConfidence
    };

    if (!this.landmarker) {
      return;
    }

    void this.landmarker.setOptions?.({
      numHands: clamp(Math.round(options.maxNumHands), 1, 2),
      minHandDetectionConfidence: clamp(options.minDetectionConfidence, 0, 1),
      minHandPresenceConfidence: clamp(options.minDetectionConfidence, 0, 1),
      minTrackingConfidence: clamp(options.minTrackingConfidence, 0, 1)
    });
  }

  onResults(callback: (results: LegacyHandsResults) => void): void {
    this.onResultsCallback = callback;
  }

  async send(payload: { image: HTMLVideoElement }): Promise<void> {
    const landmarker = await this.ensureLandmarker();
    if (!landmarker || !this.onResultsCallback) {
      return;
    }

    const video = payload.image;
    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      return;
    }

    const results = landmarker.detectForVideo(video, performance.now());
    this.onResultsCallback(mapTasksResults(results));
  }

  private async ensureLandmarker(): Promise<TasksHandLandmarker | null> {
    if (this.landmarker) {
      return this.landmarker;
    }

    if (!this.landmarkerPromise) {
      this.landmarkerPromise = this.createLandmarker();
    }

    this.landmarker = await this.landmarkerPromise;
    return this.landmarker;
  }

  private async createLandmarker(): Promise<TasksHandLandmarker | null> {
    const api = await loadTasksVisionApi();
    if (!api) {
      return null;
    }

    const vision = await api.FilesetResolver.forVisionTasks(VISION_WASM_ROOT);
    const highPerfOptions = toTasksOptions(this.options, "GPU");

    try {
      return await api.HandLandmarker.createFromOptions(vision, highPerfOptions);
    } catch {
      const cpuOptions = toTasksOptions(this.options, "CPU");
      return api.HandLandmarker.createFromOptions(vision, cpuOptions);
    }
  }
}

class TasksCameraAdapter implements LegacyCameraInstance {
  private readonly onFrame: () => Promise<void>;
  private running = false;
  private frameRequestId?: number;
  private framePending = false;

  constructor(_video: HTMLVideoElement, config: { onFrame: () => Promise<void>; width: number; height: number }) {
    void _video;
    void config.width;
    void config.height;
    this.onFrame = config.onFrame;
  }

  start(): void {
    if (this.running) {
      return;
    }
    this.running = true;
    this.schedule();
  }

  stop(): void {
    this.running = false;
    if (this.frameRequestId !== undefined) {
      window.cancelAnimationFrame(this.frameRequestId);
      this.frameRequestId = undefined;
    }
  }

  private schedule(): void {
    if (!this.running) {
      return;
    }
    this.frameRequestId = window.requestAnimationFrame(() => {
      if (!this.running) {
        return;
      }
      if (!this.framePending) {
        this.framePending = true;
        void this.onFrame().finally(() => {
          this.framePending = false;
        });
      }
      this.schedule();
    });
  }
}

export const loadLegacyMediaPipe = async (): Promise<{
  Hands: LegacyHandsConstructor;
  Camera: LegacyCameraConstructor;
} | null> => {
  const api = await loadTasksVisionApi();
  if (!api) {
    return null;
  }
  void api;

  return {
    Hands: TasksHandsAdapter as unknown as LegacyHandsConstructor,
    Camera: TasksCameraAdapter as unknown as LegacyCameraConstructor
  };
};
