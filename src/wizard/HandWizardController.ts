import {
  isCalibrationCenter,
  mapHandPose,
  mapSingleHandPose,
  resolvePalmAssignment,
  shouldActivateCalibration,
  smoothHandState,
  updateCalibrationTimer,
  type PalmCandidate,
  type Vec3
} from "./math";
import { loadLegacyMediaPipe, type LegacyCameraInstance, type LegacyHandsInstance, type LegacyHandsResults } from "./legacyMediaPipe";

export type HandMode = "dual" | "single" | "none";

export type HandTrackingState = "loading" | "ready" | "calibrating" | "active" | "degraded" | "disabled";

export type HandDebugPalm = {
  x: number;
  y: number;
  role: "left" | "right" | "single";
};

export type HandDebugInfo = {
  palmCount: number;
  palms: HandDebugPalm[];
  centerX: number;
  centerY: number;
  inCenter: boolean;
  calibrationTimerMs: number;
  mappedOffset: Vec3;
  mappedScale: number;
  staleMs: number;
};

export type HandWizardUiState = {
  webcamVisible: boolean;
  overlayOpacity: number;
  wizardActive: boolean;
  statusText: string;
  statusColor: string;
  handMode: HandMode;
  handTrackingState: HandTrackingState;
  debug: HandDebugInfo;
};

type HandWizardControllerConfig = {
  testMode: boolean;
  video: HTMLVideoElement;
  onStateChange?: (state: HandWizardUiState) => void;
};

const CALIBRATION_HOLD_MS = 1200;
const SINGLE_FALLBACK_HOLD_MS = 500;

const INACTIVE_STATUS = "Align both palms in center to calibrate wizard.";
const CALIBRATING_STATUS = "Hold both palms in center to calibrate...";
const ACTIVE_DUAL_STATUS = "WIZARD MODE ACTIVE - Dual-hand sculpting.";
const ACTIVE_SINGLE_STATUS = "Single-hand fallback active.";
const WAIT_SINGLE_STATUS = "Single hand seen - hold steady to enter fallback.";
const DEGRADED_STATUS = "Tracking degraded - keep palms visible.";
const DISABLED_STATUS = "Camera optional - wizard disabled.";

const DEFAULT_DEBUG_INFO: HandDebugInfo = {
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

export class HandWizardController {
  private readonly testMode: boolean;
  private readonly video: HTMLVideoElement;
  private readonly onStateChange?: (state: HandWizardUiState) => void;

  private stream?: MediaStream;
  private hands?: LegacyHandsInstance;
  private cameraRunner?: LegacyCameraInstance;
  private handsReady = false;
  private started = false;

  private dualCalibrated = false;
  private singleNeutralSet = false;
  private calibTimerMs = 0;
  private singleStableMs = 0;
  private lastHandTime = 0;

  private neutralLeft: Vec3 = { x: 0, y: 0, z: 0 };
  private neutralRight: Vec3 = { x: 0, y: 0, z: 0 };
  private neutralSingle: Vec3 = { x: 0, y: 0, z: 0 };
  private handOffset: Vec3 = { x: 0, y: 0, z: 0 };
  private handScale = 0;

  private uiState: HandWizardUiState = {
    webcamVisible: true,
    overlayOpacity: 0.35,
    wizardActive: false,
    statusText: "Initializing hand tracking...",
    statusColor: "#00ffff",
    handMode: "none",
    handTrackingState: "loading",
    debug: { ...DEFAULT_DEBUG_INFO }
  };

  constructor(config: HandWizardControllerConfig) {
    this.testMode = config.testMode;
    this.video = config.video;
    this.onStateChange = config.onStateChange;
  }

  async init(): Promise<void> {
    if (this.started) {
      return;
    }
    this.started = true;

    if (this.testMode) {
      this.dualCalibrated = true;
      this.uiState = {
        webcamVisible: true,
        overlayOpacity: 0,
        wizardActive: true,
        statusText: ACTIVE_DUAL_STATUS,
        statusColor: "#0f8",
        handMode: "dual",
        handTrackingState: "active",
        debug: {
          ...DEFAULT_DEBUG_INFO,
          palmCount: 2,
          palms: [
            { x: 0.42, y: 0.5, role: "left" },
            { x: 0.58, y: 0.5, role: "right" }
          ]
        }
      };
      this.emitState();
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      this.setDisabled();
      return;
    }

    const api = await loadLegacyMediaPipe();
    if (!api) {
      this.setDisabled();
      return;
    }

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240 }
      });
      this.video.srcObject = this.stream;
      await this.video.play();

      this.hands = new api.Hands({
        locateFile: (file: string): string => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
      });

      this.hands.setOptions({
        maxNumHands: 2,
        modelComplexity: 1,
        minDetectionConfidence: 0.65,
        minTrackingConfidence: 0.55
      });

      this.hands.onResults((results) => {
        this.handleResults(results);
      });

      this.cameraRunner = new api.Camera(this.video, {
        onFrame: async () => {
          if (this.handsReady && this.hands) {
            await this.hands.send({ image: this.video });
          }
        },
        width: 320,
        height: 240
      });

      await this.cameraRunner.start();
      this.handsReady = true;
      this.uiState.webcamVisible = true;
      this.uiState.statusText = INACTIVE_STATUS;
      this.uiState.statusColor = "#00ffff";
      this.uiState.handTrackingState = "ready";
      this.emitState();
    } catch {
      this.setDisabled();
    }
  }

  update(_dt: number, time: number): void {
    if (!this.started) {
      return;
    }

    if (this.testMode) {
      const targetOffset = {
        x: Math.sin(time * 0.9) * 2.8,
        y: Math.cos(time * 1.2) * 2.2,
        z: Math.sin(time * 0.7) * 1.7
      };
      const targetScale = 1.3 + Math.sin(time * 1.1) * 0.2;
      const smooth = smoothHandState(this.handOffset, this.handScale, targetOffset, targetScale, 0.22);
      this.handOffset = smooth.offset;
      this.handScale = smooth.scale;
      this.uiState.debug = {
        ...this.uiState.debug,
        mappedOffset: { ...this.handOffset },
        mappedScale: this.handScale,
        staleMs: 0
      };
      return;
    }

    if (!this.started || this.uiState.handTrackingState === "disabled") {
      return;
    }

    const staleMs = this.lastHandTime > 0 ? Date.now() - this.lastHandTime : 9999;
    this.uiState.debug.staleMs = staleMs;

    if (staleMs > 450) {
      const smooth = smoothHandState(this.handOffset, this.handScale, { x: 0, y: 0, z: 0 }, 0, 0.08);
      this.handOffset = smooth.offset;
      this.handScale = smooth.scale;
      this.uiState.debug.mappedOffset = { ...this.handOffset };
      this.uiState.debug.mappedScale = this.handScale;

      if (this.uiState.handMode !== "none") {
        this.uiState.handTrackingState = "degraded";
        this.uiState.statusText = DEGRADED_STATUS;
        this.uiState.statusColor = "#ffaa66";
        this.uiState.wizardActive = false;
      }

      if (staleMs > 2400) {
        this.uiState.handMode = "none";
        this.uiState.handTrackingState = "ready";
        this.uiState.statusText = INACTIVE_STATUS;
        this.uiState.statusColor = "#00ffff";
        this.uiState.wizardActive = false;
      }

      this.emitState();
    }
  }

  getOffset(): Vec3 {
    return this.handOffset;
  }

  getScale(): number {
    return this.handScale;
  }

  getUiState(): HandWizardUiState {
    return this.uiState;
  }

  resetCalibration(): void {
    this.dualCalibrated = false;
    this.singleNeutralSet = false;
    this.calibTimerMs = 0;
    this.singleStableMs = 0;
    this.handOffset = { x: 0, y: 0, z: 0 };
    this.handScale = 0;
    this.uiState.overlayOpacity = 0.35;
    this.uiState.wizardActive = false;
    this.uiState.handMode = "none";
    this.uiState.handTrackingState = this.uiState.handTrackingState === "disabled" ? "disabled" : "ready";
    this.uiState.statusText = this.uiState.handTrackingState === "disabled" ? DISABLED_STATUS : INACTIVE_STATUS;
    this.uiState.statusColor = this.uiState.handTrackingState === "disabled" ? "#ffaa66" : "#00ffff";
    this.uiState.debug = {
      ...this.uiState.debug,
      calibrationTimerMs: 0,
      mappedOffset: { x: 0, y: 0, z: 0 },
      mappedScale: 0
    };
    this.emitState();
  }

  dispose(): void {
    this.cameraRunner?.stop?.();
    this.cameraRunner = undefined;
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = undefined;
    this.video.srcObject = null;
    this.hands = undefined;
    this.handsReady = false;
    this.started = false;
    this.dualCalibrated = false;
    this.singleNeutralSet = false;
    this.calibTimerMs = 0;
    this.singleStableMs = 0;
    this.handOffset = { x: 0, y: 0, z: 0 };
    this.handScale = 0;
  }

  private handleResults(results: LegacyHandsResults): void {
    this.lastHandTime = Date.now();

    const landmarks = results.multiHandLandmarks;
    if (!landmarks || landmarks.length < 1) {
      this.uiState.debug = {
        ...this.uiState.debug,
        palmCount: 0,
        palms: []
      };
      this.emitState();
      return;
    }

    const candidates: PalmCandidate[] = [];
    for (let i = 0; i < landmarks.length; i += 1) {
      const palm = landmarks[i]?.[9];
      if (!palm) {
        continue;
      }

      candidates.push({
        x: palm.x,
        y: palm.y,
        z: palm.z,
        label: results.multiHandedness?.[i]?.label
      });
    }

    const assignment = resolvePalmAssignment(candidates);

    if (assignment.mode === "none") {
      this.singleStableMs = 0;
      this.uiState.handMode = "none";
      this.uiState.handTrackingState = "ready";
      this.uiState.statusText = INACTIVE_STATUS;
      this.uiState.statusColor = "#00ffff";
      this.uiState.wizardActive = false;
      this.uiState.debug = {
        ...this.uiState.debug,
        palmCount: 0,
        palms: []
      };
      this.emitState();
      return;
    }

    if (assignment.mode === "single") {
      this.singleStableMs = updateCalibrationTimer(this.singleStableMs, true, 16);
      const single = assignment.single;

      this.uiState.debug = {
        ...this.uiState.debug,
        palmCount: 1,
        palms: [{ x: single.x, y: single.y, role: "single" }],
        centerX: single.x,
        centerY: single.y,
        inCenter: false,
        calibrationTimerMs: this.calibTimerMs
      };

      if (this.singleStableMs < SINGLE_FALLBACK_HOLD_MS) {
        this.uiState.handMode = "none";
        this.uiState.handTrackingState = "ready";
        this.uiState.statusText = WAIT_SINGLE_STATUS;
        this.uiState.statusColor = "#00ffff";
        this.uiState.wizardActive = false;
        this.emitState();
        return;
      }

      if (!this.singleNeutralSet) {
        this.neutralSingle = { x: single.x, y: single.y, z: single.z };
        this.singleNeutralSet = true;
      }

      const mapped = mapSingleHandPose(single, this.neutralSingle);
      const smooth = smoothHandState(this.handOffset, this.handScale, mapped.offset, mapped.spread, 0.22);
      this.handOffset = smooth.offset;
      this.handScale = smooth.scale;

      this.uiState.handMode = "single";
      this.uiState.handTrackingState = "active";
      this.uiState.wizardActive = true;
      this.uiState.statusText = ACTIVE_SINGLE_STATUS;
      this.uiState.statusColor = "#8affdd";
      this.uiState.overlayOpacity = 0;
      this.uiState.debug = {
        ...this.uiState.debug,
        mappedOffset: { ...this.handOffset },
        mappedScale: this.handScale
      };
      this.emitState();
      return;
    }

    this.singleStableMs = 0;
    const leftPalm = assignment.left;
    const rightPalm = assignment.right;

    const centerX = (leftPalm.x + rightPalm.x) / 2;
    const centerY = (leftPalm.y + rightPalm.y) / 2;
    const inCenter = isCalibrationCenter(centerX, centerY, 0.38, 0.62);

    this.uiState.debug = {
      ...this.uiState.debug,
      palmCount: 2,
      palms: [
        { x: leftPalm.x, y: leftPalm.y, role: "left" },
        { x: rightPalm.x, y: rightPalm.y, role: "right" }
      ],
      centerX,
      centerY,
      inCenter,
      calibrationTimerMs: this.calibTimerMs
    };

    if (!this.dualCalibrated) {
      this.calibTimerMs = updateCalibrationTimer(this.calibTimerMs, inCenter, 16);
      this.uiState.debug.calibrationTimerMs = this.calibTimerMs;
      this.uiState.overlayOpacity = inCenter ? 0.85 : 0.35;
      this.uiState.handMode = "none";
      this.uiState.handTrackingState = inCenter ? "calibrating" : "ready";
      this.uiState.statusText = inCenter ? CALIBRATING_STATUS : INACTIVE_STATUS;
      this.uiState.statusColor = "#00ffff";
      this.uiState.wizardActive = false;

      if (shouldActivateCalibration(this.calibTimerMs, CALIBRATION_HOLD_MS)) {
        this.neutralLeft = { ...leftPalm };
        this.neutralRight = { ...rightPalm };
        this.dualCalibrated = true;
        this.calibTimerMs = 0;
        this.uiState.debug.calibrationTimerMs = 0;
        this.uiState.overlayOpacity = 0;
        this.uiState.handMode = "dual";
        this.uiState.handTrackingState = "active";
        this.uiState.wizardActive = true;
        this.uiState.statusText = ACTIVE_DUAL_STATUS;
        this.uiState.statusColor = "#0f8";
      }

      this.emitState();
      return;
    }

    const mapped = mapHandPose(leftPalm, rightPalm, this.neutralLeft, this.neutralRight);
    const smooth = smoothHandState(this.handOffset, this.handScale, mapped.offset, mapped.spread, 0.22);
    this.handOffset = smooth.offset;
    this.handScale = smooth.scale;

    this.uiState.handMode = "dual";
    this.uiState.handTrackingState = "active";
    this.uiState.wizardActive = true;
    this.uiState.statusText = ACTIVE_DUAL_STATUS;
    this.uiState.statusColor = "#0f8";
    this.uiState.overlayOpacity = 0;
    this.uiState.debug = {
      ...this.uiState.debug,
      mappedOffset: { ...this.handOffset },
      mappedScale: this.handScale
    };
    this.emitState();
  }

  private setDisabled(): void {
    this.uiState = {
      webcamVisible: false,
      overlayOpacity: 0,
      wizardActive: false,
      statusText: DISABLED_STATUS,
      statusColor: "#ffaa66",
      handMode: "none",
      handTrackingState: "disabled",
      debug: { ...DEFAULT_DEBUG_INFO }
    };
    this.emitState();
  }

  private emitState(): void {
    this.onStateChange?.(this.uiState);
  }
}
