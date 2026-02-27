import type { PresetV1 } from "../contracts/types";
import { FACTORY_PRESETS } from "./factoryPresets";
import { migratePreset } from "./migrations";

const DEFAULT_STORAGE_KEY = "particle-wizard:presets";
const LEGACY_STORAGE_KEY = "vibeviz:presets";

const clonePreset = (preset: PresetV1): PresetV1 => ({
  ...preset,
  params: { ...preset.params },
  camera: {
    ...preset.camera,
    position: [...preset.camera.position] as [number, number, number],
    target: [...preset.camera.target] as [number, number, number]
  },
  palette: { ...preset.palette },
  modulators: preset.modulators.map((mod) => ({ ...mod })),
  midiMappings: preset.midiMappings.map((mapping) => ({ ...mapping }))
});

export class PresetManager {
  private readonly storageKey: string;
  private readonly legacyStorageKey?: string;
  private readonly seedFactoryPresets: boolean;

  constructor(storageKey = DEFAULT_STORAGE_KEY, options: { seedFactoryPresets?: boolean } = {}) {
    this.storageKey = storageKey;
    this.legacyStorageKey = storageKey === DEFAULT_STORAGE_KEY ? LEGACY_STORAGE_KEY : undefined;
    this.seedFactoryPresets = options.seedFactoryPresets ?? true;
  }

  list(): PresetV1[] {
    return this.readAll();
  }

  save(preset: PresetV1): void {
    const all = this.readAll().filter((item) => item.name !== preset.name);
    all.push(preset);
    localStorage.setItem(this.storageKey, JSON.stringify(all));
  }

  load(name: string): PresetV1 | undefined {
    return this.readAll().find((preset) => preset.name === name);
  }

  remove(name: string): void {
    const filtered = this.readAll().filter((preset) => preset.name !== name);
    localStorage.setItem(this.storageKey, JSON.stringify(filtered));
  }

  export(name: string): string {
    const preset = this.load(name);
    if (!preset) {
      throw new Error(`Preset not found: ${name}`);
    }
    return JSON.stringify(preset, null, 2);
  }

  import(content: string): PresetV1 {
    const raw = JSON.parse(content) as unknown;
    const migrated = this.migrate(raw);
    this.save(migrated);
    return migrated;
  }

  migrate(raw: unknown): PresetV1 {
    return migratePreset(raw);
  }

  private readAll(): PresetV1[] {
    const stored = this.readStored();
    if (!this.seedFactoryPresets) {
      return stored;
    }
    return this.seedMissingFactoryPresets(stored);
  }

  private readStored(): PresetV1[] {
    const raw = localStorage.getItem(this.storageKey);
    if (!raw && this.legacyStorageKey) {
      const legacyRaw = localStorage.getItem(this.legacyStorageKey);
      if (!legacyRaw) {
        return [];
      }
      const migrated = this.parseStored(legacyRaw);
      localStorage.setItem(this.storageKey, JSON.stringify(migrated));
      return migrated;
    }
    if (!raw) {
      return [];
    }

    return this.parseStored(raw);
  }

  private parseStored(raw: string): PresetV1[] {
    const parsed = JSON.parse(raw) as unknown[];
    return parsed.map((item) => this.migrate(item));
  }

  private seedMissingFactoryPresets(stored: PresetV1[]): PresetV1[] {
    const existingByName = new Map(stored.map((preset) => [preset.name, preset]));
    const missingFactoryPreset = FACTORY_PRESETS.some((preset) => !existingByName.has(preset.name));
    if (!missingFactoryPreset) {
      return stored;
    }

    const merged = new Map<string, PresetV1>();
    for (const preset of FACTORY_PRESETS) {
      merged.set(preset.name, clonePreset(preset));
    }
    for (const preset of stored) {
      merged.set(preset.name, preset);
    }

    const next = [...merged.values()];
    localStorage.setItem(this.storageKey, JSON.stringify(next));
    return next;
  }
}
