import { create } from "zustand";
import type { ParamSchema, PresetV1, TemplateId, CameraState, Palette, Modulator } from "../../contracts/types";

export type DockId = "left" | "right" | "bottom";

export type FrameInfo = {
  fps: number;
  t: number;
  loopT: number;
  audioRms: number;
  motion: number;
};

export type ParamValue = number | boolean | string;

const DEFAULT_CAMERA: CameraState = {
  mode: "orbit",
  position: [0, 0, 5],
  target: [0, 0, 0],
  fov: 60
};

const DEFAULT_PALETTE: Palette = {
  background: "#050508",
  primary: "#43ffd0",
  secondary: "#9ecbff",
  accent: "#ffaf45"
};

type AppState = {
  templateId: TemplateId;
  seed: number;
  loopDurationSec: number;
  paused: boolean;
  fixedTimeSec?: number;
  params: Record<string, ParamValue>;
  paramSchema: ParamSchema;
  palette: Palette;
  camera: CameraState;
  modulators: Modulator[];
  midiMappings: PresetV1["midiMappings"];
  panelCollapsed: Record<DockId, boolean>;
  frameInfo: FrameInfo;

  initializeTemplate: (
    templateId: TemplateId,
    schema: ParamSchema,
    defaults: Record<string, ParamValue>
  ) => void;
  setTemplateId: (templateId: TemplateId) => void;
  setSeed: (seed: number) => void;
  setLoopDurationSec: (seconds: number) => void;
  setPaused: (paused: boolean) => void;
  setFixedTimeSec: (time?: number) => void;
  setParam: (key: string, value: ParamValue) => void;
  setParams: (params: Record<string, ParamValue>) => void;
  setPalette: (palette: Palette) => void;
  togglePanel: (dock: DockId) => void;
  setFrameInfo: (info: FrameInfo) => void;

  addModulator: (mod: Modulator) => void;
  updateModulator: (id: string, patch: Partial<Modulator>) => void;
  removeModulator: (id: string) => void;

  applyPreset: (preset: PresetV1) => void;
  createPreset: (name: string) => PresetV1;
};

export const useAppStore = create<AppState>((set, get) => ({
  templateId: "wireframeBlob",
  seed: 1337,
  loopDurationSec: 4,
  paused: false,
  fixedTimeSec: undefined,
  params: {},
  paramSchema: [],
  palette: DEFAULT_PALETTE,
  camera: DEFAULT_CAMERA,
  modulators: [],
  midiMappings: [],
  panelCollapsed: {
    left: false,
    right: false,
    bottom: false
  },
  frameInfo: {
    fps: 0,
    t: 0,
    loopT: 0,
    audioRms: 0,
    motion: 0
  },

  initializeTemplate: (templateId, schema, defaults) =>
    set((state) => ({
      templateId,
      paramSchema: schema,
      params: {
        ...defaults,
        ...Object.fromEntries(Object.entries(state.params).filter(([key]) => key in defaults))
      }
    })),

  setTemplateId: (templateId) => set({ templateId }),
  setSeed: (seed) => set({ seed }),
  setLoopDurationSec: (loopDurationSec) => set({ loopDurationSec }),
  setPaused: (paused) => set({ paused }),
  setFixedTimeSec: (fixedTimeSec) => set({ fixedTimeSec }),
  setParam: (key, value) => set((state) => ({ params: { ...state.params, [key]: value } })),
  setParams: (params) => set({ params }),
  setPalette: (palette) => set({ palette }),
  togglePanel: (dock) =>
    set((state) => ({
      panelCollapsed: {
        ...state.panelCollapsed,
        [dock]: !state.panelCollapsed[dock]
      }
    })),
  setFrameInfo: (frameInfo) => set({ frameInfo }),

  addModulator: (mod) => set((state) => ({ modulators: [...state.modulators, mod] })),
  updateModulator: (id, patch) =>
    set((state) => ({
      modulators: state.modulators.map((mod) => (mod.id === id ? { ...mod, ...patch } : mod))
    })),
  removeModulator: (id) =>
    set((state) => ({
      modulators: state.modulators.filter((mod) => mod.id !== id)
    })),

  applyPreset: (preset) =>
    set({
      templateId: preset.templateId,
      seed: preset.seed,
      params: preset.params,
      camera: preset.camera,
      palette: preset.palette,
      modulators: preset.modulators,
      midiMappings: preset.midiMappings
    }),

  createPreset: (name) => {
    const state = get();
    return {
      version: 1,
      name,
      templateId: state.templateId,
      seed: state.seed,
      params: state.params,
      camera: state.camera,
      palette: state.palette,
      modulators: state.modulators,
      midiMappings: state.midiMappings
    };
  }
}));
