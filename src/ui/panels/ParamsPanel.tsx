import type { ParamSchema } from "../../contracts/types";
import type { AudioControlSource } from "../../modulators/autoBindings";
import { Select } from "../components/Select";
import { Slider } from "../components/Slider";
import { Toggle } from "../components/Toggle";

type ParamControllerBinding = {
  midiEnabled: boolean;
  midiCc: number;
  motionEnabled: boolean;
  audioEnabled: boolean;
  audioSource: AudioControlSource;
};

type ParamsPanelProps = {
  schema: ParamSchema;
  params: Record<string, number | boolean | string>;
  controllerBindings: Record<string, ParamControllerBinding>;
  onParamChange: (key: string, value: number | boolean | string) => void;
  onMidiToggle: (key: string, enabled: boolean) => void;
  onMidiCcChange: (key: string, cc: number) => void;
  onMotionToggle: (key: string, enabled: boolean) => void;
  onAudioToggle: (key: string, enabled: boolean) => void;
  onAudioSourceChange: (key: string, source: AudioControlSource) => void;
};

const DEFAULT_BINDING: ParamControllerBinding = {
  midiEnabled: false,
  midiCc: 48,
  motionEnabled: false,
  audioEnabled: false,
  audioSource: "rms"
};

export const ParamsPanel = ({
  schema,
  params,
  controllerBindings,
  onParamChange,
  onMidiToggle,
  onMidiCcChange,
  onMotionToggle,
  onAudioToggle,
  onAudioSourceChange
}: ParamsPanelProps): JSX.Element => {
  return (
    <section className="panel" data-testid="panel-params">
      <h3>Parameters</h3>
      {schema.map((item) => {
        const value = params[item.key] ?? item.default;
        const binding = controllerBindings[item.key] ?? DEFAULT_BINDING;

        let inputControl: JSX.Element;

        if (item.type === "number") {
          inputControl = (
            <Slider
              id={`param-${item.key}`}
              label={item.label}
              min={item.min}
              max={item.max}
              step={item.step}
              value={Number(value)}
              onChange={(next) => onParamChange(item.key, next)}
            />
          );
        } else if (item.type === "boolean") {
          inputControl = (
            <Toggle
              label={item.label}
              checked={Boolean(value)}
              onChange={(next) => onParamChange(item.key, next)}
            />
          );
        } else if (item.type === "select") {
          inputControl = (
            <Select
              id={`param-${item.key}`}
              label={item.label}
              value={String(value)}
              options={item.options}
              onChange={(next) => onParamChange(item.key, next)}
            />
          );
        } else {
          inputControl = (
            <label className="control">
              <span className="control-label">{item.label}</span>
              <input
                type="color"
                value={String(value)}
                onChange={(event) => onParamChange(item.key, event.target.value)}
              />
            </label>
          );
        }

        return (
          <div className="param-item" key={item.key}>
            {inputControl}
            <div className="param-controller-row">
              <label className="param-controller-toggle">
                <input
                  type="checkbox"
                  checked={binding.midiEnabled}
                  onChange={(event) => onMidiToggle(item.key, event.target.checked)}
                  data-testid={`param-midi-toggle-${item.key}`}
                />
                <span>MIDI</span>
              </label>
              <input
                type="number"
                min={0}
                max={127}
                step={1}
                value={binding.midiCc}
                disabled={!binding.midiEnabled}
                onChange={(event) => onMidiCcChange(item.key, Number(event.target.value))}
                data-testid={`param-midi-cc-${item.key}`}
              />
              <label className="param-controller-toggle">
                <input
                  type="checkbox"
                  checked={binding.motionEnabled}
                  onChange={(event) => onMotionToggle(item.key, event.target.checked)}
                  data-testid={`param-motion-toggle-${item.key}`}
                />
                <span>Webcam</span>
              </label>
              <label className="param-controller-toggle">
                <input
                  type="checkbox"
                  checked={binding.audioEnabled}
                  onChange={(event) => onAudioToggle(item.key, event.target.checked)}
                  data-testid={`param-audio-toggle-${item.key}`}
                />
                <span>Audio</span>
              </label>
              <select
                value={binding.audioSource}
                disabled={!binding.audioEnabled}
                onChange={(event) => onAudioSourceChange(item.key, event.target.value as AudioControlSource)}
                data-testid={`param-audio-source-${item.key}`}
              >
                <option value="rms">RMS</option>
                <option value="bass">Bass</option>
                <option value="mids">Mids</option>
                <option value="highs">Highs</option>
              </select>
            </div>
          </div>
        );
      })}
    </section>
  );
};
