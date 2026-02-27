import type { CameraState, Modulator, Palette, PresetV1, TemplateId } from "../contracts/types";

type PresetParams = Record<string, number | boolean | string>;

type FactoryPresetConfig = {
  name: string;
  templateId: TemplateId;
  seed: number;
  params: PresetParams;
  modulators?: Modulator[];
};

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

const gradient = (
  stops: number,
  color: string,
  color2: string,
  color3: string,
  color4: string,
  color5: string
): PresetParams => ({
  gradientStops: stops,
  color,
  color2,
  color3,
  color4,
  color5
});

const autoMidi = (targetParam: string, cc = 48): Modulator => ({
  id: `auto:${targetParam}:midi`,
  type: "midiCC",
  source: `cc:${cc}`,
  targetParam,
  amount: 1,
  min: 0,
  max: 1,
  curve: "linear",
  enabled: true
});

const autoMotion = (targetParam: string): Modulator => ({
  id: `auto:${targetParam}:motion`,
  type: "motion",
  targetParam,
  amount: 1,
  min: 0,
  max: 1,
  curve: "linear",
  enabled: true
});

const autoAudio = (targetParam: string, source: "rms" | "bass" | "mids" | "highs"): Modulator => ({
  id: `auto:${targetParam}:audio`,
  type: "audioBand",
  source,
  targetParam,
  amount: 1,
  min: 0,
  max: 1,
  curve: "linear",
  enabled: true
});

const FACTORY_CONFIGS: FactoryPresetConfig[] = [
  {
    name: "wf-neon-lattice",
    templateId: "wireframeBlob",
    seed: 1101,
    params: {
      density: 2,
      rotationSpeed: 0.7,
      scale: 1.1,
      ...gradient(2, "#43ffd0", "#2b74ff", "#8aa3ff", "#ff7ac9", "#ffaf45")
    }
  },
  {
    name: "wf-hotline-cage",
    templateId: "wireframeBlob",
    seed: 1102,
    params: {
      density: 3,
      rotationSpeed: 1.2,
      scale: 0.95,
      ...gradient(3, "#ff5a5f", "#ffc371", "#6ef3d6", "#5b8cff", "#f39cff")
    },
    modulators: [autoMidi("rotationSpeed", 48)]
  },
  {
    name: "wf-prism-swell",
    templateId: "wireframeBlob",
    seed: 1103,
    params: {
      density: 4,
      rotationSpeed: 0.45,
      scale: 1.4,
      ...gradient(4, "#8ef6ff", "#90beff", "#b79dff", "#ff9ece", "#ffe28a")
    },
    modulators: [autoAudio("scale", "bass")]
  },
  {
    name: "wf-static-core",
    templateId: "wireframeBlob",
    seed: 1104,
    params: {
      density: 1,
      rotationSpeed: 0.18,
      scale: 1,
      ...gradient(2, "#9ecbff", "#43ffd0", "#8aa3ff", "#ff7ac9", "#ffaf45")
    }
  },
  {
    name: "wf-vector-storm",
    templateId: "wireframeBlob",
    seed: 1105,
    params: {
      density: 5,
      rotationSpeed: 1.6,
      scale: 1.35,
      ...gradient(5, "#7ae1ff", "#4ab7ff", "#6865ff", "#c56bff", "#ff8aad")
    },
    modulators: [autoMotion("density"), autoAudio("scale", "mids")]
  },
  {
    name: "wf-calm-shell",
    templateId: "wireframeBlob",
    seed: 1106,
    params: {
      density: 2,
      rotationSpeed: 0.3,
      scale: 0.78,
      ...gradient(3, "#d9f7ff", "#9ecbff", "#43ffd0", "#ffaf45", "#ff7ac9")
    }
  },
  {
    name: "spiro-solar-loop",
    templateId: "spiroRing",
    seed: 1201,
    params: {
      radius: 1.8,
      detail: 240,
      twist: 7,
      ...gradient(2, "#ffaf45", "#ff5e7d", "#a674ff", "#57ccff", "#43ffd0")
    }
  },
  {
    name: "spiro-chrome-wave",
    templateId: "spiroRing",
    seed: 1202,
    params: {
      radius: 2.2,
      detail: 320,
      twist: 11,
      ...gradient(3, "#8df3ff", "#8a9dff", "#f793ff", "#ffd166", "#43ffd0")
    },
    modulators: [autoMidi("twist", 49)]
  },
  {
    name: "spiro-tight-braid",
    templateId: "spiroRing",
    seed: 1203,
    params: {
      radius: 1.2,
      detail: 420,
      twist: 13,
      ...gradient(4, "#57ccff", "#4361ee", "#7209b7", "#f72585", "#f9c74f")
    },
    modulators: [autoMotion("radius")]
  },
  {
    name: "spiro-orbit-silk",
    templateId: "spiroRing",
    seed: 1204,
    params: {
      radius: 2.8,
      detail: 280,
      twist: 5,
      ...gradient(5, "#ffadad", "#ffd6a5", "#fdffb6", "#caffbf", "#9bf6ff")
    }
  },
  {
    name: "spiro-sharp-prism",
    templateId: "spiroRing",
    seed: 1205,
    params: {
      radius: 1.45,
      detail: 512,
      twist: 16,
      ...gradient(5, "#f94144", "#f3722c", "#f8961e", "#90be6d", "#577590")
    },
    modulators: [autoAudio("twist", "highs")]
  },
  {
    name: "spiro-slow-halo",
    templateId: "spiroRing",
    seed: 1206,
    params: {
      radius: 2.4,
      detail: 160,
      twist: 3,
      ...gradient(2, "#9ecbff", "#43ffd0", "#8aa3ff", "#ff7ac9", "#ffaf45")
    }
  },
  {
    name: "orb-frost-drift",
    templateId: "pointCloudOrb",
    seed: 1301,
    params: {
      density: 1800,
      radius: 1.4,
      rotationSpeed: 0.6,
      ...gradient(2, "#9ecbff", "#4cc9f0", "#43ffd0", "#ffe66d", "#ff6b9f")
    }
  },
  {
    name: "orb-burst-grid",
    templateId: "pointCloudOrb",
    seed: 1302,
    params: {
      density: 3600,
      radius: 1.8,
      rotationSpeed: 1.3,
      ...gradient(3, "#48cae4", "#00b4d8", "#90e0ef", "#caf0f8", "#ff6b9f")
    },
    modulators: [autoMidi("rotationSpeed", 50)]
  },
  {
    name: "orb-comet-shell",
    templateId: "pointCloudOrb",
    seed: 1303,
    params: {
      density: 5200,
      radius: 2.2,
      rotationSpeed: 0.35,
      ...gradient(4, "#ffd166", "#ef476f", "#8338ec", "#3a86ff", "#06d6a0")
    },
    modulators: [autoAudio("radius", "bass")]
  },
  {
    name: "orb-deep-space",
    templateId: "pointCloudOrb",
    seed: 1304,
    params: {
      density: 2200,
      radius: 2.9,
      rotationSpeed: 0.2,
      ...gradient(5, "#03045e", "#023e8a", "#0077b6", "#0096c7", "#00b4d8")
    }
  },
  {
    name: "orb-vibrant-core",
    templateId: "pointCloudOrb",
    seed: 1305,
    params: {
      density: 7000,
      radius: 1.1,
      rotationSpeed: 2.1,
      ...gradient(5, "#ff595e", "#ffca3a", "#8ac926", "#1982c4", "#6a4c93")
    },
    modulators: [autoMotion("density")]
  },
  {
    name: "orb-micro-noise",
    templateId: "pointCloudOrb",
    seed: 1306,
    params: {
      density: 9800,
      radius: 0.8,
      rotationSpeed: 0.95,
      ...gradient(3, "#d9ed92", "#99d98c", "#52b69a", "#34a0a4", "#168aad")
    }
  },
  {
    name: "edges-clean-blueprint",
    templateId: "modelEdges",
    seed: 1401,
    params: {
      rotationSpeed: 0.4,
      ...gradient(2, "#ffffff", "#7ec8ff", "#84fab0", "#ffe66d", "#ff8f8f")
    }
  },
  {
    name: "edges-ember-trace",
    templateId: "modelEdges",
    seed: 1402,
    params: {
      rotationSpeed: 0.75,
      ...gradient(3, "#ffe066", "#ff922b", "#fa5252", "#c2255c", "#f783ac")
    },
    modulators: [autoAudio("rotationSpeed", "mids")]
  },
  {
    name: "edges-ice-shard",
    templateId: "modelEdges",
    seed: 1403,
    params: {
      rotationSpeed: 1.2,
      ...gradient(4, "#caf0f8", "#90e0ef", "#00b4d8", "#0077b6", "#023e8a")
    },
    modulators: [autoMidi("rotationSpeed", 51)]
  },
  {
    name: "edges-spectrum-weld",
    templateId: "modelEdges",
    seed: 1404,
    params: {
      rotationSpeed: 2,
      ...gradient(5, "#f94144", "#f3722c", "#f8961e", "#f9c74f", "#90be6d")
    }
  },
  {
    name: "edges-soft-ghost",
    templateId: "modelEdges",
    seed: 1405,
    params: {
      rotationSpeed: 0.12,
      ...gradient(2, "#d7e3fc", "#edf2fb", "#abc4ff", "#ffcf99", "#f7b267")
    }
  },
  {
    name: "edges-motion-wire",
    templateId: "modelEdges",
    seed: 1406,
    params: {
      rotationSpeed: 0.55,
      ...gradient(5, "#00f5d4", "#00bbf9", "#9b5de5", "#f15bb5", "#fee440")
    },
    modulators: [autoMotion("rotationSpeed")]
  },
  {
    name: "glow-sunflare",
    templateId: "modelVertexGlow",
    seed: 1501,
    params: {
      pointSize: 0.04,
      glowAmount: 1,
      rotationSpeed: 0.3,
      ...gradient(2, "#ffd86b", "#ff8f8f", "#a27dff", "#57ccff", "#43ffd0")
    }
  },
  {
    name: "glow-synth-dust",
    templateId: "modelVertexGlow",
    seed: 1502,
    params: {
      pointSize: 0.02,
      glowAmount: 1.6,
      rotationSpeed: 0.8,
      ...gradient(3, "#ff5d8f", "#ff99c8", "#b8c0ff", "#a0c4ff", "#9bf6ff")
    },
    modulators: [autoMidi("pointSize", 52)]
  },
  {
    name: "glow-nebula-veil",
    templateId: "modelVertexGlow",
    seed: 1503,
    params: {
      pointSize: 0.08,
      glowAmount: 0.7,
      rotationSpeed: 0.15,
      ...gradient(4, "#f72585", "#b5179e", "#7209b7", "#3a0ca3", "#4361ee")
    },
    modulators: [autoAudio("glowAmount", "rms")]
  },
  {
    name: "glow-aurora-points",
    templateId: "modelVertexGlow",
    seed: 1504,
    params: {
      pointSize: 0.05,
      glowAmount: 1.3,
      rotationSpeed: 0.55,
      ...gradient(5, "#80ffdb", "#72efdd", "#64dfdf", "#56cfe1", "#5390d9")
    }
  },
  {
    name: "glow-tight-beam",
    templateId: "modelVertexGlow",
    seed: 1505,
    params: {
      pointSize: 0.01,
      glowAmount: 2,
      rotationSpeed: 1.1,
      ...gradient(5, "#ff6b6b", "#feca57", "#1dd1a1", "#48dbfb", "#5f27cd")
    },
    modulators: [autoMotion("rotationSpeed")]
  },
  {
    name: "glow-haze-cloud",
    templateId: "modelVertexGlow",
    seed: 1506,
    params: {
      pointSize: 0.12,
      glowAmount: 0.35,
      rotationSpeed: 0.05,
      ...gradient(3, "#f8edeb", "#e8e8e4", "#d8e2dc", "#ece4db", "#ffe5d9")
    }
  }
];

export const FACTORY_PRESETS: PresetV1[] = FACTORY_CONFIGS.map((config) => ({
  version: 1,
  name: config.name,
  templateId: config.templateId,
  seed: config.seed,
  params: { ...config.params },
  camera: {
    ...DEFAULT_CAMERA,
    position: [...DEFAULT_CAMERA.position] as [number, number, number],
    target: [...DEFAULT_CAMERA.target] as [number, number, number]
  },
  palette: { ...DEFAULT_PALETTE },
  modulators: (config.modulators ?? []).map((mod) => ({ ...mod })),
  midiMappings: []
}));
