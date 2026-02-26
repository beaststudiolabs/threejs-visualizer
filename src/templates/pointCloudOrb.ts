import type { TemplateContext, TemplateRuntime, VisualizerTemplate } from "../contracts/schema";
import type { ParamSchema } from "../contracts/types";
import { mulberry32 } from "../utils/rng";
import * as THREE from "three";

const toFiniteNumber = (value: unknown, fallback: number): number => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

class PointCloudOrbTemplate implements VisualizerTemplate {
  readonly id = "pointCloudOrb" as const;
  readonly label = "Point Cloud Orb";

  private points?: THREE.Points;
  private ctx?: TemplateContext;
  private builtForSeed?: number;

  getParamSchema(): ParamSchema {
    return [
      {
        key: "density",
        type: "number",
        label: "Density",
        group: "Geometry",
        min: 200,
        max: 10000,
        step: 100,
        default: 1800
      },
      {
        key: "radius",
        type: "number",
        label: "Radius",
        group: "Geometry",
        min: 0.5,
        max: 4,
        step: 0.01,
        default: 1.4
      },
      {
        key: "rotationSpeed",
        type: "number",
        label: "Rotation",
        group: "Motion",
        min: 0,
        max: 3,
        step: 0.01,
        default: 0.6
      },
      {
        key: "color",
        type: "color",
        label: "Point Color",
        group: "Style",
        default: "#9ecbff"
      }
    ];
  }

  getDefaultParams(): Record<string, any> {
    return {
      density: 1800,
      radius: 1.4,
      rotationSpeed: 0.6,
      color: "#9ecbff"
    };
  }

  init(ctx: TemplateContext, params: Record<string, any>): void {
    this.ctx = ctx;

    const density = this.clampDensity(toFiniteNumber(params.density, 1800));
    const radius = this.clampRadius(toFiniteNumber(params.radius, 1.4));
    const geometry = this.buildGeometry(1337, density, radius);
    const material = new THREE.PointsMaterial({
      color: String(params.color ?? "#9ecbff"),
      size: 0.03,
      sizeAttenuation: true
    });

    this.points = new THREE.Points(geometry, material);
    ctx.scene.add(this.points);
  }

  update(runtime: TemplateRuntime): void {
    if (!this.points) return;

    const density = this.clampDensity(toFiniteNumber(runtime.params.density, 1800));
    const radius = this.clampRadius(toFiniteNumber(runtime.params.radius, 1.4));
    const speed = toFiniteNumber(runtime.params.rotationSpeed, 0.6);
    const color = String(runtime.params.color ?? "#9ecbff");

    if (this.builtForSeed !== runtime.seed) {
      this.points.geometry.dispose();
      this.points.geometry = this.buildGeometry(runtime.seed, density, radius);
      this.builtForSeed = runtime.seed;
    }

    (this.points.material as THREE.PointsMaterial).color.set(color);
    this.points.rotation.y = runtime.loopT * Math.PI * 2 * speed;
    this.points.rotation.x = runtime.loopT * Math.PI * speed * 0.7;
  }

  dispose(): void {
    if (!this.points || !this.ctx) return;
    this.ctx.scene.remove(this.points);
    this.points.geometry.dispose();
    (this.points.material as THREE.Material).dispose();
    this.points = undefined;
    this.ctx = undefined;
  }

  private buildGeometry(seed: number, density: number, radius: number): THREE.BufferGeometry {
    const finiteSeed = Number.isFinite(seed) ? seed : 1337;
    const count = this.clampDensity(Math.floor(density));
    const safeRadius = this.clampRadius(radius);
    const rng = mulberry32(finiteSeed);
    const vertices = new Float32Array(count * 3);

    for (let i = 0; i < count; i += 1) {
      const u = rng();
      const v = rng();
      const theta = 2 * Math.PI * u;
      const phi = Math.acos(2 * v - 1);
      const r = safeRadius * (0.6 + 0.4 * rng());

      vertices[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      vertices[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      vertices[i * 3 + 2] = r * Math.cos(phi);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
    return geometry;
  }

  private clampDensity(value: number): number {
    return Math.min(10000, Math.max(200, Math.floor(value)));
  }

  private clampRadius(value: number): number {
    return Math.min(4, Math.max(0.5, value));
  }
}

export const pointCloudOrbTemplate = new PointCloudOrbTemplate();
