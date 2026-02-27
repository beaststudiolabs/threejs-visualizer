const MEDIAPIPE_SCRIPTS = [
  "https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js",
  "https://cdn.jsdelivr.net/npm/@mediapipe/control_utils/control_utils.js",
  "https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js",
  "https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4/hands.js"
] as const;

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

export interface LegacyHandsInstance {
  setOptions: (options: {
    maxNumHands: number;
    modelComplexity: number;
    minDetectionConfidence: number;
    minTrackingConfidence: number;
  }) => void;
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

type LegacyMediaPipeGlobal = {
  Hands?: LegacyHandsConstructor;
  Camera?: LegacyCameraConstructor;
};

declare global {
  interface Window {
    Hands?: LegacyHandsConstructor;
    Camera?: LegacyCameraConstructor;
  }
}

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

export const loadLegacyMediaPipe = async (): Promise<{
  Hands: LegacyHandsConstructor;
  Camera: LegacyCameraConstructor;
} | null> => {
  try {
    for (const script of MEDIAPIPE_SCRIPTS) {
      await loadScriptOnce(script);
    }
  } catch {
    return null;
  }

  const globalApi = window as Window & LegacyMediaPipeGlobal;
  const Hands = globalApi.Hands;
  const Camera = globalApi.Camera;

  if (!Hands || !Camera) {
    return null;
  }

  return { Hands, Camera };
};
