import {
  isCalibrationCenter,
  mapHandPose,
  shouldActivateCalibration,
  smoothHandState,
  updateCalibrationTimer,
  type Vec3
} from "./math";
import { loadLegacyMediaPipe, type LegacyCameraInstance, type LegacyHandsInstance, type LegacyHandsResults } from "./legacyMediaPipe";

export type HandWizardUiState = {
  webcamVisible: boolean;
  overlayOpacity: number;
  wizardActive: boolean;
  statusText: string;
  statusColor: string;
};

type HandWizardControllerConfig = {
  testMode: boolean;
  video: HTMLVideoElement;
  onStateChange?: (state: HandWizardUiState) => void;
};

const INACTIVE_STATUS = "Align both palms in center to calibrate wizard.";
const ACTIVE_STATUS = "WIZARD MODE ACTIVE - Move hands to sculpt!";
const DISABLED_STATUS = "Camera optional - wizard disabled.";

export class HandWizardController {
  private readonly testMode: boolean;
  private readonly video: HTMLVideoElement;
  private readonly onStateChange?: (state: HandWizardUiState) => void;

  private stream?: MediaStream;
  private hands?: LegacyHandsInstance;
  private cameraRunner?: LegacyCameraInstance;
  private handsReady = false;
  private started = false;

  private calibrated = false;
  private calibTimerMs = 0;
  private lastHandTime = 0;

  private neutralLeft: Vec3 = { x: 0, y: 0, z: 0 };
  private neutralRight: Vec3 = { x: 0, y: 0, z: 0 };
  private handOffset: Vec3 = { x: 0, y: 0, z: 0 };
  private handScale = 0;

  private uiState: HandWizardUiState = {
    webcamVisible: true,
    overlayOpacity: 0.35,
    wizardActive: false,
    statusText: INACTIVE_STATUS,
    statusColor: "#00ffff"
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
      this.calibrated = true;
      this.uiState = {
        webcamVisible: true,
        overlayOpacity: 0,
        wizardActive: true,
        statusText: ACTIVE_STATUS,
        statusColor: "#0f8"
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
        minDetectionConfidence: 0.75,
        minTrackingConfidence: 0.65
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
      return;
    }

    if (!this.calibrated) {
      return;
    }

    if (Date.now() - this.lastHandTime > 450) {
      const smooth = smoothHandState(this.handOffset, this.handScale, { x: 0, y: 0, z: 0 }, 0, 0.08);
      this.handOffset = smooth.offset;
      this.handScale = smooth.scale;
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

  isWizardActive(): boolean {
    return this.uiState.wizardActive;
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
    this.calibrated = false;
    this.calibTimerMs = 0;
    this.handOffset = { x: 0, y: 0, z: 0 };
    this.handScale = 0;
  }

  private handleResults(results: LegacyHandsResults): void {
    this.lastHandTime = Date.now();

    const landmarks = results.multiHandLandmarks;
    if (!landmarks || landmarks.length < 1) {
      return;
    }

    let leftIdx = -1;
    let rightIdx = -1;
    if (results.multiHandedness) {
      for (let i = 0; i < results.multiHandedness.length; i += 1) {
        const handedness = results.multiHandedness[i]?.label;
        if (handedness === "Left") {
          leftIdx = i;
        } else if (handedness === "Right") {
          rightIdx = i;
        }
      }
    }

    if (leftIdx < 0 || rightIdx < 0 || !landmarks[leftIdx] || !landmarks[rightIdx]) {
      return;
    }

    const leftPalm = landmarks[leftIdx][9];
    const rightPalm = landmarks[rightIdx][9];
    if (!leftPalm || !rightPalm) {
      return;
    }

    const centerX = (leftPalm.x + rightPalm.x) / 2;
    const centerY = (leftPalm.y + rightPalm.y) / 2;
    const inCenter = isCalibrationCenter(centerX, centerY);

    if (inCenter && !this.calibrated) {
      this.calibTimerMs = updateCalibrationTimer(this.calibTimerMs, true, 16);
      this.uiState.overlayOpacity = 0.85;

      if (shouldActivateCalibration(this.calibTimerMs, 2000)) {
        this.neutralLeft = { x: leftPalm.x, y: leftPalm.y, z: leftPalm.z };
        this.neutralRight = { x: rightPalm.x, y: rightPalm.y, z: rightPalm.z };
        this.calibrated = true;
        this.uiState.overlayOpacity = 0;
        this.uiState.wizardActive = true;
        this.uiState.statusText = ACTIVE_STATUS;
        this.uiState.statusColor = "#0f8";
      }
    } else if (!this.calibrated) {
      this.calibTimerMs = updateCalibrationTimer(this.calibTimerMs, false, 16);
      this.uiState.overlayOpacity = 0.35;
    }

    if (!this.calibrated) {
      this.emitState();
      return;
    }

    const mapped = mapHandPose(
      { x: leftPalm.x, y: leftPalm.y, z: leftPalm.z },
      { x: rightPalm.x, y: rightPalm.y, z: rightPalm.z },
      this.neutralLeft,
      this.neutralRight
    );
    const smooth = smoothHandState(this.handOffset, this.handScale, mapped.offset, mapped.spread, 0.22);
    this.handOffset = smooth.offset;
    this.handScale = smooth.scale;
    this.emitState();
  }

  private setDisabled(): void {
    this.uiState = {
      webcamVisible: false,
      overlayOpacity: 0,
      wizardActive: false,
      statusText: DISABLED_STATUS,
      statusColor: "#ffaa66"
    };
    this.emitState();
  }

  private emitState(): void {
    this.onStateChange?.(this.uiState);
  }
}
