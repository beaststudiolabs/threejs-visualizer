import {
  evaluateDualPalmTargets,
  mapLeftHandPose,
  mapRightHandPose,
  mapSingleHandPose,
  resolvePalmAssignment,
  shouldActivateCalibration,
  smoothHandState,
  updateCalibrationTimer,
  type PalmCandidate,
  type Vec3
} from "./math";
import {
  loadLegacyMediaPipe,
  type LegacyCameraInstance,
  type LegacyHandsInstance,
  type LegacyHandsResults,
  type LegacyLandmark
} from "./legacyMediaPipe";

export type HandMode = "dual" | "single" | "none";

export type HandTrackingState = "loading" | "ready" | "calibrating" | "active" | "degraded" | "disabled";

export type HandDebugPalm = {
  x: number;
  y: number;
  role: "left" | "right" | "single";
  landmarks?: Vec3[];
};

export type HandDebugInfo = {
  palmCount: number;
  palms: HandDebugPalm[];
  centerX: number;
  centerY: number;
  inCenter: boolean;
  leftTargetReady: boolean;
  rightTargetReady: boolean;
  calibrationTimerMs: number;
  mappedOffset: Vec3;
  mappedScale: number;
  mappedOffsetLeft: Vec3;
  mappedScaleLeft: number;
  mappedOffsetRight: Vec3;
  mappedScaleRight: number;
  mappedFingerLeft: number;
  mappedFingerRight: number;
  sharedRatio?: number;
  sharedBudget?: number;
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
const RECALIBRATION_HOLD_MS = 1500;
const SINGLE_FALLBACK_HOLD_MS = 500;
const OVERLAY_READY_OPACITY = 0.35;
const OVERLAY_HOLD_OPACITY = 0.85;
const OVERLAY_ACTIVE_FAINT_OPACITY = 0.22;

const INACTIVE_STATUS = "Align both palms with the outlines to calibrate wizard.";
const CALIBRATING_STATUS = "Hold both palms on the outlines to calibrate...";
const RECALIBRATING_STATUS = "Hold both palms on the outlines to recalibrate...";
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
  private recalibrationTimerMs = 0;
  private recalibrationLatched = false;
  private singleStableMs = 0;
  private lastHandTime = 0;

  private neutralLeft: Vec3 = { x: 0, y: 0, z: 0 };
  private neutralRight: Vec3 = { x: 0, y: 0, z: 0 };
  private neutralSingle: Vec3 = { x: 0, y: 0, z: 0 };
  private handOffset: Vec3 = { x: 0, y: 0, z: 0 };
  private handScale = 0;
  private leftHandOffset: Vec3 = { x: 0, y: 0, z: 0 };
  private leftHandScale = 0;
  private leftFingerSignal = 0;
  private rightHandOffset: Vec3 = { x: 0, y: 0, z: 0 };
  private rightHandScale = 0;
  private rightFingerSignal = 0;

  private uiState: HandWizardUiState = {
    webcamVisible: true,
    overlayOpacity: OVERLAY_READY_OPACITY,
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
            { x: 0.36, y: 0.5, role: "left" },
            { x: 0.64, y: 0.5, role: "right" }
          ],
          inCenter: true,
          leftTargetReady: true,
          rightTargetReady: true
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
        video: { width: 640, height: 480 }
      });
      this.video.srcObject = this.stream;
      await this.video.play();

      this.hands = new api.Hands({
        locateFile: (file: string): string => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
      });

      this.hands.setOptions({
        maxNumHands: 2,
        modelComplexity: 1,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.45
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
        width: 640,
        height: 480
      });

      await this.cameraRunner.start();
      this.handsReady = true;
      this.uiState.webcamVisible = true;
      this.uiState.overlayOpacity = OVERLAY_READY_OPACITY;
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
      const leftSmooth = smoothHandState(this.leftHandOffset, this.leftHandScale, targetOffset, targetScale, 0.22);
      const rightSmooth = smoothHandState(this.rightHandOffset, this.rightHandScale, {
        x: -targetOffset.x,
        y: targetOffset.y,
        z: targetOffset.z
      }, targetScale, 0.22);

      this.leftHandOffset = leftSmooth.offset;
      this.leftHandScale = leftSmooth.scale;
      this.rightHandOffset = rightSmooth.offset;
      this.rightHandScale = rightSmooth.scale;

      this.handOffset = {
        x: (leftSmooth.offset.x + rightSmooth.offset.x) / 2,
        y: (leftSmooth.offset.y + rightSmooth.offset.y) / 2,
        z: (leftSmooth.offset.z + rightSmooth.offset.z) / 2
      };
      this.handScale = (leftSmooth.scale + rightSmooth.scale) / 2;
      this.leftFingerSignal = 0.25 + 0.15 * Math.sin(time * 1.3);
      this.rightFingerSignal = this.leftFingerSignal;

      this.uiState.debug = {
        ...this.uiState.debug,
        mappedOffset: { ...this.handOffset },
        mappedScale: this.handScale,
        mappedOffsetLeft: { ...this.leftHandOffset },
        mappedScaleLeft: this.leftHandScale,
        mappedOffsetRight: { ...this.rightHandOffset },
        mappedScaleRight: this.rightHandScale,
        mappedFingerLeft: this.leftFingerSignal,
        mappedFingerRight: this.rightFingerSignal,
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
      const leftSmooth = smoothHandState(this.leftHandOffset, this.leftHandScale, { x: 0, y: 0, z: 0 }, 0, 0.08);
      const rightSmooth = smoothHandState(this.rightHandOffset, this.rightHandScale, { x: 0, y: 0, z: 0 }, 0, 0.08);

      this.leftHandOffset = leftSmooth.offset;
      this.leftHandScale = leftSmooth.scale;
      this.rightHandOffset = rightSmooth.offset;
      this.rightHandScale = rightSmooth.scale;
      this.leftFingerSignal = 0;
      this.rightFingerSignal = 0;

      this.handOffset = {
        x: (leftSmooth.offset.x + rightSmooth.offset.x) / 2,
        y: (leftSmooth.offset.y + rightSmooth.offset.y) / 2,
        z: (leftSmooth.offset.z + rightSmooth.offset.z) / 2
      };
      this.handScale = (leftSmooth.scale + rightSmooth.scale) / 2;
      this.uiState.debug.mappedOffset = { ...this.handOffset };
      this.uiState.debug.mappedScale = this.handScale;
      this.uiState.debug.mappedOffsetLeft = { ...this.leftHandOffset };
      this.uiState.debug.mappedScaleLeft = this.leftHandScale;
      this.uiState.debug.mappedOffsetRight = { ...this.rightHandOffset };
      this.uiState.debug.mappedScaleRight = this.rightHandScale;
      this.uiState.debug.mappedFingerLeft = this.leftFingerSignal;
      this.uiState.debug.mappedFingerRight = this.rightFingerSignal;
      this.uiState.debug.inCenter = false;
      this.uiState.debug.leftTargetReady = false;
      this.uiState.debug.rightTargetReady = false;
      this.calibTimerMs = 0;
      this.recalibrationTimerMs = 0;
      this.recalibrationLatched = false;
      this.uiState.debug.calibrationTimerMs = 0;

      if (this.uiState.handMode !== "none") {
        this.uiState.handTrackingState = "degraded";
        this.uiState.statusText = DEGRADED_STATUS;
        this.uiState.statusColor = "#ffaa66";
        this.uiState.wizardActive = false;
      }

      this.uiState.overlayOpacity = this.dualCalibrated ? OVERLAY_ACTIVE_FAINT_OPACITY : OVERLAY_READY_OPACITY;

      if (staleMs > 2400) {
        this.uiState.handMode = "none";
        this.uiState.handTrackingState = "ready";
        this.uiState.statusText = INACTIVE_STATUS;
        this.uiState.statusColor = "#00ffff";
        this.uiState.wizardActive = false;
        this.uiState.debug.palmCount = 0;
        this.uiState.debug.palms = [];
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

  getLeftOffset(): Vec3 {
    return this.leftHandOffset;
  }

  getLeftScale(): number {
    return this.leftHandScale;
  }

  getLeftFingerSignal(): number {
    return this.leftFingerSignal;
  }

  getRightOffset(): Vec3 {
    return this.rightHandOffset;
  }

  getRightScale(): number {
    return this.rightHandScale;
  }

  getRightFingerSignal(): number {
    return this.rightFingerSignal;
  }

  getUiState(): HandWizardUiState {
    return this.uiState;
  }

  resetCalibration(): void {
    this.dualCalibrated = false;
    this.singleNeutralSet = false;
    this.calibTimerMs = 0;
    this.recalibrationTimerMs = 0;
    this.recalibrationLatched = false;
    this.singleStableMs = 0;
    this.handOffset = { x: 0, y: 0, z: 0 };
    this.handScale = 0;
    this.leftHandOffset = { x: 0, y: 0, z: 0 };
    this.leftHandScale = 0;
    this.leftFingerSignal = 0;
    this.rightHandOffset = { x: 0, y: 0, z: 0 };
    this.rightHandScale = 0;
    this.rightFingerSignal = 0;
    this.uiState.overlayOpacity = OVERLAY_READY_OPACITY;
    this.uiState.wizardActive = false;
    this.uiState.handMode = "none";
    this.uiState.handTrackingState = this.uiState.handTrackingState === "disabled" ? "disabled" : "ready";
    this.uiState.statusText = this.uiState.handTrackingState === "disabled" ? DISABLED_STATUS : INACTIVE_STATUS;
    this.uiState.statusColor = this.uiState.handTrackingState === "disabled" ? "#ffaa66" : "#00ffff";
    this.uiState.debug = {
      ...this.uiState.debug,
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
      mappedFingerRight: 0
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
    this.recalibrationTimerMs = 0;
    this.recalibrationLatched = false;
    this.singleStableMs = 0;
    this.handOffset = { x: 0, y: 0, z: 0 };
    this.handScale = 0;
    this.leftHandOffset = { x: 0, y: 0, z: 0 };
    this.leftHandScale = 0;
    this.leftFingerSignal = 0;
    this.rightHandOffset = { x: 0, y: 0, z: 0 };
    this.rightHandScale = 0;
    this.rightFingerSignal = 0;
  }

  private cloneLandmarks(landmarks: LegacyLandmark[] | undefined): Vec3[] | undefined {
    if (!landmarks || landmarks.length === 0) {
      return undefined;
    }

    return landmarks.map((landmark) => ({
      x: landmark.x,
      y: landmark.y,
      z: landmark.z
    }));
  }

  private handleResults(results: LegacyHandsResults): void {
    this.lastHandTime = Date.now();

    const landmarks = results.multiHandLandmarks;
    if (!landmarks || landmarks.length < 1) {
      this.uiState.debug = {
        ...this.uiState.debug,
        palmCount: 0,
        palms: [],
        centerX: 0.5,
        centerY: 0.5,
        inCenter: false,
        leftTargetReady: false,
        rightTargetReady: false,
        mappedOffsetLeft: { x: 0, y: 0, z: 0 },
        mappedScaleLeft: 0,
        mappedOffsetRight: { x: 0, y: 0, z: 0 },
        mappedScaleRight: 0,
        mappedFingerLeft: 0,
        mappedFingerRight: 0,
        sharedRatio: this.uiState.debug.sharedRatio
      };
      this.emitState();
      return;
    }

    const candidates: PalmCandidate[] = [];
    for (let i = 0; i < landmarks.length; i += 1) {
      const handLandmarks = landmarks[i];
      const palm = handLandmarks?.[9];
      if (!palm || !handLandmarks) {
        continue;
      }

      candidates.push({
        x: palm.x,
        y: palm.y,
        z: palm.z,
        label: results.multiHandedness?.[i]?.label,
        landmarks: this.cloneLandmarks(handLandmarks),
        thumbTip: handLandmarks[4]
          ? {
              x: handLandmarks[4].x,
              y: handLandmarks[4].y,
              z: handLandmarks[4].z
            }
          : undefined,
        indexTip: handLandmarks[8]
          ? {
              x: handLandmarks[8].x,
              y: handLandmarks[8].y,
              z: handLandmarks[8].z
            }
          : undefined
      });
    }

    const assignment = resolvePalmAssignment(candidates);

    if (assignment.mode === "none") {
      this.singleStableMs = 0;
      this.calibTimerMs = 0;
      this.recalibrationTimerMs = 0;
      this.recalibrationLatched = false;
      this.uiState.handMode = "none";
      this.uiState.handTrackingState = "ready";
      this.uiState.statusText = INACTIVE_STATUS;
      this.uiState.statusColor = "#00ffff";
      this.uiState.wizardActive = false;
      this.uiState.overlayOpacity = this.dualCalibrated ? OVERLAY_ACTIVE_FAINT_OPACITY : OVERLAY_READY_OPACITY;
      this.uiState.debug = {
        ...this.uiState.debug,
        palmCount: 0,
        palms: [],
        centerX: 0.5,
        centerY: 0.5,
        inCenter: false,
        leftTargetReady: false,
        rightTargetReady: false,
        calibrationTimerMs: 0,
        mappedOffsetLeft: { x: 0, y: 0, z: 0 },
        mappedScaleLeft: 0,
        mappedOffsetRight: { x: 0, y: 0, z: 0 },
        mappedScaleRight: 0,
        mappedFingerLeft: 0,
        mappedFingerRight: 0
      };
      this.emitState();
      return;
    }

    if (assignment.mode === "single") {
      this.singleStableMs = updateCalibrationTimer(this.singleStableMs, true, 16);
      if (!this.dualCalibrated) {
        this.calibTimerMs = 0;
      }
      this.recalibrationTimerMs = 0;
      this.recalibrationLatched = false;
      const single = assignment.single;

      this.uiState.debug = {
        ...this.uiState.debug,
        palmCount: 1,
        palms: [
          {
            x: single.x,
            y: single.y,
            role: "single",
            landmarks: single.landmarks
          }
        ],
        centerX: single.x,
        centerY: single.y,
        inCenter: false,
        leftTargetReady: false,
        rightTargetReady: false,
        calibrationTimerMs: 0
      };

      if (this.singleStableMs < SINGLE_FALLBACK_HOLD_MS) {
        this.uiState.handMode = "none";
        this.uiState.handTrackingState = "ready";
        this.uiState.statusText = WAIT_SINGLE_STATUS;
        this.uiState.statusColor = "#00ffff";
        this.uiState.wizardActive = false;
        this.uiState.overlayOpacity = this.dualCalibrated ? OVERLAY_ACTIVE_FAINT_OPACITY : OVERLAY_READY_OPACITY;
        this.emitState();
        return;
      }

      if (!this.singleNeutralSet) {
        this.neutralSingle = { x: single.x, y: single.y, z: single.z };
        this.singleNeutralSet = true;
      }

      const mapped = mapSingleHandPose(single, this.neutralSingle);
      const leftSmooth = smoothHandState(this.leftHandOffset, this.leftHandScale, mapped.offset, mapped.spread, 0.22);
      const rightSmooth = smoothHandState(this.rightHandOffset, this.rightHandScale, mapped.offset, mapped.spread, 0.22);
      this.leftHandOffset = leftSmooth.offset;
      this.leftHandScale = leftSmooth.scale;
      this.rightHandOffset = rightSmooth.offset;
      this.rightHandScale = rightSmooth.scale;
      this.leftFingerSignal = mapped.fingerSignal;
      this.rightFingerSignal = mapped.fingerSignal;
      this.handOffset = {
        x: (leftSmooth.offset.x + rightSmooth.offset.x) / 2,
        y: (leftSmooth.offset.y + rightSmooth.offset.y) / 2,
        z: (leftSmooth.offset.z + rightSmooth.offset.z) / 2
      };
      this.handScale = (leftSmooth.scale + rightSmooth.scale) / 2;

      this.uiState.handMode = "single";
      this.uiState.handTrackingState = "active";
      this.uiState.wizardActive = true;
      this.uiState.statusText = ACTIVE_SINGLE_STATUS;
      this.uiState.statusColor = "#8affdd";
      this.uiState.overlayOpacity = this.dualCalibrated ? OVERLAY_ACTIVE_FAINT_OPACITY : OVERLAY_READY_OPACITY;
      this.uiState.debug = {
        ...this.uiState.debug,
        mappedOffset: { ...this.handOffset },
        mappedScale: this.handScale,
        mappedOffsetLeft: { ...this.leftHandOffset },
        mappedScaleLeft: this.leftHandScale,
        mappedOffsetRight: { ...this.rightHandOffset },
        mappedScaleRight: this.rightHandScale,
        mappedFingerLeft: this.leftFingerSignal,
        mappedFingerRight: this.rightFingerSignal
      };
      this.emitState();
      return;
    }

    this.singleStableMs = 0;
    const leftPalm = assignment.left;
    const rightPalm = assignment.right;

    const centerX = (leftPalm.x + rightPalm.x) / 2;
    const centerY = (leftPalm.y + rightPalm.y) / 2;
    const targetState = evaluateDualPalmTargets(leftPalm, rightPalm);
    const inCenter = targetState.inCenter;

    this.uiState.debug = {
      ...this.uiState.debug,
      palmCount: 2,
      palms: [
        { x: leftPalm.x, y: leftPalm.y, role: "left", landmarks: leftPalm.landmarks },
        { x: rightPalm.x, y: rightPalm.y, role: "right", landmarks: rightPalm.landmarks }
      ],
      centerX,
      centerY,
      inCenter,
      leftTargetReady: targetState.leftTargetReady,
      rightTargetReady: targetState.rightTargetReady,
      calibrationTimerMs: this.calibTimerMs
    };

    if (!this.dualCalibrated) {
      this.calibTimerMs = updateCalibrationTimer(this.calibTimerMs, inCenter, 16);
      this.uiState.debug.calibrationTimerMs = this.calibTimerMs;
      this.uiState.overlayOpacity = inCenter ? OVERLAY_HOLD_OPACITY : OVERLAY_READY_OPACITY;
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
        this.recalibrationTimerMs = 0;
        this.recalibrationLatched = false;
        this.uiState.debug.calibrationTimerMs = 0;
        this.uiState.overlayOpacity = OVERLAY_ACTIVE_FAINT_OPACITY;
        this.uiState.handMode = "dual";
        this.uiState.handTrackingState = "active";
        this.uiState.wizardActive = true;
        this.uiState.statusText = ACTIVE_DUAL_STATUS;
        this.uiState.statusColor = "#0f8";
      }

      this.emitState();
      return;
    }

    const mappedLeft = mapLeftHandPose(leftPalm, this.neutralLeft);
    const mappedRight = mapRightHandPose(rightPalm, this.neutralRight);

    const leftSmooth = smoothHandState(this.leftHandOffset, this.leftHandScale, mappedLeft.offset, mappedLeft.spread, 0.22);
    const rightSmooth = smoothHandState(this.rightHandOffset, this.rightHandScale, mappedRight.offset, mappedRight.spread, 0.22);

    this.leftHandOffset = leftSmooth.offset;
    this.leftHandScale = leftSmooth.scale;
    this.rightHandOffset = rightSmooth.offset;
    this.rightHandScale = rightSmooth.scale;
    this.leftFingerSignal = mappedLeft.fingerSignal;
    this.rightFingerSignal = mappedRight.fingerSignal;
    this.handOffset = {
      x: (leftSmooth.offset.x + rightSmooth.offset.x) / 2,
      y: (leftSmooth.offset.y + rightSmooth.offset.y) / 2,
      z: (leftSmooth.offset.z + rightSmooth.offset.z) / 2
    };
    this.handScale = (leftSmooth.scale + rightSmooth.scale) / 2;

    this.uiState.handMode = "dual";
    this.uiState.handTrackingState = "active";
    this.uiState.wizardActive = true;
    this.uiState.overlayOpacity = OVERLAY_ACTIVE_FAINT_OPACITY;

    if (inCenter) {
      if (!this.recalibrationLatched) {
        this.recalibrationTimerMs = updateCalibrationTimer(this.recalibrationTimerMs, true, 16);
        this.uiState.statusText = RECALIBRATING_STATUS;
        this.uiState.statusColor = "#8affdd";
        if (shouldActivateCalibration(this.recalibrationTimerMs, RECALIBRATION_HOLD_MS)) {
          this.neutralLeft = { ...leftPalm };
          this.neutralRight = { ...rightPalm };
          this.recalibrationTimerMs = 0;
          this.recalibrationLatched = true;
          this.uiState.statusText = ACTIVE_DUAL_STATUS;
          this.uiState.statusColor = "#0f8";
        }
      } else {
        this.recalibrationTimerMs = 0;
        this.uiState.statusText = ACTIVE_DUAL_STATUS;
        this.uiState.statusColor = "#0f8";
      }
    } else {
      this.recalibrationTimerMs = 0;
      this.recalibrationLatched = false;
      this.uiState.statusText = ACTIVE_DUAL_STATUS;
      this.uiState.statusColor = "#0f8";
    }

    this.uiState.debug.calibrationTimerMs = this.recalibrationTimerMs;
    this.uiState.debug = {
      ...this.uiState.debug,
      mappedOffset: { ...this.handOffset },
      mappedScale: this.handScale,
      mappedOffsetLeft: { ...this.leftHandOffset },
      mappedScaleLeft: this.leftHandScale,
      mappedOffsetRight: { ...this.rightHandOffset },
      mappedScaleRight: this.rightHandScale,
      mappedFingerLeft: this.leftFingerSignal,
      mappedFingerRight: this.rightFingerSignal
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
