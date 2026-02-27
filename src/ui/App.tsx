import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent
} from "react";
import {
  createInitialHudState,
  DEFAULT_PALETTE,
  FPS_CAP_DEFAULT,
  FPS_CAP_MAX,
  FPS_CAP_MIN,
  PARTICLE_COUNT_DEFAULT,
  PARTICLE_COUNT_MAX,
  PARTICLE_COUNT_MIN,
  ParticleWizardRuntime,
  type PaletteConfig,
  type VisualTuning,
  type WizardHudState
} from "../wizard/ParticleWizardRuntime";
import { parseWizardQuery } from "../wizard/query";

const MIC_LONG_PRESS_MS = 325;

type LandmarkPoint = {
  x: number;
  y: number;
  z: number;
};

const HAND_STICK_CONNECTIONS: Array<[number, number]> = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [0, 5],
  [5, 6],
  [6, 7],
  [7, 8],
  [0, 9],
  [9, 10],
  [10, 11],
  [11, 12],
  [0, 13],
  [13, 14],
  [14, 15],
  [15, 16],
  [0, 17],
  [17, 18],
  [18, 19],
  [19, 20]
];

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

const toDisplayCoordinate = (rawX: number, rawY: number): [string, string] => [
  `${clamp01(1 - rawX) * 100}%`,
  `${clamp01(rawY) * 100}%`
];

type PaletteKey = "primary" | "secondary" | "accent";

const paletteEquals = (a: PaletteConfig, b: PaletteConfig): boolean =>
  a.primary === b.primary &&
  a.secondary === b.secondary &&
  a.accent === b.accent &&
  (a.presetId ?? "") === (b.presetId ?? "");

const buildVisualQueryDefaults = (query: ReturnType<typeof parseWizardQuery>): Partial<VisualTuning> => {
  const next: Partial<VisualTuning> = {};
  if (typeof query.glow === "number") {
    next.bloomStrength = query.glow;
  }
  if (typeof query.threshold === "number") {
    next.bloomThreshold = query.threshold;
  }
  if (typeof query.gain === "number") {
    next.particleGain = query.gain;
  }
  return next;
};

const buildPaletteQueryDefaults = (
  query: ReturnType<typeof parseWizardQuery>,
  current: PaletteConfig
): PaletteConfig | undefined => {
  const next: PaletteConfig = {
    ...current,
    presetId: "query"
  };
  let changed = false;

  if (query.primary) {
    next.primary = query.primary;
    changed = true;
  }
  if (query.secondary) {
    next.secondary = query.secondary;
    changed = true;
  }
  if (query.accent) {
    next.accent = query.accent;
    changed = true;
  }

  return changed ? next : undefined;
};

export const App = (): JSX.Element => {
  const query = useMemo(() => parseWizardQuery(), []);

  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const runtimeRef = useRef<ParticleWizardRuntime | undefined>(undefined);
  const micHoldTimerRef = useRef<number | undefined>(undefined);
  const micPointerDownRef = useRef(false);
  const micLongPressRef = useRef(false);

  const [hud, setHud] = useState<WizardHudState>(() => createInitialHudState());
  const [palette, setPalette] = useState<PaletteConfig>(DEFAULT_PALETTE);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fpsCap, setFpsCap] = useState(FPS_CAP_DEFAULT);
  const [particleCount, setParticleCount] = useState(PARTICLE_COUNT_DEFAULT);
  const [debugVisible, setDebugVisible] = useState(query.debug);
  const [cameraResponse, setCameraResponse] = useState(0.15);
  const [micSensitivityVisible, setMicSensitivityVisible] = useState(false);

  const controlsUiVisible = controlsVisible && !isFullscreen;

  const clearMicHoldTimer = useCallback((): void => {
    if (micHoldTimerRef.current !== undefined) {
      window.clearTimeout(micHoldTimerRef.current);
      micHoldTimerRef.current = undefined;
    }
  }, []);

  const finishMicPress = useCallback(
    (toggleOnRelease: boolean): void => {
      clearMicHoldTimer();
      if (!micPointerDownRef.current) {
        return;
      }

      micPointerDownRef.current = false;
      if (toggleOnRelease && !micLongPressRef.current) {
        void runtimeRef.current?.toggleMic();
      }
    },
    [clearMicHoldTimer]
  );

  const toggleFullscreen = useCallback(async (): Promise<void> => {
    const root = rootRef.current;
    if (!root) {
      return;
    }

    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        return;
      }
      await root.requestFullscreen();
    } catch {
      // Fullscreen can fail without user activation or policy support.
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    const root = rootRef.current;
    if (!canvas || !video || !root) {
      return;
    }

    const runtime = new ParticleWizardRuntime({
      canvas,
      video,
      testMode: query.testMode,
      seed: query.seed,
      fixedTimeSec: query.fixedTimeSec,
      width: query.width,
      height: query.height,
      onHudUpdate: (next) => {
        setHud(next);
        setPalette((current) => (paletteEquals(current, next.palette) ? current : { ...next.palette }));
        setFpsCap((current) => (current === next.targetFps ? current : next.targetFps));
        setParticleCount((current) => (current === next.particleCount ? current : next.particleCount));
      }
    });

    runtimeRef.current = runtime;
    runtime.setTargetFps(FPS_CAP_DEFAULT);
    runtime.setParticleCount(PARTICLE_COUNT_DEFAULT);
    runtime.setCameraResponse(0.15);

    const visualDefaults = buildVisualQueryDefaults(query);
    if (Object.keys(visualDefaults).length > 0) {
      runtime.setVisualTuning(visualDefaults);
    }

    const paletteDefaults = buildPaletteQueryDefaults(query, DEFAULT_PALETTE);
    if (paletteDefaults) {
      setPalette(paletteDefaults);
      runtime.setPalette(paletteDefaults);
    } else {
      setPalette(DEFAULT_PALETTE);
    }

    const resizeObserver = new ResizeObserver(() => {
      runtime.resize(root.clientWidth, root.clientHeight);
    });
    resizeObserver.observe(root);

    void runtime.start();
    runtime.resize(query.width ?? root.clientWidth, query.height ?? root.clientHeight);

    return () => {
      resizeObserver.disconnect();
      runtime.dispose();
      runtimeRef.current = undefined;
    };
  }, [query]);

  useEffect(() => {
    const onFullscreenChange = (): void => {
      setIsFullscreen(document.fullscreenElement === rootRef.current);
    };

    onFullscreenChange();
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.repeat || event.ctrlKey || event.altKey || event.metaKey) {
        return;
      }

      const key = event.key.toLowerCase();
      if (key === "m") {
        event.preventDefault();
        setControlsVisible((current) => !current);
        return;
      }

      if (key === "f") {
        event.preventDefault();
        void toggleFullscreen();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [toggleFullscreen]);

  useEffect(() => {
    if (controlsUiVisible) {
      return;
    }
    setMicSensitivityVisible(false);
    clearMicHoldTimer();
    micPointerDownRef.current = false;
    micLongPressRef.current = false;
  }, [controlsUiVisible, clearMicHoldTimer]);

  useEffect(() => {
    return () => {
      clearMicHoldTimer();
    };
  }, [clearMicHoldTimer]);

  const handleTransform = (): void => {
    runtimeRef.current?.cycleTransform();
  };

  const handleFlow = (): void => {
    runtimeRef.current?.toggleFlow();
  };

  const handleTrails = (): void => {
    runtimeRef.current?.toggleTrails();
  };

  const handleFpsChange = (event: ChangeEvent<HTMLInputElement>): void => {
    const next = Number(event.target.value);
    if (!Number.isFinite(next)) {
      return;
    }

    setFpsCap(next);
    runtimeRef.current?.setTargetFps(next);
  };

  const handleParticleCountChange = (event: ChangeEvent<HTMLInputElement>): void => {
    const next = Number(event.target.value);
    if (!Number.isFinite(next)) {
      return;
    }

    setParticleCount(next);
    runtimeRef.current?.setParticleCount(next);
  };

  const handlePaletteChange =
    (key: PaletteKey) =>
    (event: ChangeEvent<HTMLInputElement>): void => {
      const nextValue = event.target.value;
      setPalette((current) => {
        const nextPalette: PaletteConfig = {
          ...current,
          [key]: nextValue,
          presetId: "custom"
        };
        runtimeRef.current?.setPalette(nextPalette);
        return nextPalette;
      });
    };

  const handleVisualTuningChange =
    (key: keyof VisualTuning) =>
    (event: ChangeEvent<HTMLInputElement>): void => {
      const next = Number(event.target.value);
      if (!Number.isFinite(next)) {
        return;
      }

      runtimeRef.current?.setVisualTuning({
        [key]: next
      } as Partial<VisualTuning>);
    };

  const handleModeChange = (event: ChangeEvent<HTMLSelectElement>): void => {
    runtimeRef.current?.setMode(Number(event.target.value));
  };

  const handleCameraResponseChange = (event: ChangeEvent<HTMLInputElement>): void => {
    const next = Number(event.target.value);
    if (!Number.isFinite(next)) {
      return;
    }

    setCameraResponse(next);
    runtimeRef.current?.setCameraResponse(next);
  };

  const handleMicSensitivityChange = (event: ChangeEvent<HTMLInputElement>): void => {
    const next = Number(event.target.value);
    if (!Number.isFinite(next)) {
      return;
    }

    runtimeRef.current?.setMicSensitivity(next);
  };

  const handleMicPointerDown = (event: ReactPointerEvent<HTMLButtonElement>): void => {
    if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }

    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Some synthetic pointer events (tests) cannot capture pointers.
    }
    micPointerDownRef.current = true;
    micLongPressRef.current = false;
    clearMicHoldTimer();
    micHoldTimerRef.current = window.setTimeout(() => {
      if (!micPointerDownRef.current) {
        return;
      }
      micLongPressRef.current = true;
      setMicSensitivityVisible(true);
    }, MIC_LONG_PRESS_MS);
  };

  const handleMicPointerUp = (): void => {
    finishMicPress(true);
  };

  const handleMicPointerCancel = (): void => {
    finishMicPress(false);
  };

  const handleMicKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>): void => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    void runtimeRef.current?.toggleMic();
  };

  const forcedSize =
    typeof query.width === "number" && typeof query.height === "number"
      ? { width: `${query.width}px`, height: `${query.height}px` }
      : undefined;
  const palmOutlinePath =
    "M11 58C6 55 4 50 4 44V30c0-3 2-5 5-5s5 2 5 5v-16c0-3 2-5 5-5s5 2 5 5v15c0-3 2-5 5-5s5 2 5 5v-12c0-3 2-5 5-5s5 2 5 5v14c0-3 2-5 5-5s5 2 5 5v17c0 12-9 22-21 22z";

  const modeIndex = Math.max(0, hud.modeNames.indexOf(hud.modeName));

  return (
    <div className="wizard-root" ref={rootRef} style={forcedSize}>
      <canvas
        id="wizard-canvas"
        data-testid="wizard-canvas"
        ref={canvasRef}
        width={Math.floor(query.width ?? 1280)}
        height={Math.floor(query.height ?? 720)}
      />

      <div id="hud" data-testid="hud-root" style={{ display: controlsUiVisible ? "block" : "none" }}>
        <div id="left-panel" className="panel">
          <div>
            <span className="dot">*</span> SYSTEM ACTIVE
          </div>
          <div className="stat">
            Particles <span id="particle-count">{hud.particleCount}</span>
          </div>
          <div className="stat">
            FPS Cap <span id="fps-cap-value" data-testid="fps-cap-value">{hud.targetFps}</span>
          </div>
          <div className="stat">
            FPS <span id="fps-value">{hud.fps}</span>
          </div>
          <div className="stat">
            Mode{" "}
            <span id="mode-value" data-testid="mode-value">
              {hud.modeName}
            </span>
          </div>
          <div className="stat">
            Trails <span id="trails-value" data-testid="trails-value">{hud.trailsText}</span>
          </div>
          <div className="stat" id="wizard-status" data-testid="wizard-status">
            Wizard: <span style={{ color: hud.wizardActive ? "#0f8" : "#ff6677" }}>{hud.wizardActive ? "ACTIVE" : "OFF"}</span>
          </div>
          <div className="stat">
            Hand Mode <span>{hud.handMode.toUpperCase()}</span>
          </div>
        </div>

        <div id="title-shell">
          <div id="title" data-testid="title-text" data-text={hud.title}>
            {hud.title}
          </div>
        </div>

        <aside id="right-panel" className="panel" data-testid="advanced-panel">
          <h3 className="panel-title">Advanced Dynamics</h3>

          <div className="control-grid">
            <label htmlFor="mode-select">Mode</label>
            <select id="mode-select" data-testid="mode-select" value={modeIndex} onChange={handleModeChange}>
              {hud.modeNames.map((modeName, index) => (
                <option key={modeName} value={index}>
                  {modeName}
                </option>
              ))}
            </select>

            <label htmlFor="palette-primary">Primary</label>
            <input
              id="palette-primary"
              data-testid="primary-color-input"
              type="color"
              value={palette.primary}
              onChange={handlePaletteChange("primary")}
            />

            <label htmlFor="palette-secondary">Secondary</label>
            <input id="palette-secondary" type="color" value={palette.secondary} onChange={handlePaletteChange("secondary")} />

            <label htmlFor="palette-accent">Accent</label>
            <input id="palette-accent" type="color" value={palette.accent} onChange={handlePaletteChange("accent")} />

            <label htmlFor="bloom-strength">Bloom Strength</label>
            <input
              id="bloom-strength"
              type="range"
              min={0}
              max={1.5}
              step={0.01}
              value={hud.visualTuning.bloomStrength}
              onChange={handleVisualTuningChange("bloomStrength")}
            />

            <label htmlFor="bloom-radius">Bloom Radius</label>
            <input
              id="bloom-radius"
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={hud.visualTuning.bloomRadius}
              onChange={handleVisualTuningChange("bloomRadius")}
            />

            <label htmlFor="bloom-threshold">Bloom Threshold</label>
            <input
              id="bloom-threshold"
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={hud.visualTuning.bloomThreshold}
              onChange={handleVisualTuningChange("bloomThreshold")}
            />

            <label htmlFor="particle-gain">Particle Gain</label>
            <input
              id="particle-gain"
              type="range"
              min={0.4}
              max={1.4}
              step={0.01}
              value={hud.visualTuning.particleGain}
              onChange={handleVisualTuningChange("particleGain")}
            />

            <label htmlFor="fps-slider">FPS Cap</label>
            <input
              id="fps-slider"
              data-testid="fps-slider"
              type="range"
              min={FPS_CAP_MIN}
              max={FPS_CAP_MAX}
              step={1}
              value={fpsCap}
              onChange={handleFpsChange}
            />

            <label htmlFor="particle-slider">Particles</label>
            <input
              id="particle-slider"
              data-testid="particle-slider"
              type="range"
              min={PARTICLE_COUNT_MIN}
              max={PARTICLE_COUNT_MAX}
              step={1000}
              value={particleCount}
              onChange={handleParticleCountChange}
            />

            <label htmlFor="camera-response">Camera Response</label>
            <input
              id="camera-response"
              type="range"
              min={0.03}
              max={0.4}
              step={0.005}
              value={cameraResponse}
              onChange={handleCameraResponseChange}
            />
          </div>

          <div className="panel-actions">
            <button type="button" onClick={() => runtimeRef.current?.resetHandCalibration()}>
              RESET CALIBRATION
            </button>
            <button type="button" onClick={() => setDebugVisible((current) => !current)} data-testid="debug-toggle-btn">
              {debugVisible ? "DEBUG ON" : "DEBUG OFF"}
            </button>
          </div>

          <div className="shape-ideas">
            <strong>Added Shapes</strong>
            <span>Klein bottle</span>
            <span>Helix tunnel</span>
            <span>Gyroid cloud</span>
            <span>Superformula bloom</span>
            <span>Wave torus knot</span>
          </div>
        </aside>

        <div id="bottom-controls">
          <button id="transform-btn" data-testid="transform-btn" type="button" onClick={handleTransform}>
            TRANSFORM
          </button>
          <button
            id="flow-btn"
            data-testid="flow-btn"
            data-active={String(hud.flowActive)}
            type="button"
            onClick={handleFlow}
            style={{ opacity: hud.flowActive ? 1 : 0.4 }}
          >
            FLOW
          </button>
          <button
            id="trails-btn"
            data-testid="trails-btn"
            data-active={String(hud.trailsActive)}
            type="button"
            onClick={handleTrails}
          >
            {hud.trailsActive ? "TRAILS" : "TRAILS OFF"}
          </button>
          <button
            id="mic-btn"
            data-testid="mic-btn"
            data-mic-status={hud.micStatus}
            type="button"
            onPointerDown={handleMicPointerDown}
            onPointerUp={handleMicPointerUp}
            onPointerCancel={handleMicPointerCancel}
            onPointerLeave={handleMicPointerCancel}
            onKeyDown={handleMicKeyDown}
            style={{ color: hud.micButtonColor }}
          >
            {hud.micButtonText}
          </button>
          <button type="button" onClick={() => setControlsVisible((current) => !current)}>
            {controlsVisible ? "HUD ON" : "HUD OFF"}
          </button>
          <button id="fullscreen-btn" data-testid="fullscreen-btn" type="button" onClick={() => void toggleFullscreen()}>
            FULLSCREEN
          </button>
        </div>

        {micSensitivityVisible && (
          <div id="mic-sensitivity-popout" data-testid="mic-sensitivity-popout" className="panel">
            <div className="mic-popout-head">
              <strong>Mic Sensitivity</strong>
              <button type="button" onClick={() => setMicSensitivityVisible(false)}>
                CLOSE
              </button>
            </div>
            <label htmlFor="mic-sensitivity-slider">Sensitivity</label>
            <input
              id="mic-sensitivity-slider"
              data-testid="mic-sensitivity-slider"
              type="range"
              min={0}
              max={3}
              step={0.05}
              value={hud.micSensitivity}
              onChange={handleMicSensitivityChange}
            />
            <span>{hud.micSensitivity.toFixed(2)}</span>
          </div>
        )}

        {debugVisible && (
          <div id="debug-panel" className="panel" data-testid="debug-panel">
            <div className="debug-line">FPS: {hud.fps} / {hud.targetFps}</div>
            <div className="debug-line">Mode: {hud.modeName}</div>
            <div className="debug-line">Mic: {hud.micStatus} | level {hud.micLevel.toFixed(3)} | sens {hud.micSensitivity.toFixed(2)}</div>
            <div className="debug-line">
              Camera: az {hud.cameraDebug.azimuth.toFixed(3)} pol {hud.cameraDebug.polar.toFixed(3)} dist {hud.cameraDebug.distance.toFixed(2)}
            </div>
            <div className="debug-line">
              Camera target: az {hud.cameraDebug.targetAzimuth.toFixed(3)} pol {hud.cameraDebug.targetPolar.toFixed(3)} dist {hud.cameraDebug.targetDistance.toFixed(2)}
            </div>
            <div className="debug-line">Hand track: {hud.handTrackingState} | mode {hud.handMode} | palms {hud.handDebug.palmCount}</div>
            <div className="debug-line">Center: ({hud.handDebug.centerX.toFixed(3)}, {hud.handDebug.centerY.toFixed(3)}) inCenter {String(hud.handDebug.inCenter)}</div>
            <div className="debug-line">
              Shared: {hud.handDebug.sharedRatio?.toFixed(2) ?? "0"} | Budget: {hud.handDebug.sharedBudget ?? 0}
            </div>
            <div className="debug-line">
              Left: ({hud.handDebug.mappedOffsetLeft.x.toFixed(2)}, {hud.handDebug.mappedOffsetLeft.y.toFixed(2)},{" "}
              {hud.handDebug.mappedOffsetLeft.z.toFixed(2)}) s={hud.handDebug.mappedScaleLeft.toFixed(2)} f={hud.handDebug.mappedFingerLeft.toFixed(2)}
            </div>
            <div className="debug-line">
              Right: ({hud.handDebug.mappedOffsetRight.x.toFixed(2)}, {hud.handDebug.mappedOffsetRight.y.toFixed(2)},{" "}
              {hud.handDebug.mappedOffsetRight.z.toFixed(2)}) s={hud.handDebug.mappedScaleRight.toFixed(2)} f={hud.handDebug.mappedFingerRight.toFixed(2)}
            </div>
          </div>
        )}
      </div>

      <div
        id="webcam-container"
        data-testid="webcam-container"
        style={{ display: controlsUiVisible && hud.webcamVisible ? "block" : "none" }}
      >
        <video id="webcam" ref={videoRef} autoPlay playsInline muted />
        <div id="hand-stick-overlay" style={{ opacity: hud.handDebug.palms.length > 0 ? 1 : 0 }}>
          {hud.handDebug.palms.map((palm) => {
            const handLandmarks = palm.landmarks;
            if (!handLandmarks || handLandmarks.length < 21) {
              return null;
            }

            return (
              <svg
                key={`${palm.role}-${palm.x}-${palm.y}`}
                className="hand-stick-svg"
                data-hand-role={palm.role}
                data-testid={palm.role === "left" ? "left-hand-skeleton" : palm.role === "right" ? "right-hand-skeleton" : undefined}
              >
                {HAND_STICK_CONNECTIONS.map(([from, to]) => {
                  const fromPoint = handLandmarks[from] as LandmarkPoint | undefined;
                  const toPoint = handLandmarks[to] as LandmarkPoint | undefined;
                  if (!fromPoint || !toPoint) {
                    return null;
                  }

                  const [x1, y1] = toDisplayCoordinate(fromPoint.x, fromPoint.y);
                  const [x2, y2] = toDisplayCoordinate(toPoint.x, toPoint.y);
                  return <line key={`${from}-${to}`} className="hand-stick-line" x1={x1} y1={y1} x2={x2} y2={y2} />;
                })}
                {handLandmarks.map((point, index) => {
                  const [cx, cy] = toDisplayCoordinate(point.x, point.y);
                  return <circle key={`p-${index}`} className="hand-stick-point" cx={cx} cy={cy} r={1.3} />;
                })}
              </svg>
            );
          })}
        </div>
        <div id="calibration-overlay" style={{ opacity: hud.calibrationOpacity }}>
          <div
            className="palm-outline palm-outline-left"
            data-testid="left-palm-outline"
            data-lit={String(hud.handDebug.leftTargetReady)}
            aria-hidden="true"
          >
            <svg viewBox="0 0 52 64" focusable="false" aria-hidden="true">
              <path d={palmOutlinePath} />
            </svg>
          </div>
          <div
            className="palm-outline palm-outline-right"
            data-testid="right-palm-outline"
            data-lit={String(hud.handDebug.rightTargetReady)}
            aria-hidden="true"
          >
            <svg viewBox="0 0 52 64" focusable="false" aria-hidden="true">
              <path d={palmOutlinePath} />
            </svg>
          </div>
        </div>
      </div>

      <div id="status" data-testid="status-line" style={{ color: hud.statusColor, display: controlsUiVisible ? "block" : "none" }}>
        {hud.statusText}
      </div>
    </div>
  );
};
