import type { Modulator } from "../contracts/types";

export type AutoControlKind = "midi" | "motion" | "audio";
export type AudioControlSource = "rms" | "bass" | "mids" | "highs";

export const AUTO_MODULATOR_PREFIX = "auto:";
export const DEFAULT_MIDI_CC = 48;
export const DEFAULT_AUDIO_SOURCE: AudioControlSource = "rms";

const clampMidiCc = (value: number): number => {
  if (!Number.isFinite(value)) return DEFAULT_MIDI_CC;
  return Math.max(0, Math.min(127, Math.round(value)));
};

export const createAutoModulatorId = (targetParam: string, kind: AutoControlKind): string =>
  `${AUTO_MODULATOR_PREFIX}${targetParam}:${kind}`;

export const isAutoModulator = (mod: Modulator): boolean => mod.id.startsWith(AUTO_MODULATOR_PREFIX);

export const parseMidiCcSource = (source?: string): number => {
  if (!source || !source.startsWith("cc:")) {
    return DEFAULT_MIDI_CC;
  }
  const parsed = Number.parseInt(source.slice(3), 10);
  return clampMidiCc(parsed);
};

export const parseAudioSource = (source?: string): AudioControlSource => {
  if (source === "bass" || source === "mids" || source === "highs" || source === "rms") {
    return source;
  }
  return DEFAULT_AUDIO_SOURCE;
};

export const findAutoModulator = (
  modulators: Modulator[],
  targetParam: string,
  kind: AutoControlKind
): Modulator | undefined => modulators.find((mod) => mod.id === createAutoModulatorId(targetParam, kind));

export const createAutoModulator = (
  targetParam: string,
  kind: AutoControlKind,
  options: { midiCc?: number; audioSource?: AudioControlSource } = {}
): Modulator => {
  const midiCc = clampMidiCc(options.midiCc ?? DEFAULT_MIDI_CC);
  const audioSource = options.audioSource ?? DEFAULT_AUDIO_SOURCE;

  if (kind === "midi") {
    return {
      id: createAutoModulatorId(targetParam, kind),
      type: "midiCC",
      source: `cc:${midiCc}`,
      targetParam,
      amount: 1,
      min: 0,
      max: 1,
      curve: "linear",
      enabled: true
    };
  }

  if (kind === "audio") {
    return {
      id: createAutoModulatorId(targetParam, kind),
      type: "audioBand",
      source: audioSource,
      targetParam,
      amount: 1,
      min: 0,
      max: 1,
      curve: "linear",
      enabled: true
    };
  }

  return {
    id: createAutoModulatorId(targetParam, kind),
    type: "motion",
    targetParam,
    amount: 1,
    min: 0,
    max: 1,
    curve: "linear",
    enabled: true
  };
};
