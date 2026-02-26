import type { AudioFeatures, MidiState, MotionState, ParamSchema, TemplateId } from "./types";
import type * as THREE from "three";

export type TemplateContext = {
  scene: THREE.Scene;
  renderer: THREE.WebGLRenderer;
  camera: THREE.Camera;
  gl: HTMLCanvasElement;
};

export type TemplateRuntime = {
  t: number;
  loopT: number;
  dt: number;
  seed: number;
  audio: AudioFeatures;
  midi: MidiState;
  motion: MotionState;
  params: Record<string, any>;
};

export interface VisualizerTemplate {
  id: TemplateId;
  label: string;
  getParamSchema(): ParamSchema;
  getDefaultParams(): Record<string, any>;
  init(ctx: TemplateContext, params: Record<string, any>): void;
  update(runtime: TemplateRuntime): void;
  dispose(): void;
}
