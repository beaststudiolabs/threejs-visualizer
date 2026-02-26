export type TemplateId =
  | "wireframeBlob"
  | "spiroRing"
  | "pointCloudOrb"
  | "modelEdges"
  | "modelVertexGlow";

export type Curve = "linear" | "exp" | "log" | "smoothstep";

export type ParamType = "number" | "boolean" | "select" | "color";

export type ParamSchemaItem =
  | {
      key: string;
      type: "number";
      label: string;
      group: string;
      min: number;
      max: number;
      step?: number;
      default: number;
      curve?: Curve;
      description?: string;
    }
  | {
      key: string;
      type: "boolean";
      label: string;
      group: string;
      default: boolean;
      description?: string;
    }
  | {
      key: string;
      type: "select";
      label: string;
      group: string;
      default: string;
      options: { label: string; value: string }[];
      description?: string;
    }
  | {
      key: string;
      type: "color";
      label: string;
      group: string;
      default: string;
      description?: string;
    };

export type ParamSchema = ParamSchemaItem[];

export type AudioFeatures = {
  rms: number;
  bass: number;
  mids: number;
  highs: number;
  spectrum: Float32Array;
  waveform: Float32Array;
};

export type MidiCC = {
  cc: number;
  value: number;
  ts: number;
};

export type MidiState = {
  connected: boolean;
  deviceName?: string;
  cc: Record<number, number>;
  last?: MidiCC;
};

export type MotionState = {
  enabled: boolean;
  intensity: number;
};

export type CameraMode = "orbit" | "fly";

export type CameraState = {
  mode: CameraMode;
  position: [number, number, number];
  target: [number, number, number];
  fov: number;
};

export type Palette = {
  background: string;
  primary: string;
  secondary: string;
  accent: string;
};

export type ModulatorType = "audioBand" | "audioRms" | "midiCC" | "motion" | "lfo";

export type Modulator = {
  id: string;
  type: ModulatorType;
  source?: string;
  targetParam: string;
  amount: number;
  min: number;
  max: number;
  curve: Curve;
  enabled: boolean;
};

export type PresetV1 = {
  version: 1;
  name: string;
  templateId: TemplateId;
  seed: number;
  params: Record<string, number | boolean | string>;
  camera: CameraState;
  palette: Palette;
  modulators: Modulator[];
  midiMappings: Array<{
    cc: number;
    targetParam: string;
    min: number;
    max: number;
    curve: Curve;
  }>;
};
