export type WizardQueryConfig = {
  testMode: boolean;
  seed: number;
  fixedTimeSec?: number;
  width?: number;
  height?: number;
};

const parseNumber = (params: URLSearchParams, key: string): number | undefined => {
  const raw = params.get(key);
  if (!raw) return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
};

export const parseWizardQuery = (search = window.location.search): WizardQueryConfig => {
  const params = new URLSearchParams(search);
  const seed = parseNumber(params, "seed") ?? 1337;
  return {
    testMode: params.get("testMode") === "1",
    seed,
    fixedTimeSec: parseNumber(params, "t"),
    width: parseNumber(params, "width"),
    height: parseNumber(params, "height")
  };
};
