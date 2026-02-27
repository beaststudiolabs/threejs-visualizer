import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HandWizardController } from "../../src/wizard/HandWizardController";
import * as legacyMediaPipe from "../../src/wizard/legacyMediaPipe";
import type { LegacyHandsResults, LegacyLandmark } from "../../src/wizard/legacyMediaPipe";

const LEFT_TARGET_RAW_X = 0.64;
const RIGHT_TARGET_RAW_X = 0.36;
const OVERLAY_READY_OPACITY = 0.35;
const OVERLAY_ACTIVE_FAINT_OPACITY = 0.22;

const createPalmLandmarks = (x: number, y: number, z = 0): LegacyLandmark[] => {
  const landmarks = Array.from({ length: 21 }, (): LegacyLandmark => ({ x: 0.5, y: 0.5, z: 0 }));
  landmarks[9] = { x, y, z };
  return landmarks;
};

const createDualResults = (leftRawX: number, leftY: number, rightRawX: number, rightY: number): LegacyHandsResults => ({
  multiHandLandmarks: [createPalmLandmarks(leftRawX, leftY), createPalmLandmarks(rightRawX, rightY)],
  multiHandedness: [{ label: "Left" }, { label: "Right" }]
});

const createSingleResults = (rawX: number, y: number): LegacyHandsResults => ({
  multiHandLandmarks: [createPalmLandmarks(rawX, y)],
  multiHandedness: [{ label: "Left" }]
});

const createSingleResultsWithLabel = (rawX: number, y: number, label?: string): LegacyHandsResults => ({
  multiHandLandmarks: [createPalmLandmarks(rawX, y)],
  multiHandedness: label ? [{ label }] : undefined
});

const createSingleCurledIndexResults = (rawX: number, y: number, label = "Left"): LegacyHandsResults => {
  const landmarks = createPalmLandmarks(rawX, y);
  landmarks[5] = { x: rawX - 0.03, y: y - 0.08, z: 0 };
  landmarks[6] = { x: rawX - 0.01, y: y + 0.05, z: 0 };
  landmarks[7] = { x: rawX + 0.06, y: y + 0.14, z: 0 };
  landmarks[8] = { x: rawX + 0.12, y: y - 0.02, z: 0 };
  return {
    multiHandLandmarks: [landmarks],
    multiHandedness: [{ label }]
  };
};

const pushResults = (controller: HandWizardController, results: LegacyHandsResults): void => {
  (controller as unknown as { handleResults: (incoming: LegacyHandsResults) => void }).handleResults(results);
};

type HandWizardControllerInternals = {
  neutralLeft: { x: number; y: number; z: number };
  neutralRight: { x: number; y: number; z: number };
  recalibrationTimerMs: number;
  recalibrationLatched: boolean;
};

const getInternals = (controller: HandWizardController): HandWizardControllerInternals =>
  controller as unknown as HandWizardControllerInternals;

const installMediaDevicesMock = (getUserMedia: () => Promise<MediaStream>): void => {
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia }
  });
};

const createMockStream = (): MediaStream =>
  ({
    getTracks: () => []
  } as unknown as MediaStream);

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("HandWizardController init fallback behavior", () => {
  it("keeps webcam visible when tracker bootstrap fails after camera stream succeeds", async () => {
    const stream = createMockStream();
    const video = document.createElement("video");
    vi.spyOn(video, "play").mockResolvedValue(undefined);
    installMediaDevicesMock(async () => stream);

    vi.spyOn(legacyMediaPipe, "loadLegacyMediaPipe").mockResolvedValue({
      ok: false,
      errorCode: "assets-load-failed"
    });

    const controller = new HandWizardController({ testMode: false, trackerMode: "default", video });
    await controller.init();

    const state = controller.getUiState();
    expect(state.webcamVisible).toBe(true);
    expect(state.cameraState).toBe("active");
    expect(state.handTrackingState).toBe("disabled");
    expect(state.trackingStateDetail).toBe("assets-load-failed");
    expect(state.wizardActive).toBe(false);
    expect(state.statusText).toBe("Camera active - hand tracking unavailable.");
  });

  it("enters ready tracking state when camera and tracker bootstrap both succeed", async () => {
    const stream = createMockStream();
    const video = document.createElement("video");
    vi.spyOn(video, "play").mockResolvedValue(undefined);
    installMediaDevicesMock(async () => stream);

    class MockHands {
      onResults(_callback: (results: LegacyHandsResults) => void): void {
        void _callback;
      }

      setOptions(_options: { maxNumHands: number; modelComplexity: number; minDetectionConfidence: number; minTrackingConfidence: number }): void {
        void _options;
      }

      async send(_payload: { image: HTMLVideoElement }): Promise<void> {
        void _payload;
      }
    }

    class MockCamera {
      constructor(_video: HTMLVideoElement, _config: { onFrame: () => Promise<void>; width: number; height: number }) {
        void _video;
        void _config;
      }

      async start(): Promise<void> {
        // no-op
      }
    }

    vi.spyOn(legacyMediaPipe, "loadLegacyMediaPipe").mockResolvedValue({
      ok: true,
      Hands: MockHands as unknown as legacyMediaPipe.LegacyHandsConstructor,
      Camera: MockCamera as unknown as legacyMediaPipe.LegacyCameraConstructor
    });

    const controller = new HandWizardController({ testMode: false, trackerMode: "default", video });
    await controller.init();

    const state = controller.getUiState();
    expect(state.webcamVisible).toBe(true);
    expect(state.cameraState).toBe("active");
    expect(state.handTrackingState).toBe("ready");
    expect(state.trackingStateDetail).toBeUndefined();
    expect(state.wizardActive).toBe(false);
  });

  it("classifies denied camera permission and keeps webcam hidden", async () => {
    const video = document.createElement("video");
    vi.spyOn(video, "play").mockResolvedValue(undefined);
    installMediaDevicesMock(async () => {
      throw new DOMException("Permission denied", "NotAllowedError");
    });

    const controller = new HandWizardController({ testMode: false, trackerMode: "default", video });
    await controller.init();

    const state = controller.getUiState();
    expect(state.webcamVisible).toBe(false);
    expect(state.cameraState).toBe("denied");
    expect(state.handTrackingState).toBe("disabled");
    expect(state.trackingStateDetail).toBe("disabled");
  });
});

describe("HandWizardController calibration overlay telemetry", () => {
  it("sets left/right readiness independently before calibration", () => {
    const controller = new HandWizardController({ testMode: false, trackerMode: "default", video: document.createElement("video") });

    pushResults(controller, createDualResults(LEFT_TARGET_RAW_X, 0.5, 0.1, 0.5));
    const state = controller.getUiState();

    expect(state.handTrackingState).toBe("ready");
    expect(state.wizardActive).toBe(false);
    expect(state.overlayOpacity).toBe(OVERLAY_READY_OPACITY);
    expect(state.debug.leftTargetReady).toBe(true);
    expect(state.debug.rightTargetReady).toBe(false);
    expect(state.debug.inCenter).toBe(false);
    expect(state.debug.calibrationTimerMs).toBe(0);
    expect(state.debug.palms).toHaveLength(2);
    expect(state.debug.palms[0].landmarks).toHaveLength(21);
    expect(state.debug.palms[1].landmarks).toHaveLength(21);
    expect(state.debug.palms[0].landmarks?.[9]).toMatchObject({ x: LEFT_TARGET_RAW_X, y: 0.5, z: 0 });
    expect(state.debug.palms[1].landmarks?.[9]).toMatchObject({ y: 0.5, z: 0 });
  });

  it("activates after both palms hold target for over 1.2s", () => {
    const controller = new HandWizardController({ testMode: false, trackerMode: "default", video: document.createElement("video") });

    for (let i = 0; i < 76; i += 1) {
      pushResults(controller, createDualResults(LEFT_TARGET_RAW_X, 0.5, RIGHT_TARGET_RAW_X, 0.5));
    }

    const state = controller.getUiState();
    expect(state.handMode).toBe("dual");
    expect(state.handTrackingState).toBe("active");
    expect(state.wizardActive).toBe(true);
    expect(state.overlayOpacity).toBe(OVERLAY_ACTIVE_FAINT_OPACITY);
    expect(state.debug.leftTargetReady).toBe(true);
    expect(state.debug.rightTargetReady).toBe(true);
    expect(state.debug.calibrationTimerMs).toBe(0);
    expect(state.debug.palms).toHaveLength(2);
    expect(state.debug.palms[0].landmarks).toHaveLength(21);
    expect(state.debug.palms[1].landmarks).toHaveLength(21);
  });

  it("resets hold timer and readiness when palms leave target zones", () => {
    const controller = new HandWizardController({ testMode: false, trackerMode: "default", video: document.createElement("video") });

    for (let i = 0; i < 20; i += 1) {
      pushResults(controller, createDualResults(LEFT_TARGET_RAW_X, 0.5, RIGHT_TARGET_RAW_X, 0.5));
    }

    let state = controller.getUiState();
    expect(state.handTrackingState).toBe("calibrating");
    expect(state.debug.calibrationTimerMs).toBeGreaterThan(0);
    expect(state.debug.inCenter).toBe(true);

    pushResults(controller, createDualResults(0.9, 0.16, 0.1, 0.84));
    state = controller.getUiState();
    expect(state.handTrackingState).toBe("ready");
    expect(state.wizardActive).toBe(false);
    expect(state.overlayOpacity).toBe(OVERLAY_READY_OPACITY);
    expect(state.debug.calibrationTimerMs).toBe(0);
    expect(state.debug.leftTargetReady).toBe(false);
    expect(state.debug.rightTargetReady).toBe(false);
    expect(state.debug.inCenter).toBe(false);
  });

  it("recalibrates neutral palms after 1.5s hold while staying active", () => {
    const controller = new HandWizardController({ testMode: false, trackerMode: "default", video: document.createElement("video") });

    for (let i = 0; i < 76; i += 1) {
      pushResults(controller, createDualResults(LEFT_TARGET_RAW_X, 0.5, RIGHT_TARGET_RAW_X, 0.5));
    }

    for (let i = 0; i < 95; i += 1) {
      pushResults(controller, createDualResults(0.68, 0.56, 0.32, 0.56));
    }

    const state = controller.getUiState();
    const internals = getInternals(controller);

    expect(state.handTrackingState).toBe("active");
    expect(state.wizardActive).toBe(true);
    expect(state.overlayOpacity).toBe(OVERLAY_ACTIVE_FAINT_OPACITY);
    expect(state.statusText).toBe("WIZARD MODE ACTIVE - Dual-hand sculpting.");
    expect(state.debug.palms).toHaveLength(2);
    expect(state.debug.palms[0].landmarks).toHaveLength(21);
    expect(state.debug.palms[1].landmarks).toHaveLength(21);
    expect(internals.neutralLeft.x).toBeCloseTo(0.68, 5);
    expect(internals.neutralRight.x).toBeCloseTo(0.32, 5);
    expect(internals.recalibrationLatched).toBe(true);
    expect(internals.recalibrationTimerMs).toBe(0);
  });

  it("recalibration latch triggers once per continuous hold and re-arms after leaving target", () => {
    const controller = new HandWizardController({ testMode: false, trackerMode: "default", video: document.createElement("video") });

    for (let i = 0; i < 76; i += 1) {
      pushResults(controller, createDualResults(LEFT_TARGET_RAW_X, 0.5, RIGHT_TARGET_RAW_X, 0.5));
    }

    for (let i = 0; i < 95; i += 1) {
      pushResults(controller, createDualResults(0.68, 0.54, 0.32, 0.54));
    }
    const internals = getInternals(controller);
    const firstLeftNeutralX = internals.neutralLeft.x;
    const firstRightNeutralX = internals.neutralRight.x;

    for (let i = 0; i < 95; i += 1) {
      pushResults(controller, createDualResults(0.66, 0.53, 0.34, 0.53));
    }
    expect(internals.neutralLeft.x).toBeCloseTo(firstLeftNeutralX, 5);
    expect(internals.neutralRight.x).toBeCloseTo(firstRightNeutralX, 5);

    pushResults(controller, createDualResults(0.9, 0.2, 0.1, 0.8));
    expect(internals.recalibrationLatched).toBe(false);
    expect(internals.recalibrationTimerMs).toBe(0);

    for (let i = 0; i < 95; i += 1) {
      pushResults(controller, createDualResults(0.62, 0.5, 0.38, 0.5));
    }

    expect(internals.neutralLeft.x).toBeCloseTo(0.62, 5);
    expect(internals.neutralRight.x).toBeCloseTo(0.38, 5);
    expect(controller.getUiState().debug.palms[0].landmarks).toHaveLength(21);
    expect(controller.getUiState().debug.palms[1].landmarks).toHaveLength(21);
    expect(controller.getUiState().overlayOpacity).toBe(OVERLAY_ACTIVE_FAINT_OPACITY);
  });

  it("carries full palm landmarks in single-hand debug payload", () => {
    const controller = new HandWizardController({ testMode: false, trackerMode: "default", video: document.createElement("video") });

    pushResults(controller, createSingleResults(0.52, 0.47));
    let state = controller.getUiState();

    expect(state.handTrackingState).toBe("ready");
    expect(state.handMode).toBe("none");
    expect(state.debug.palms).toHaveLength(1);
    expect(state.debug.palms[0].role).toBe("single");
    expect(state.debug.palms[0].landmarks).toHaveLength(21);
    expect(state.debug.palms[0].landmarks?.[9]).toMatchObject({ x: 0.52, y: 0.47, z: 0 });
    expect(state.debug.leftTargetReady).toBe(false);
    expect(state.debug.rightTargetReady).toBe(false);
    expect(state.debug.calibrationTimerMs).toBe(0);
    expect(state.debug.singleRole).toBe("left");

    for (let i = 0; i < 60; i += 1) {
      pushResults(controller, createSingleResults(0.52, 0.47));
    }

    state = controller.getUiState();
    expect(state.handTrackingState).toBe("active");
    expect(state.handMode).toBe("single");
    expect(state.debug.palms).toHaveLength(1);
    expect(state.debug.palms[0].landmarks).toHaveLength(21);
    expect(state.debug.palms[0].landmarks?.[9]).toMatchObject({ x: 0.52, y: 0.47, z: 0 });
    expect(state.debug.singleRole).toBe("left");
    expect(state.debug.mappedFingerCurlsLeft).toBeDefined();
    expect(state.debug.mappedFingerCurlsRight).toBeDefined();
  });

  it("exposes independent left and right hand states during dual control", () => {
    const controller = new HandWizardController({ testMode: false, trackerMode: "default", video: document.createElement("video") });

    for (let i = 0; i < 76; i += 1) {
      pushResults(controller, createDualResults(LEFT_TARGET_RAW_X, 0.5, RIGHT_TARGET_RAW_X, 0.5));
    }

    pushResults(controller, createDualResults(0.68, 0.5, 0.32, 0.5));
    const leftOffset = controller.getLeftOffset();
    const rightOffset = controller.getRightOffset();
    const leftScale = controller.getLeftScale();
    const rightScale = controller.getRightScale();

    expect(leftOffset.x).toBeGreaterThan(0);
    expect(rightOffset.x).toBeLessThan(0);
    expect(leftScale).toBeGreaterThan(0);
    expect(rightScale).toBeGreaterThan(0);

    const debug = controller.getUiState().debug;
    expect(debug.mappedOffsetLeft.x).toBeGreaterThan(0);
    expect(debug.mappedOffsetRight.x).toBeLessThan(0);
    expect(debug.mappedScaleLeft).toBeGreaterThan(0);
    expect(debug.mappedScaleRight).toBeGreaterThan(0);
    expect(debug.mappedFingerCurlsLeft).toBeDefined();
    expect(debug.mappedFingerCurlsRight).toBeDefined();
    expect(debug.singleRole).toBeUndefined();
  });

  it("prefers handedness label, with mirrored-x fallback for single-role mapping", () => {
    const controller = new HandWizardController({ testMode: false, trackerMode: "default", video: document.createElement("video") });

    pushResults(controller, createSingleResultsWithLabel(0.2, 0.5, "Right"));
    expect(controller.getUiState().debug.singleRole).toBe("right");

    pushResults(controller, createSingleResultsWithLabel(0.72, 0.5, undefined));
    expect(controller.getUiState().debug.singleRole).toBe("left");

    pushResults(controller, createSingleResultsWithLabel(0.24, 0.5, undefined));
    expect(controller.getUiState().debug.singleRole).toBe("right");
  });

  it("smoothly decays finger curls during degraded tracking", () => {
    const controller = new HandWizardController({ testMode: false, trackerMode: "default", video: document.createElement("video") });

    for (let i = 0; i < 64; i += 1) {
      pushResults(controller, createSingleCurledIndexResults(0.6, 0.5));
    }

    const initialCurl = controller.getLeftFingerCurls().index;
    expect(initialCurl).toBeGreaterThan(0.2);

    const internals = controller as unknown as { started: boolean; lastHandTime: number };
    internals.started = true;
    internals.lastHandTime = Date.now() - 700;
    controller.update(1 / 60, 1.25);

    const degradedCurl = controller.getLeftFingerCurls().index;
    expect(degradedCurl).toBeLessThan(initialCurl);
    expect(degradedCurl).toBeGreaterThanOrEqual(0);
  });
});
