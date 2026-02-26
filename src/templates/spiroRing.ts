import type { TemplateContext, TemplateRuntime, VisualizerTemplate } from "../contracts/schema";
import type { ParamSchema } from "../contracts/types";
import * as THREE from "three";

class SpiroRingTemplate implements VisualizerTemplate {
  readonly id = "spiroRing" as const;
  readonly label = "Spiro Ring";

  private line?: THREE.Line;
  private ctx?: TemplateContext;

  getParamSchema(): ParamSchema {
    return [
      {
        key: "radius",
        type: "number",
        label: "Radius",
        group: "Geometry",
        min: 0.5,
        max: 4,
        step: 0.01,
        default: 1.8
      },
      {
        key: "detail",
        type: "number",
        label: "Detail",
        group: "Geometry",
        min: 64,
        max: 512,
        step: 1,
        default: 240
      },
      {
        key: "twist",
        type: "number",
        label: "Twist",
        group: "Motion",
        min: 1,
        max: 16,
        step: 1,
        default: 7
      },
      {
        key: "color",
        type: "color",
        label: "Line Color",
        group: "Style",
        default: "#ffaf45"
      }
    ];
  }

  getDefaultParams(): Record<string, any> {
    return {
      radius: 1.8,
      detail: 240,
      twist: 7,
      color: "#ffaf45"
    };
  }

  init(ctx: TemplateContext, params: Record<string, any>): void {
    this.ctx = ctx;

    const points = this.createPoints(
      Number(params.radius ?? 1.8),
      Math.max(64, Math.floor(Number(params.detail ?? 240))),
      Number(params.twist ?? 7),
      0
    );

    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ color: String(params.color ?? "#ffaf45") });
    this.line = new THREE.LineLoop(geometry, material);
    ctx.scene.add(this.line);
  }

  update(runtime: TemplateRuntime): void {
    if (!this.line) return;

    const radius = Number(runtime.params.radius ?? 1.8);
    const detail = Math.max(64, Math.floor(Number(runtime.params.detail ?? 240)));
    const twist = Number(runtime.params.twist ?? 7);
    const color = String(runtime.params.color ?? "#ffaf45");

    const points = this.createPoints(radius, detail, twist, runtime.loopT + runtime.seed * 0.0001);
    this.line.geometry.dispose();
    this.line.geometry = new THREE.BufferGeometry().setFromPoints(points);
    (this.line.material as THREE.LineBasicMaterial).color.set(color);
    this.line.rotation.z = runtime.loopT * Math.PI * 2;
  }

  dispose(): void {
    if (!this.line || !this.ctx) return;
    this.ctx.scene.remove(this.line);
    this.line.geometry.dispose();
    (this.line.material as THREE.Material).dispose();
    this.line = undefined;
    this.ctx = undefined;
  }

  private createPoints(radius: number, detail: number, twist: number, phase: number): THREE.Vector3[] {
    const points: THREE.Vector3[] = [];
    for (let i = 0; i < detail; i += 1) {
      const t = i / detail;
      const angle = t * Math.PI * 2;
      const k = angle * twist + phase * Math.PI * 2;
      const r = radius + Math.sin(k) * 0.35;
      points.push(new THREE.Vector3(Math.cos(angle) * r, Math.sin(angle) * r, Math.sin(k * 0.5) * 0.4));
    }
    return points;
  }
}

export const spiroRingTemplate = new SpiroRingTemplate();
