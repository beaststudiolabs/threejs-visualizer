import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { TemplateRuntime } from "../contracts/schema";
import type { AudioFeatures, Modulator, MotionState, MidiState, TemplateId } from "../contracts/types";
import type * as THREE from "three";
import { InputHotkeys } from "../core/InputHotkeys";
import { RendererCore } from "../core/RendererCore";
import { DebugOverlay } from "../dev/DebugOverlay";
import { AudioEngine } from "../engines/AudioEngine";
import { MidiEngine } from "../engines/MidiEngine";
import { ModelEngine } from "../engines/ModelEngine";
import { WebcamEngine } from "../engines/WebcamEngine";
import { Exporter } from "../export/Exporter";
import { ModulatorEngine } from "../modulators/ModulatorEngine";
import { createDefaultModulator } from "../modulators/modulators";
import { PresetManager } from "../presets/PresetManager";
import { createTemplateRegistry } from "../templates/TemplateRegistry";
import { DockLayout } from "./layout/DockLayout";
import { AudioPanel } from "./panels/AudioPanel";
import { ExportPanel } from "./panels/ExportPanel";
import { HotkeysPanel } from "./panels/HotkeysPanel";
import { MidiPanel } from "./panels/MidiPanel";
import { ParamsPanel } from "./panels/ParamsPanel";
import { PresetsPanel } from "./panels/PresetsPanel";
import { TemplatePanel } from "./panels/TemplatePanel";
import { WebcamPanel } from "./panels/WebcamPanel";
import { useAppStore } from "./store/useAppStore";

const EMPTY_AUDIO: AudioFeatures = {
  rms: 0,
  bass: 0,
  mids: 0,
  highs: 0,
  spectrum: new Float32Array(512),
  waveform: new Float32Array(1024)
};

const EMPTY_MIDI: MidiState = {
  connected: false,
  cc: {}
};

const EMPTY_MOTION: MotionState = {
  enabled: false,
  intensity: 0
};

type QueryConfig = {
  template?: TemplateId;
  seed?: number;
  loop?: number;
  t?: number;
  width?: number;
  height?: number;
  testMode: boolean;
};

const parseQueryConfig = (): QueryConfig => {
  const params = new URLSearchParams(window.location.search);
  const templateRaw = params.get("template") ?? undefined;
  const validTemplateIds: TemplateId[] = [
    "wireframeBlob",
    "spiroRing",
    "pointCloudOrb",
    "modelEdges",
    "modelVertexGlow"
  ];

  const template = validTemplateIds.includes(templateRaw as TemplateId)
    ? (templateRaw as TemplateId)
    : undefined;

  const parseNumber = (key: string): number | undefined => {
    const raw = params.get(key);
    if (!raw) return undefined;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : undefined;
  };

  return {
    template,
    seed: parseNumber("seed"),
    loop: parseNumber("loop"),
    t: parseNumber("t"),
    width: parseNumber("width"),
    height: parseNumber("height"),
    testMode: params.get("testMode") === "1"
  };
};

const downloadText = (filename: string, content: string): void => {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

const downloadBlob = (filename: string, blob: Blob): void => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

export const App = (): JSX.Element => {
  const registry = useMemo(() => createTemplateRegistry(), []);
  const templates = useMemo(() => registry.list(), [registry]);
  const query = useMemo(() => parseQueryConfig(), []);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<RendererCore | undefined>(undefined);
  const audioRef = useRef(new AudioEngine({ mock: query.testMode }));
  const midiRef = useRef(new MidiEngine());
  const modelRef = useRef(new ModelEngine());
  const webcamRef = useRef(new WebcamEngine());
  const modulatorEngineRef = useRef(new ModulatorEngine());
  const presetManagerRef = useRef(new PresetManager());
  const exporterRef = useRef(new Exporter());
  const hotkeysRef = useRef(new InputHotkeys());

  const [audioFeatures, setAudioFeatures] = useState<AudioFeatures>(EMPTY_AUDIO);
  const [midiState, setMidiState] = useState<MidiState>(EMPTY_MIDI);
  const [motionState, setMotionState] = useState<MotionState>(EMPTY_MOTION);
  const [presetNames, setPresetNames] = useState<string[]>([]);
  const [mockAudio, setMockAudio] = useState(query.testMode);
  const [mockMidi, setMockMidi] = useState(query.testMode);
  const [mockWebcam, setMockWebcam] = useState(query.testMode);
  const [loadedModel, setLoadedModel] = useState<THREE.Object3D | undefined>(undefined);

  const templateId = useAppStore((s) => s.templateId);
  const seed = useAppStore((s) => s.seed);
  const params = useAppStore((s) => s.params);
  const paramSchema = useAppStore((s) => s.paramSchema);
  const modulators = useAppStore((s) => s.modulators);
  const panelCollapsed = useAppStore((s) => s.panelCollapsed);
  const loopDurationSec = useAppStore((s) => s.loopDurationSec);
  const fixedTimeSec = useAppStore((s) => s.fixedTimeSec);
  const frameInfo = useAppStore((s) => s.frameInfo);

  const initializeTemplate = useAppStore((s) => s.initializeTemplate);
  const setSeed = useAppStore((s) => s.setSeed);
  const setLoopDurationSec = useAppStore((s) => s.setLoopDurationSec);
  const setFixedTimeSec = useAppStore((s) => s.setFixedTimeSec);
  const setParam = useAppStore((s) => s.setParam);
  const togglePanel = useAppStore((s) => s.togglePanel);
  const setFrameInfo = useAppStore((s) => s.setFrameInfo);
  const addModulator = useAppStore((s) => s.addModulator);
  const updateModulator = useAppStore((s) => s.updateModulator);
  const removeModulator = useAppStore((s) => s.removeModulator);
  const applyPreset = useAppStore((s) => s.applyPreset);
  const createPreset = useAppStore((s) => s.createPreset);

  const refreshPresetNames = useCallback(() => {
    setPresetNames(presetManagerRef.current.list().map((preset) => preset.name));
  }, []);

  const applyTemplate = useCallback(
    (nextTemplateId: TemplateId) => {
      const template = registry.get(nextTemplateId);
      initializeTemplate(nextTemplateId, template.getParamSchema(), template.getDefaultParams());
      rendererRef.current?.setTemplate(template, {
        ...useAppStore.getState().params,
        model: loadedModel
      });
    },
    [initializeTemplate, loadedModel, registry]
  );

  useEffect(() => {
    const initialTemplateId = query.template ?? templates[0]?.id ?? "wireframeBlob";
    applyTemplate(initialTemplateId);

    if (typeof query.seed === "number") {
      setSeed(query.seed);
    }

    if (typeof query.loop === "number") {
      setLoopDurationSec(query.loop);
    }

    if (typeof query.t === "number") {
      setFixedTimeSec(query.t);
    }

    refreshPresetNames();
  }, [applyTemplate, query, refreshPresetNames, setFixedTimeSec, setLoopDurationSec, setSeed, templates]);

  useEffect(() => {
    audioRef.current.setMockEnabled(mockAudio);
  }, [mockAudio]);

  useEffect(() => {
    midiRef.current.setMockEnabled(mockMidi);
  }, [mockMidi]);

  useEffect(() => {
    webcamRef.current.setMockEnabled(mockWebcam);
  }, [mockWebcam]);

  useEffect(() => {
    const runtimeSource = {
      getAudio: (): AudioFeatures => {
        audioRef.current.update(1 / 60);
        return audioRef.current.getFeatures();
      },
      getMidi: (): MidiState => midiRef.current.getState(),
      getMotion: (): MotionState => {
        webcamRef.current.update(1 / 60);
        return webcamRef.current.getState();
      },
      getBaseParams: (): Record<string, number | boolean | string> => useAppStore.getState().params,
      resolveParams: (
        runtimeBase: Omit<TemplateRuntime, "params">,
        baseParams: Record<string, number | boolean | string>
      ): Record<string, number | boolean | string> => {
        return modulatorEngineRef.current.apply(
          baseParams,
          { ...runtimeBase, params: baseParams },
          useAppStore.getState().modulators
        );
      }
    };

    rendererRef.current = new RendererCore({
      timebase: {
        loopDurationSec: useAppStore.getState().loopDurationSec,
        fixedTimeSec: useAppStore.getState().fixedTimeSec
      },
      runtime: runtimeSource,
      onFrame: (runtime, fps) => {
        setFrameInfo({
          fps,
          t: runtime.t,
          loopT: runtime.loopT,
          audioRms: runtime.audio.rms,
          motion: runtime.motion.intensity
        });
        setAudioFeatures(runtime.audio);
        setMidiState(runtime.midi);
        setMotionState(runtime.motion);
      }
    });

    const canvas = canvasRef.current;
    if (!canvas) return;

    rendererRef.current.init(canvas);

    const initialTemplate = registry.get(useAppStore.getState().templateId);
    rendererRef.current.setTemplate(initialTemplate, {
      ...useAppStore.getState().params,
      model: loadedModel
    });
    rendererRef.current.setSeed(useAppStore.getState().seed);
    rendererRef.current.start();

    const resizeObserver = new ResizeObserver(() => {
      const parent = canvas.parentElement;
      if (!parent) return;
      rendererRef.current?.resize(parent.clientWidth, parent.clientHeight);
    });

    const parent = canvas.parentElement;
    if (parent) {
      resizeObserver.observe(parent);
      rendererRef.current.resize(parent.clientWidth, parent.clientHeight);
    }

    hotkeysRef.current.bind({
      toggleLeft: () => togglePanel("left"),
      toggleRight: () => togglePanel("right"),
      toggleBottom: () => togglePanel("bottom")
    });

    Promise.allSettled([audioRef.current.init(), midiRef.current.init(), webcamRef.current.init()]).catch(() => {
      // Keep runtime resilient when browser permissions or APIs are unavailable.
    });

    return () => {
      resizeObserver.disconnect();
      hotkeysRef.current.dispose();
      rendererRef.current?.dispose();
      audioRef.current.dispose();
      midiRef.current.dispose();
      modelRef.current.dispose();
      webcamRef.current.dispose();
    };
  }, [loadedModel, registry, setFrameInfo, togglePanel]);

  useEffect(() => {
    rendererRef.current?.setSeed(seed);
  }, [seed]);

  useEffect(() => {
    rendererRef.current?.setLoopDuration(loopDurationSec);
  }, [loopDurationSec]);

  useEffect(() => {
    rendererRef.current?.setFixedTime(fixedTimeSec);
  }, [fixedTimeSec]);

  useEffect(() => {
    const template = registry.get(templateId);
    rendererRef.current?.setTemplate(template, {
      ...useAppStore.getState().params,
      model: loadedModel
    });
  }, [loadedModel, registry, templateId]);

  const handleTemplateChange = (id: TemplateId): void => {
    applyTemplate(id);
  };

  const handleSavePreset = (name: string): void => {
    const preset = createPreset(name || "untitled");
    presetManagerRef.current.save(preset);
    refreshPresetNames();
  };

  const handleLoadPreset = (name: string): void => {
    const preset = presetManagerRef.current.load(name);
    if (!preset) return;

    applyPreset(preset);
    applyTemplate(preset.templateId);
    setSeed(preset.seed);
  };

  const handleDeletePreset = (name: string): void => {
    presetManagerRef.current.remove(name);
    refreshPresetNames();
  };

  const handleImportPreset = (content: string): void => {
    const preset = presetManagerRef.current.import(content);
    applyPreset(preset);
    applyTemplate(preset.templateId);
    refreshPresetNames();
  };

  const handleExportPresetJson = (name: string): void => {
    const json = presetManagerRef.current.export(name);
    downloadText(`${name}.preset.json`, json);
  };

  const handleExportZip = (): void => {
    const preset = createPreset("export");
    const { blob } = exporterRef.current.exportProjectZip(preset);
    downloadBlob("vibeviz-export.zip", blob);
  };

  const handleExportEmbed = (): void => {
    const preset = createPreset("embed");
    const html = exporterRef.current.exportEmbedHtml(preset);
    downloadText("vibeviz-embed.html", html);
  };

  const handleCopyEmbed = (): void => {
    const preset = createPreset("embed");
    const html = exporterRef.current.exportEmbedHtml(preset);
    void navigator.clipboard?.writeText(html);
  };

  const handleModelUpload = (file: File): void => {
    void modelRef.current.loadGLB(file).then((model) => {
      setLoadedModel(model);
      const template = registry.get(useAppStore.getState().templateId);
      rendererRef.current?.setTemplate(template, {
        ...useAppStore.getState().params,
        model
      });
    });
  };

  const modulatorTargetOptions = paramSchema.map((item) => item.key);

  const handleAddModulator = (): void => {
    const target = modulatorTargetOptions[0];
    if (!target) return;
    addModulator(createDefaultModulator(target));
  };

  const leftDock = (
    <>
      <TemplatePanel
        templates={templates}
        selectedTemplateId={templateId}
        seed={seed}
        onTemplateChange={handleTemplateChange}
        onSeedChange={setSeed}
        onModelUpload={handleModelUpload}
      />
      <ParamsPanel schema={paramSchema} params={params} onParamChange={setParam} />
    </>
  );

  const rightDock = (
    <>
      <AudioPanel
        features={audioFeatures}
        mockEnabled={mockAudio}
        onMockToggle={setMockAudio}
        onUpload={(file) => {
          void audioRef.current.loadFile(file);
        }}
        onPlay={() => {
          void audioRef.current.play();
        }}
        onPause={() => audioRef.current.pause()}
      />
      <MidiPanel
        state={midiState}
        mockEnabled={mockMidi}
        onMockToggle={setMockMidi}
        onInjectCc={(cc, value) => midiRef.current.injectMockCC(cc, value)}
      />
      <WebcamPanel
        state={motionState}
        mockEnabled={mockWebcam}
        onMockToggle={setMockWebcam}
        onMockIntensity={(value) => webcamRef.current.injectMockIntensity(value)}
      />
      <PresetsPanel
        presets={presetNames}
        onSave={handleSavePreset}
        onLoad={handleLoadPreset}
        onDelete={handleDeletePreset}
        onImport={handleImportPreset}
        onExport={handleExportPresetJson}
      />
      <ExportPanel
        onExportZip={handleExportZip}
        onExportEmbed={handleExportEmbed}
        onCopyEmbed={handleCopyEmbed}
      />
      <HotkeysPanel />
    </>
  );

  const bottomDock = (
    <section className="panel" data-testid="panel-modulators">
      <h3>Modulators</h3>
      <label className="control control-inline">
        <span className="control-label">Loop Duration</span>
        <input
          type="number"
          min={1}
          max={32}
          step={0.5}
          value={loopDurationSec}
          onChange={(event) => setLoopDurationSec(Number(event.target.value))}
        />
      </label>

      <button type="button" onClick={handleAddModulator} data-testid="add-modulator">
        Add Modulator
      </button>

      <div className="modulator-list">
        {modulators.map((mod) => (
          <article className="mod-row" key={mod.id}>
            <select
              value={mod.targetParam}
              onChange={(event) => updateModulator(mod.id, { targetParam: event.target.value })}
            >
              {modulatorTargetOptions.map((key) => (
                <option key={key} value={key}>
                  {key}
                </option>
              ))}
            </select>

            <select value={mod.type} onChange={(event) => updateModulator(mod.id, { type: event.target.value as Modulator["type"] })}>
              <option value="lfo">LFO</option>
              <option value="audioBand">Audio Band</option>
              <option value="audioRms">Audio RMS</option>
              <option value="midiCC">MIDI CC</option>
              <option value="motion">Motion</option>
            </select>

            <input
              type="number"
              step={0.05}
              value={mod.amount}
              onChange={(event) => updateModulator(mod.id, { amount: Number(event.target.value) })}
              title="Amount"
            />

            <input
              type="number"
              step={0.05}
              value={mod.min}
              onChange={(event) => updateModulator(mod.id, { min: Number(event.target.value) })}
              title="Min"
            />

            <input
              type="number"
              step={0.05}
              value={mod.max}
              onChange={(event) => updateModulator(mod.id, { max: Number(event.target.value) })}
              title="Max"
            />

            <select value={mod.curve} onChange={(event) => updateModulator(mod.id, { curve: event.target.value as Modulator["curve"] })}>
              <option value="linear">Linear</option>
              <option value="exp">Exp</option>
              <option value="log">Log</option>
              <option value="smoothstep">Smoothstep</option>
            </select>

            <button type="button" onClick={() => removeModulator(mod.id)}>
              Remove
            </button>
          </article>
        ))}
      </div>
    </section>
  );

  const center = (
    <div className="canvas-wrap">
      <canvas
        ref={canvasRef}
        id="viz-canvas"
        data-testid="viz-canvas"
        width={query.width ?? 1280}
        height={query.height ?? 720}
      />
      <DebugOverlay frame={frameInfo} />
    </div>
  );

  return (
    <DockLayout
      left={leftDock}
      right={rightDock}
      bottom={bottomDock}
      center={center}
      leftCollapsed={panelCollapsed.left}
      rightCollapsed={panelCollapsed.right}
      bottomCollapsed={panelCollapsed.bottom}
      onToggleLeft={() => togglePanel("left")}
      onToggleRight={() => togglePanel("right")}
      onToggleBottom={() => togglePanel("bottom")}
    />
  );
};
