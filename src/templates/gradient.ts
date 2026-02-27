import type { ParamSchema } from "../contracts/types";
import * as THREE from "three";

const COLOR_KEYS = ["color", "color2", "color3", "color4", "color5"] as const;

const clampStops = (value: number): number => {
  if (!Number.isFinite(value)) return 2;
  return Math.max(2, Math.min(5, Math.round(value)));
};

const getColorList = (params: Record<string, any>, fallback: readonly [string, string, string, string, string]): string[] => {
  return COLOR_KEYS.map((key, index) => {
    const next = params[key];
    return typeof next === "string" && next.length > 0 ? next : fallback[index];
  });
};

const interpolateGradientColor = (colors: THREE.Color[], t: number, out: THREE.Color): THREE.Color => {
  if (colors.length <= 1) {
    return out.copy(colors[0] ?? new THREE.Color("#ffffff"));
  }

  const clamped = THREE.MathUtils.clamp(t, 0, 1);
  const segmentCount = colors.length - 1;
  const scaled = clamped * segmentCount;
  const fromIndex = Math.min(segmentCount - 1, Math.floor(scaled));
  const toIndex = Math.min(fromIndex + 1, colors.length - 1);
  const localT = scaled - fromIndex;

  return out.copy(colors[fromIndex]).lerp(colors[toIndex], localT);
};

export const createGradientParamSchema = (
  defaults: readonly [string, string, string, string, string],
  group = "Style"
): ParamSchema => [
  {
    key: "gradientStops",
    type: "number",
    label: "Gradient Stops",
    group,
    min: 2,
    max: 5,
    step: 1,
    default: 2
  },
  {
    key: "color",
    type: "color",
    label: "Color 1",
    group,
    default: defaults[0]
  },
  {
    key: "color2",
    type: "color",
    label: "Color 2",
    group,
    default: defaults[1]
  },
  {
    key: "color3",
    type: "color",
    label: "Color 3",
    group,
    default: defaults[2]
  },
  {
    key: "color4",
    type: "color",
    label: "Color 4",
    group,
    default: defaults[3]
  },
  {
    key: "color5",
    type: "color",
    label: "Color 5",
    group,
    default: defaults[4]
  }
];

export const resolveGradientColors = (
  params: Record<string, any>,
  fallback: readonly [string, string, string, string, string]
): string[] => {
  const stops = clampStops(Number(params.gradientStops ?? 2));
  return getColorList(params, fallback).slice(0, stops);
};

export const applyRadialGradientToGeometry = (
  geometry: THREE.BufferGeometry,
  params: Record<string, any>,
  fallback: readonly [string, string, string, string, string]
): void => {
  const position = geometry.getAttribute("position");
  if (!position || position.itemSize < 3 || position.count === 0) {
    return;
  }

  const center = new THREE.Vector3();
  const vertex = new THREE.Vector3();

  geometry.computeBoundingBox();
  geometry.boundingBox?.getCenter(center);

  let maxRadius = 0;
  for (let i = 0; i < position.count; i += 1) {
    vertex.set(position.getX(i), position.getY(i), position.getZ(i));
    maxRadius = Math.max(maxRadius, vertex.distanceTo(center));
  }
  const safeRadius = Math.max(maxRadius, Number.EPSILON);

  const colors = resolveGradientColors(params, fallback).map((value) => new THREE.Color(value));
  const colorData = new Float32Array(position.count * 3);
  const temp = new THREE.Color();

  for (let i = 0; i < position.count; i += 1) {
    vertex.set(position.getX(i), position.getY(i), position.getZ(i));
    const t = THREE.MathUtils.clamp(vertex.distanceTo(center) / safeRadius, 0, 1);
    interpolateGradientColor(colors, t, temp);

    const offset = i * 3;
    colorData[offset] = temp.r;
    colorData[offset + 1] = temp.g;
    colorData[offset + 2] = temp.b;
  }

  geometry.setAttribute("color", new THREE.BufferAttribute(colorData, 3));
};
