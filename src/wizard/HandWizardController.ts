import {
  createZeroFingerCurls,
  computeFingerCurls,
  evaluateDualPalmTargets,
  isBackOfHandFacingCamera,
  isCalibrationFist,
  mirrorWebcamX,
  mapLeftHandPose,
  mapRightHandPose,
  mapSingleHandPose,
  resolvePalmAssignment,
  shouldActivateCalibration,
  smoothFingerCurls,
  smoothHandState,
  updateCalibrationTimer,
  type FingerCurls,
  type PalmCandidate,
  type Vec3
} from "./math";
import {
  loadLegacyMediaPipe,
  type LegacyCameraInstance,
  type LegacyMediaPipeLoadErrorCode,
  type LegacyHandsInstance,
  type LegacyHandsResults,
  type LegacyLandmark
} from "./legacyMediaPipe";

export type HandMode = "dual" | "single" | "none";

export type HandTrackingState = "loading" | "ready" | "calibrating" | "active" | "degraded" | "disabled";
export type CameraState = "active" | "denied" | "unsupported" | "error";
export type TrackingStateDetail = LegacyMediaPipeLoadErrorCode;

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
  leftGestureReady: boolean;
  rightGestureReady: boolean;
  leftCalibrationReady: boolean;
  rightCalibrationReady: boolean;
  calibrationTimerMs: number;
  mappedOffset: Vec3;
  mappedScale: number;
  mappedOffsetLeft: Vec3;
  mappedScaleLeft: number;
  mappedOffsetRight: Vec3;
  mappedScaleRight: number;
  mappedFingerLeft: number;
  mappedFingerRight: number;
  mappedFingerCurlsLeft: FingerCurls;
  mappedFingerCurlsRight: FingerCurls;
  singleRole?: "left" | "right";
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
  cameraState: CameraState;
  trackingStateDetail?: TrackingStateDetail;
  handMode: HandMode;
  handTrackingState: HandTrackingState;
  debug: HandDebugInfo;
};

type HandWizardControllerConfig = {
  testMode: boolean;
  trackerMode: "default" | "off" | "mockfail" | "remote" | "local";
  video: HTMLVideoElement;
  onStateChange?: (state: HandWizardUiState) => void;
};

const CALIBRATION_HOLD_MS = 1200;
const RECALIBRATION_HOLD_MS = 1500;
const SINGLE_FALLBACK_HOLD_MS = 500;
const OVERLAY_READY_OPACITY = 0.35;
const OVERLAY_HOLD_OPACITY = 0.85;
const OVERLAY_ACTIVE_FAINT_OPACITY = 0.22;

const INACTIVE_STATUS = "Align two fists (palms facing you) with the outlines to calibrate wizard.";
const CALIBRATING_STATUS = "Hold two fists (palms facing you) on the outlines to calibrate...";
const RECALIBRATING_STATUS = "Hold two fists (palms facing you) on the outlines to recalibrate...";
const ACTIVE_DUAL_STATUS = "WIZARD MODE ACTIVE - Dual-hand sculpting.";
const ACTIVE_SINGLE_STATUS = "Single-hand fallback active.";
const WAIT_SINGLE_STATUS = "Single hand seen - hold steady to enter fallback.";
const DEGRADED_STATUS = "Tracking degraded - keep palms visible.";
const CAMERA_DENIED_STATUS = "Camera access denied.";
const CAMERA_UNSUPPORTED_STATUS = "Camera unavailable in this browser.";
const CAMERA_ERROR_STATUS = "Camera unavailable due to runtime error.";
const TRACKING_UNAVAILABLE_STATUS = "Camera active - hand tracking unavailable.";

const DEFAULT_DEBUG_INFO: HandDebugInfo = {
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
  staleMs: 0
};

export class HandWizardController {
  private readonly testMode: boolean;
  private readonly trackerMode: "default" | "off" | "mockfail" | "remote" | "local";
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
  private leftFingerCurls: FingerCurls = createZeroFingerCurls();
  private rightHandOffset: Vec3 = { x: 0, y: 0, z: 0 };
  private rightHandScale = 0;
  private rightFingerSignal = 0;
  private rightFingerCurls: FingerCurls = createZeroFingerCurls();

  private uiState: HandWizardUiState = {
    webcamVisible: true,
    overlayOpacity: OVERLAY_READY_OPACITY,
    wizardActive: false,
    statusText: "Initializing hand tracking...",
    statusColor: "#00ffff",
    cameraState: "active",
    handMode: "none",
    handTrackingState: "loading",
    debug: { ...DEFAULT_DEBUG_INFO }
  };

  constructor(config: HandWizardControllerConfig) {
    this.testMode = config.testMode;
    this.trackerMode = config.trackerMode;
    this.video = config.video;
    this.onStateChange = config.onStateChange;
  }

  async init(): Promise<void> {
    if (this.started) {
      return;
    }
    this.started = true;

    if (this.testMode) {
      if (this.trackerMode === "off" || this.trackerMode === "mockfail") {
        this.setTrackingUnavailable(this.trackerMode === "off" ? "disabled" : "runtime-error");
        return;
      }

      this.dualCalibrated = true;
      this.uiState = {
        webcamVisible: true,
        overlayOpacity: 0,
        wizardActive: true,
        statusText: ACTIVE_DUAL_STATUS,
        statusColor: "#0f8",
        cameraState: "active",
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
          rightTargetReady: true,
          leftGestureReady: true,
          rightGestureReady: true,
          leftCalibrationReady: true,
          rightCalibrationReady: true
        }
      };
      this.emitState();
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      this.setCameraUnavailable("unsupported");
      return;
    }

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 }
      });
      this.video.srcObject = this.stream;
      await this.video.play();
      this.uiState.webcamVisible = true;
      this.uiState.cameraState = "active";
    } catch (error) {
      if (error instanceof DOMException && error.name === "NotAllowedError") {
        this.setCameraUnavailable("denied");
      } else if (error instanceof DOMException && error.name === "NotFoundError") {
        this.setCameraUnavailable("unsupported");
      } else {
        this.setCameraUnavailable("error");
      }
      return;
    }

    if (this.trackerMode === "off") {
      this.setTrackingUnavailable("disabled");
      return;
    }

    const api = await loadLegacyMediaPipe({
      allowRemoteFallback: this.trackerMode !== "local",
      forceFailure: this.trackerMode === "mockfail"
    });
    if (!api.ok) {
      this.setTrackingUnavailable(api.errorCode);
      return;
    }

    try {
      this.hands = new api.Hands({
        locateFile: (file: string): string => file
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
      this.uiState.trackingStateDetail = undefined;
      this.uiState.handTrackingState = "ready";
      this.emitState();
    } catch {
      this.setTrackingUnavailable("runtime-error");
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
      const syntheticCurls: FingerCurls = {
        thumb: 0.28 + 0.18 * (Math.sin(time * 1.5) * 0.5 + 0.5),
        index: 0.22 + 0.22 * (Math.sin(time * 1.2 + 0.7) * 0.5 + 0.5),
        middle: 0.25 + 0.24 * (Math.sin(time * 1.1 + 1.4) * 0.5 + 0.5),
        ring: 0.27 + 0.2 * (Math.sin(time * 1.35 + 2.1) * 0.5 + 0.5),
        pinky: 0.26 + 0.2 * (Math.sin(time * 1.45 + 2.8) * 0.5 + 0.5)
      };
      this.leftFingerCurls = syntheticCurls;
      this.rightFingerCurls = syntheticCurls;

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
        mappedFingerCurlsLeft: this.leftFingerCurls,
        mappedFingerCurlsRight: this.rightFingerCurls,
        singleRole: undefined,
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
      const zeroCurls = createZeroFingerCurls();

      this.leftHandOffset = leftSmooth.offset;
      this.leftHandScale = leftSmooth.scale;
      this.rightHandOffset = rightSmooth.offset;
      this.rightHandScale = rightSmooth.scale;
      this.leftFingerSignal *= 0.92;
      this.rightFingerSignal *= 0.92;
      this.leftFingerCurls = smoothFingerCurls(this.leftFingerCurls, zeroCurls, 0.08);
      this.rightFingerCurls = smoothFingerCurls(this.rightFingerCurls, zeroCurls, 0.08);

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
      this.uiState.debug.mappedFingerCurlsLeft = this.leftFingerCurls;
      this.uiState.debug.mappedFingerCurlsRight = this.rightFingerCurls;
      this.uiState.debug.singleRole = undefined;
      this.uiState.debug.inCenter = false;
      this.uiState.debug.leftTargetReady = false;
      this.uiState.debug.rightTargetReady = false;
      this.uiState.debug.leftGestureReady = false;
      this.uiState.debug.rightGestureReady = false;
      this.uiState.debug.leftCalibrationReady = false;
      this.uiState.debug.rightCalibrationReady = false;
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

  getLeftFingerCurls(): FingerCurls {
    return this.leftFingerCurls;
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

  getRightFingerCurls(): FingerCurls {
    return this.rightFingerCurls;
  }

  getSingleRole(): "left" | "right" | undefined {
    return this.uiState.debug.singleRole;
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
    this.leftFingerCurls = createZeroFingerCurls();
    this.rightHandOffset = { x: 0, y: 0, z: 0 };
    this.rightHandScale = 0;
    this.rightFingerSignal = 0;
    this.rightFingerCurls = createZeroFingerCurls();
    this.uiState.overlayOpacity = OVERLAY_READY_OPACITY;
    this.uiState.wizardActive = false;
    this.uiState.handMode = "none";
    this.uiState.handTrackingState = this.uiState.handTrackingState === "disabled" ? "disabled" : "ready";
    this.uiState.statusText = this.uiState.handTrackingState === "disabled" ? TRACKING_UNAVAILABLE_STATUS : INACTIVE_STATUS;
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
      singleRole: undefined
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
    this.leftFingerCurls = createZeroFingerCurls();
    this.rightHandOffset = { x: 0, y: 0, z: 0 };
    this.rightHandScale = 0;
    this.rightFingerSignal = 0;
    this.rightFingerCurls = createZeroFingerCurls();
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

  private resolveSingleRole(singleRawX: number, label?: string): "left" | "right" {
    const normalized = label?.toLowerCase();
    if (normalized === "left") {
      return "left";
    }
    if (normalized === "right") {
      return "right";
    }

    return mirrorWebcamX(singleRawX) <= 0.5 ? "left" : "right";
  }

  private handleResults(results: LegacyHandsResults): void {
    this.lastHandTime = Date.now();

    const landmarks = results.multiHandLandmarks;
    if (!landmarks || landmarks.length < 1) {
      const zeroCurls = createZeroFingerCurls();
      this.leftFingerSignal *= 0.9;
      this.rightFingerSignal *= 0.9;
      this.leftFingerCurls = smoothFingerCurls(this.leftFingerCurls, zeroCurls, 0.12);
      this.rightFingerCurls = smoothFingerCurls(this.rightFingerCurls, zeroCurls, 0.12);
      this.uiState.debug = {
        ...this.uiState.debug,
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
        mappedOffsetLeft: { x: 0, y: 0, z: 0 },
        mappedScaleLeft: 0,
        mappedOffsetRight: { x: 0, y: 0, z: 0 },
        mappedScaleRight: 0,
        mappedFingerLeft: this.leftFingerSignal,
        mappedFingerRight: this.rightFingerSignal,
        mappedFingerCurlsLeft: this.leftFingerCurls,
        mappedFingerCurlsRight: this.rightFingerCurls,
        singleRole: undefined,
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
      const zeroCurls = createZeroFingerCurls();
      this.leftFingerSignal *= 0.88;
      this.rightFingerSignal *= 0.88;
      this.leftFingerCurls = smoothFingerCurls(this.leftFingerCurls, zeroCurls, 0.12);
      this.rightFingerCurls = smoothFingerCurls(this.rightFingerCurls, zeroCurls, 0.12);
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
        leftGestureReady: false,
        rightGestureReady: false,
        leftCalibrationReady: false,
        rightCalibrationReady: false,
        calibrationTimerMs: 0,
        mappedOffsetLeft: { x: 0, y: 0, z: 0 },
        mappedScaleLeft: 0,
        mappedOffsetRight: { x: 0, y: 0, z: 0 },
        mappedScaleRight: 0,
        mappedFingerLeft: this.leftFingerSignal,
        mappedFingerRight: this.rightFingerSignal,
        mappedFingerCurlsLeft: this.leftFingerCurls,
        mappedFingerCurlsRight: this.rightFingerCurls,
        singleRole: undefined
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
      const singleRole = this.resolveSingleRole(single.x, candidates[0]?.label);
      const singleCurls = computeFingerCurls(single.landmarks);
      const zeroCurls = createZeroFingerCurls();

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
        leftGestureReady: false,
        rightGestureReady: false,
        leftCalibrationReady: false,
        rightCalibrationReady: false,
        calibrationTimerMs: 0,
        singleRole
      };

      if (this.singleStableMs < SINGLE_FALLBACK_HOLD_MS) {
        this.leftFingerCurls = smoothFingerCurls(this.leftFingerCurls, singleRole === "left" ? singleCurls : zeroCurls, 0.22);
        this.rightFingerCurls = smoothFingerCurls(this.rightFingerCurls, singleRole === "right" ? singleCurls : zeroCurls, 0.22);
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
      const leftTargetOffset = singleRole === "left" ? mapped.offset : { x: 0, y: 0, z: 0 };
      const rightTargetOffset = singleRole === "right" ? mapped.offset : { x: 0, y: 0, z: 0 };
      const leftTargetScale = singleRole === "left" ? mapped.spread : 0;
      const rightTargetScale = singleRole === "right" ? mapped.spread : 0;
      const leftSmooth = smoothHandState(this.leftHandOffset, this.leftHandScale, leftTargetOffset, leftTargetScale, 0.22);
      const rightSmooth = smoothHandState(this.rightHandOffset, this.rightHandScale, rightTargetOffset, rightTargetScale, 0.22);
      this.leftHandOffset = leftSmooth.offset;
      this.leftHandScale = leftSmooth.scale;
      this.rightHandOffset = rightSmooth.offset;
      this.rightHandScale = rightSmooth.scale;
      this.leftFingerSignal = this.leftFingerSignal * 0.78 + (singleRole === "left" ? mapped.fingerSignal : 0) * 0.22;
      this.rightFingerSignal = this.rightFingerSignal * 0.78 + (singleRole === "right" ? mapped.fingerSignal : 0) * 0.22;
      this.leftFingerCurls = smoothFingerCurls(this.leftFingerCurls, singleRole === "left" ? singleCurls : zeroCurls, 0.22);
      this.rightFingerCurls = smoothFingerCurls(this.rightFingerCurls, singleRole === "right" ? singleCurls : zeroCurls, 0.22);
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
        mappedFingerRight: this.rightFingerSignal,
        mappedFingerCurlsLeft: this.leftFingerCurls,
        mappedFingerCurlsRight: this.rightFingerCurls,
        singleRole
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
    const leftGestureReady = isCalibrationFist(leftPalm.landmarks) && isBackOfHandFacingCamera(leftPalm.landmarks, "left");
    const rightGestureReady = isCalibrationFist(rightPalm.landmarks) && isBackOfHandFacingCamera(rightPalm.landmarks, "right");
    const leftCalibrationReady = targetState.leftTargetReady && leftGestureReady;
    const rightCalibrationReady = targetState.rightTargetReady && rightGestureReady;
    const inCenter = leftCalibrationReady && rightCalibrationReady;

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
      leftGestureReady,
      rightGestureReady,
      leftCalibrationReady,
      rightCalibrationReady,
      calibrationTimerMs: this.calibTimerMs,
      singleRole: undefined
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
    const mappedCurlsLeft = computeFingerCurls(leftPalm.landmarks);
    const mappedCurlsRight = computeFingerCurls(rightPalm.landmarks);

    const leftSmooth = smoothHandState(this.leftHandOffset, this.leftHandScale, mappedLeft.offset, mappedLeft.spread, 0.22);
    const rightSmooth = smoothHandState(this.rightHandOffset, this.rightHandScale, mappedRight.offset, mappedRight.spread, 0.22);

    this.leftHandOffset = leftSmooth.offset;
    this.leftHandScale = leftSmooth.scale;
    this.rightHandOffset = rightSmooth.offset;
    this.rightHandScale = rightSmooth.scale;
    this.leftFingerSignal = mappedLeft.fingerSignal;
    this.rightFingerSignal = mappedRight.fingerSignal;
    this.leftFingerCurls = smoothFingerCurls(this.leftFingerCurls, mappedCurlsLeft, 0.22);
    this.rightFingerCurls = smoothFingerCurls(this.rightFingerCurls, mappedCurlsRight, 0.22);
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
      mappedFingerRight: this.rightFingerSignal,
      mappedFingerCurlsLeft: this.leftFingerCurls,
      mappedFingerCurlsRight: this.rightFingerCurls,
      singleRole: undefined
    };
    this.emitState();
  }

  private setCameraUnavailable(cameraState: CameraState): void {
    const statusText =
      cameraState === "denied"
        ? CAMERA_DENIED_STATUS
        : cameraState === "unsupported"
          ? CAMERA_UNSUPPORTED_STATUS
          : CAMERA_ERROR_STATUS;

    this.uiState = {
      webcamVisible: false,
      overlayOpacity: 0,
      wizardActive: false,
      statusText,
      statusColor: "#ffaa66",
      cameraState,
      trackingStateDetail: "disabled",
      handMode: "none",
      handTrackingState: "disabled",
      debug: { ...DEFAULT_DEBUG_INFO }
    };
    this.emitState();
  }

  private setTrackingUnavailable(detail: TrackingStateDetail): void {
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
    this.leftFingerCurls = createZeroFingerCurls();
    this.rightHandOffset = { x: 0, y: 0, z: 0 };
    this.rightHandScale = 0;
    this.rightFingerSignal = 0;
    this.rightFingerCurls = createZeroFingerCurls();

    this.uiState.webcamVisible = true;
    this.uiState.overlayOpacity = OVERLAY_READY_OPACITY;
    this.uiState.wizardActive = false;
    this.uiState.statusText = TRACKING_UNAVAILABLE_STATUS;
    this.uiState.statusColor = "#ffaa66";
    this.uiState.cameraState = "active";
    this.uiState.trackingStateDetail = detail;
    this.uiState.handMode = "none";
    this.uiState.handTrackingState = "disabled";
    this.uiState.debug = { ...DEFAULT_DEBUG_INFO };
    this.emitState();
  }

  private emitState(): void {
    this.onStateChange?.(this.uiState);
  }
}
