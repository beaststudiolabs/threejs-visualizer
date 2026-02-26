import type { PresetV1 } from "../contracts/types";

export const CURRENT_PRESET_VERSION = 1 as const;

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export const migratePreset = (value: unknown): PresetV1 => {
  if (!isObject(value)) {
    throw new Error("Invalid preset payload");
  }

  if (value.version === 1) {
    return value as PresetV1;
  }

  throw new Error("Unsupported preset version");
};
