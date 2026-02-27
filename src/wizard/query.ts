export type WizardQueryConfig = {
  testMode: boolean;
  trackerMode: "default" | "off" | "mockfail" | "remote" | "local";
  seed: number;
  fixedTimeSec?: number;
  width?: number;
  height?: number;
  debug: boolean;
  glow?: number;
  threshold?: number;
  gain?: number;
  primary?: string;
  secondary?: string;
  accent?: string;
};

const parseNumber = (params: URLSearchParams, key: string): number | undefined => {
  const raw = params.get(key);
  if (!raw) return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const parseHexColor = (params: URLSearchParams, key: string): string | undefined => {
  const raw = params.get(key);
  if (!raw) return undefined;
  const normalized = raw.startsWith("#") ? raw : `#${raw}`;
  return /^#[0-9a-fA-F]{6}$/.test(normalized) ? normalized : undefined;
};

const parseTrackerMode = (params: URLSearchParams): WizardQueryConfig["trackerMode"] => {
  const raw = (params.get("tracker") ?? "").toLowerCase();
  if (raw === "off") {
    return "off";
  }
  if (raw === "mockfail") {
    return "mockfail";
  }
  if (raw === "remote") {
    return "remote";
  }
  if (raw === "local") {
    return "local";
  }
  return "default";
};

export const parseWizardQuery = (search = window.location.search): WizardQueryConfig => {
  const params = new URLSearchParams(search);
  const seed = parseNumber(params, "seed") ?? 1337;
  const debugRaw = params.get("debug");
  return {
    testMode: params.get("testMode") === "1",
    trackerMode: parseTrackerMode(params),
    debug: debugRaw === null ? true : debugRaw !== "0",
    seed,
    fixedTimeSec: parseNumber(params, "t"),
    width: parseNumber(params, "width"),
    height: parseNumber(params, "height"),
    glow: parseNumber(params, "glow"),
    threshold: parseNumber(params, "threshold"),
    gain: parseNumber(params, "gain"),
    primary: parseHexColor(params, "primary"),
    secondary: parseHexColor(params, "secondary"),
    accent: parseHexColor(params, "accent")
  };
};
