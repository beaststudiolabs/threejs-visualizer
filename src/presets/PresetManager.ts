import type { PresetV1 } from "../contracts/types";
import { migratePreset } from "./migrations";

export class PresetManager {
  private readonly storageKey: string;

  constructor(storageKey = "vibeviz:presets") {
    this.storageKey = storageKey;
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
    const raw = localStorage.getItem(this.storageKey);
    if (!raw) return [];

    const parsed = JSON.parse(raw) as unknown[];
    return parsed.map((item) => this.migrate(item));
  }
}
