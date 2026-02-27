import { useEffect, useMemo, useRef, useState } from "react";
import {
  createInitialHudState,
  ParticleWizardRuntime,
  type WizardHudState
} from "../wizard/ParticleWizardRuntime";
import { parseWizardQuery } from "../wizard/query";

export const App = (): JSX.Element => {
  const query = useMemo(() => parseWizardQuery(), []);

  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const runtimeRef = useRef<ParticleWizardRuntime | undefined>(undefined);

  const [hud, setHud] = useState<WizardHudState>(() => createInitialHudState());

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
      }
    });

    runtimeRef.current = runtime;

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

  const handleTransform = (): void => {
    runtimeRef.current?.cycleTransform();
  };

  const handleFlow = (): void => {
    runtimeRef.current?.toggleFlow();
  };

  const handleTrails = (): void => {
    runtimeRef.current?.toggleTrails();
  };

  const handleMic = (): void => {
    void runtimeRef.current?.requestMic();
  };

  const forcedSize =
    typeof query.width === "number" && typeof query.height === "number"
      ? { width: `${query.width}px`, height: `${query.height}px` }
      : undefined;

  return (
    <div className="wizard-root" ref={rootRef} style={forcedSize}>
      <canvas
        id="wizard-canvas"
        data-testid="wizard-canvas"
        ref={canvasRef}
        width={Math.floor(query.width ?? 1280)}
        height={Math.floor(query.height ?? 720)}
      />

      <div id="hud" data-testid="hud-root">
        <div id="left-panel" className="panel">
          <div>
            <span className="dot">*</span> SYSTEM ACTIVE
          </div>
          <div className="stat">
            Particles <span id="particle-count">{hud.particleCount}</span>
          </div>
          <div className="stat">
            FPS <span id="fps-value">{hud.fps}</span>
          </div>
          <div className="stat">
            Mode <span id="mode-value" data-testid="mode-value">{hud.modeName}</span>
          </div>
          <div className="stat">
            Trails <span id="trails-value" data-testid="trails-value">{hud.trailsText}</span>
          </div>
          <div className="stat" id="wizard-status" data-testid="wizard-status">
            Wizard: <span style={{ color: hud.wizardActive ? "#0f8" : "#ff6677" }}>{hud.wizardActive ? "ACTIVE" : "OFF"}</span>
          </div>
        </div>

        <div id="title" data-testid="title-text">
          {hud.title}
        </div>

        <div id="right-panel" className="panel">
          <strong style={{ color: "#ff66ff" }}>Advanced Dynamics</strong>
          <br />
          <br />
          * Mobius topology
          <br />
          * Fluid vortices
          <br />
          * Spherical harmonics
          <br />
          * Lissajous curves
          <br />
          * Fractal branching
          <br />
          <br />
          <small>Drag orbit - Scroll zoom - Mic bass pump - Hand wizard</small>
        </div>

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
            onClick={handleMic}
            style={{ color: hud.micButtonColor }}
          >
            {hud.micButtonText}
          </button>
        </div>
      </div>

      <div
        id="webcam-container"
        data-testid="webcam-container"
        style={{ display: hud.webcamVisible ? "block" : "none" }}
      >
        <video id="webcam" ref={videoRef} autoPlay playsInline muted />
        <div id="calibration-overlay" style={{ opacity: hud.calibrationOpacity }} />
      </div>

      <div id="status" data-testid="status-line" style={{ color: hud.statusColor }}>
        {hud.statusText}
      </div>
    </div>
  );
};
